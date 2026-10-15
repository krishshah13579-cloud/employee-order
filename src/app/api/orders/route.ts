import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAvailableSetsForColor, deductSetsFromStock } from "@/lib/stock";
import { sendNewOrderNotification } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = {};
    if (status && status !== "All") {
      where.status = status;
    }
    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { orderNumber: { contains: term } },
        { customerName: { contains: term } },
        { customerGstPan: { contains: term } },
        { placedBy: { contains: term } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, placedBy, notes, items, orderDate } = body;

    if (!customerId) {
      return NextResponse.json({ error: "Customer is required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId, 10) },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one product item is required" }, { status: 400 });
    }

    // Process Wholesale Order Items
    let orderSubtotal = 0;
    let orderTotalPcs = 0;
    let orderTotalSets = 0;

    const validatedItems: any[] = [];
    const productDeductionsMap = new Map<
      number,
      { product: any; orderedSets: { color: string; sets: number }[] }
    >();

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const product = await prisma.product.findUnique({
        where: { id: parseInt(it.productId, 10) },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Product with ID ${it.productId} not found` },
          { status: 404 }
        );
      }

      // Calculate total sets from colorSets (e.g. [{color: "Black", sets: 2}, {color: "Navy", sets: 3}])
      let colorSetsArray = Array.isArray(it.colorSets)
        ? it.colorSets
        : typeof it.colorSets === "string"
        ? JSON.parse(it.colorSets || "[]")
        : [];

      const pcsPerSet = parseInt(it.pcsPerSet, 10) || product.pcsPerSet || 5;

      let itemTotalSets = colorSetsArray.reduce(
        (sum: number, cs: any) => sum + (parseInt(cs.sets, 10) || 0),
        0
      );

      if (itemTotalSets === 0) {
        if (it.totalSets) {
          itemTotalSets = parseInt(it.totalSets, 10) || 1;
        } else if (it.quantity) {
          itemTotalSets = Math.max(1, Math.round(parseInt(it.quantity, 10) / pcsPerSet));
        } else {
          itemTotalSets = 1;
        }
        colorSetsArray = [{ color: it.color || "Standard", sets: itemTotalSets }];
      }

      // Enforce stock availability
      if (product.setsColorwise && product.setsColorwise.trim() !== "") {
        for (const cs of colorSetsArray) {
          const requestedSets = parseInt(cs.sets, 10) || 0;
          const availableStock = getAvailableSetsForColor(product.setsColorwise, cs.color);

          // Check how many sets of this color have already been reserved in previous items of this order
          const existingDeduction =
            productDeductionsMap
              .get(product.id)
              ?.orderedSets.filter((s) => s.color.toLowerCase() === cs.color.toLowerCase())
              .reduce((sum, s) => sum + s.sets, 0) || 0;

          if (requestedSets + existingDeduction > availableStock) {
            return NextResponse.json(
              {
                error: `Stock limit exceeded for "${product.name}" (${cs.color}): requested ${
                  requestedSets + existingDeduction
                } sets, but only ${availableStock} sets are available in stock.`,
              },
              { status: 400 }
            );
          }
        }
      }

      // Collect for stock deduction
      if (!productDeductionsMap.has(product.id)) {
        productDeductionsMap.set(product.id, { product, orderedSets: [] });
      }
      for (const cs of colorSetsArray) {
        productDeductionsMap.get(product.id)!.orderedSets.push({
          color: cs.color,
          sets: parseInt(cs.sets, 10) || 0,
        });
      }

      // PCS = SET * PCS (e.g. 5 sets * 5 sizes = 25 pcs)
      const itemTotalPcs = itemTotalSets * pcsPerSet;
      const unitPrice = parseFloat(it.unitPrice) || product.price || 0;
      const itemSubtotal = itemTotalPcs * unitPrice;

      orderSubtotal += itemSubtotal;
      orderTotalPcs += itemTotalPcs;
      orderTotalSets += itemTotalSets;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        colorSets: JSON.stringify(colorSetsArray),
        sizeRatio: it.sizeRatio || product.sizesRatio,
        sizesList: it.sizesList || product.sizesList,
        pcsPerSet: pcsPerSet,
        totalSets: itemTotalSets,
        totalPcs: itemTotalPcs,
        unitPrice: unitPrice,
        itemSubtotal: itemSubtotal,
        notes: it.notes || null,
      });
    }

    // 5% GST calculation
    const gstRate = 5.0;
    const gstAmount = Math.round(orderSubtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round(orderSubtotal + gstAmount);

    // Generate Order Number GO-YYMMDD-NNN
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePrefix = `GO-${yy}${mm}${dd}`;

    const todayCount = await prisma.order.count({
      where: { orderNumber: { startsWith: datePrefix } },
    });

    let sequence = todayCount + 1;
    let orderNumber = `${datePrefix}-${String(sequence).padStart(3, "0")}`;
    while (await prisma.order.findUnique({ where: { orderNumber } })) {
      sequence++;
      orderNumber = `${datePrefix}-${String(sequence).padStart(3, "0")}`;
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      // Deduct stock for all products that have setsColorwise
      for (const { product, orderedSets } of productDeductionsMap.values()) {
        if (product.setsColorwise && product.setsColorwise.trim() !== "") {
          const updatedStock = deductSetsFromStock(product.setsColorwise, orderedSets);
          await tx.product.update({
            where: { id: product.id },
            data: { setsColorwise: updatedStock },
          });
        }
      }

      return await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerName: customer.shopName,
          customerGstPan: customer.gstPanNo,
          customerPhone: customer.phoneNumber,
          customerAddress: customer.address,
          businessType: body.businessType || (customer as any).businessType || "RETAILER",
          creditDays: body.creditDays !== undefined ? (parseInt(body.creditDays, 10) || 0) : ((customer as any).creditDays || 0),
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          status: "Pending",
          subtotal: orderSubtotal,
          gstRate: gstRate,
          gstAmount: gstAmount,
          grandTotal: grandTotal,
          totalPcs: orderTotalPcs,
          totalSets: orderTotalSets,
          placedBy: placedBy || "Admin",
          notes: notes || null,
          items: {
            create: validatedItems,
          },
        },
        include: {
          customer: true,
          items: true,
        },
      });
    });

    // Send immediate email notification alert to admin (non-blocking)
    sendNewOrderNotification({
      orderNumber: createdOrder.orderNumber,
      customerName: createdOrder.customerName,
      customerGstPan: createdOrder.customerGstPan,
      customerPhone: createdOrder.customerPhone || undefined,
      grandTotal: createdOrder.grandTotal,
      totalPcs: createdOrder.totalPcs,
      totalSets: createdOrder.totalSets,
      placedBy: createdOrder.placedBy || undefined,
    }).catch((err) => console.error("Order email notification background error:", err));

    return NextResponse.json(createdOrder, { status: 201 });
  } catch (error: any) {
    console.error("Error creating wholesale order:", error);
    return NextResponse.json(
      { error: "Failed to create order: " + error.message },
      { status: 500 }
    );
  }
}
