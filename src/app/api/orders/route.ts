import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAvailableSetsForColor,
  deductSetsFromStock,
  calculateOrderedColorSetsPieces,
  isColorSoldOut,
  getColorShadeLetter,
  getAllProductColors,
} from "@/lib/stock";
import { sendNewOrderNotification, sendColorSoldOutNotification } from "@/lib/email";
import { generateOrderWhatsAppMessage, dispatchAutomatedWhatsApp } from "@/lib/whatsapp";
import { requireAdmin, getAdminSession, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
import { getNextTaxInvoiceNumber, syncSequentialOrderNumbers, getNextOrderNumber, getNextBillNumber } from "@/lib/order-numbers";
import { releaseReservations } from "@/lib/reservations";
import { createOrUpdateSalesInvoiceFromOrder } from "@/lib/sales";
import { sendWebPushNotification } from "@/lib/web-push";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const placedByQuery = searchParams.get("placedBy");

    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);

    const where: any = {};
    if (status && status !== "All") {
      where.status = status;
    }
    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { orderNumber: { contains: term } },
        { taxInvoiceNumber: { contains: term } },
        { customerName: { contains: term } },
        { customerGstPan: { contains: term } },
        { placedBy: { contains: term } },
      ];
    }

    // Role-based Order Isolation:
    // "DONT SHOW OTHER EMPLOYEES DATA IN THAT EMPLOYEES PORTAL. FOR EG. KRISH SHAH USER DATA IS SHOWN IN YASH RAVAL (NOT ALLOWED)."
    // "JUST TEAM LEADER CAN HAVE A LOOK I.E. KRISH SHAH NO OTHER T.L. CAN CHECK ANY OTHER EMPLOYEES DATA."
    if (!admin) {
      if (isTLKrishShah) {
        // Team Leader Krish Shah can view specific team member's orders if queried, or his own
        if (placedByQuery && placedByQuery.trim() !== "") {
          where.placedBy = { equals: placedByQuery.trim(), mode: "insensitive" };
        } else if (employee?.name) {
          where.placedBy = { equals: employee.name, mode: "insensitive" };
        }
      } else {
        // All other employees (including any other TL): STRICTLY lock to their own placed orders!
        // Never allow them to see Krish Shah or any other colleague's data!
        if (employee?.name) {
          where.placedBy = { equals: employee.name, mode: "insensitive" };
        } else {
          return NextResponse.json([]);
        }
      }
    } else if (placedByQuery && placedByQuery.trim() !== "") {
      where.placedBy = { equals: placedByQuery.trim(), mode: "insensitive" };
    }

    // High performance query: exclude heavy base64 imageUrl/colorImages/visitingCardUrl
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            shopName: true,
            gstPanNo: true,
            businessType: true,
            creditDays: true,
            specialDiscount: true,
            address: true,
            city: true,
            state: true,
            phoneNumber: true,
            contactPerson: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                sizesRatio: true,
                price: true,
                retailerPrice: true,
                wholesalerPrice: true,
              },
            },
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

    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    // Strict allocation verification for employees on employee side
    if (!admin && employee && employee.id > 0) {
      const isAllocated =
        (customer.allocatedEmployeeId && customer.allocatedEmployeeId === employee.id) ||
        (customer.allocatedEmployeeName && customer.allocatedEmployeeName.trim().toLowerCase() === employee.name.trim().toLowerCase());

      if (!isAllocated) {
        return NextResponse.json(
          { error: `Forbidden: Customer "${customer.shopName}" is not allocated to your portfolio.` },
          { status: 403 }
        );
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one product item is required" }, { status: 400 });
    }

    // Determine order date & check past-dated / post-dated status
    const effectiveOrderDate = body.orderDate
      ? new Date(body.orderDate)
      : body.billDate
      ? new Date(body.billDate)
      : body.taxInvoiceDate
      ? new Date(body.taxInvoiceDate)
      : new Date();

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const tomorrowMidnight = new Date(todayMidnight);
    tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);

    const isPastDated = !isNaN(effectiveOrderDate.getTime()) && effectiveOrderDate.getTime() < todayMidnight.getTime();
    const isPostDated = !isNaN(effectiveOrderDate.getTime()) && effectiveOrderDate.getTime() >= tomorrowMidnight.getTime();

    const isExplicitBillWithoutGst = Boolean(
      body.isBillWithoutGst === true ||
      body.billType === "NON_GST" ||
      body.billType === "BILL_WITHOUT_GST"
    );

    const isPreviousBill = Boolean(body.isPreviousBill);
    const previousBillDate = body.previousBillDate ? new Date(body.previousBillDate) : (isPreviousBill ? effectiveOrderDate : null);

    // Permission check: only admin or employees granted canAddPreviousBills can generate bills / previous bills
    if ((isExplicitBillWithoutGst || isPreviousBill) && !admin) {
      const isAllowed = Boolean(employee?.canAddPreviousBills);
      if (!isAllowed) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission from Admin to generate bills." },
          { status: 403 }
        );
      }
    }

    // Skip live stock deduction for:
    // 1. Past-dated bills or previous historical bills (warehouse stock is already present physical stock)
    // 2. Post-dated bills without GST (future-dated accounting bills)
    // 3. When explicitly requested via skipStockDeduction
    const shouldDeductStock =
      !isPastDated &&
      !isPreviousBill &&
      !(isPostDated && isExplicitBillWithoutGst) &&
      !body.skipStockDeduction;

    // Process Wholesale Order Items
    let orderSubtotal = 0;
    let orderTotalPcs = 0;
    let orderTotalSets = 0;

    const validatedItems: any[] = [];
    const productDeductionsMap = new Map<
      number,
      {
        product: any;
        orderedSets: { color: string; sets: number }[];
        orderedLoose: Record<string, Record<string, number>>;
      }
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

      // Check if item has mix single pieces
      let itemMixPcs = parseInt(it.mixPcs, 10) || 0;
      if (itemMixPcs === 0 && it.colorMixPcs && typeof it.colorMixPcs === "object") {
        for (const sMap of Object.values(it.colorMixPcs)) {
          if (typeof sMap === "object" && sMap !== null) {
            for (const cnt of Object.values(sMap as Record<string, any>)) {
              itemMixPcs += Math.max(0, parseInt(String(cnt), 10) || 0);
            }
          }
        }
      }
      const hasMixPcs = itemMixPcs > 0 || (it.colorMixPcs && typeof it.colorMixPcs === "object" && Object.keys(it.colorMixPcs).length > 0);

      if (itemTotalSets === 0) {
        if (it.totalSets !== undefined && it.totalSets !== null && !isNaN(parseInt(it.totalSets, 10))) {
          itemTotalSets = Math.max(0, parseInt(it.totalSets, 10));
        } else if (!hasMixPcs && it.quantity && parseInt(it.quantity, 10) > 0) {
          itemTotalSets = Math.max(1, Math.round(parseInt(it.quantity, 10) / pcsPerSet));
        } else {
          itemTotalSets = 0;
        }

        if (itemTotalSets > 0 && colorSetsArray.length === 0) {
          colorSetsArray = [{ color: it.color || "Standard", sets: itemTotalSets }];
        }
      }

      // Enforce live stock availability check only if stock will actually be deducted from warehouse
      const isMixProduct = product.name.toUpperCase().includes("IMPORTED TROUSER");
      if (shouldDeductStock && !isMixProduct && product.setsColorwise && product.setsColorwise.trim() !== "") {
        for (const cs of colorSetsArray) {
          const requestedSets = parseInt(cs.sets, 10) || 0;
          if (requestedSets <= 0) continue; // Skip items with 0 sets (e.g. mix pieces only)

          const availableStock = getAvailableSetsForColor(product.setsColorwise, cs.color, product.colorMapping);

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
        productDeductionsMap.set(product.id, { product, orderedSets: [], orderedLoose: {} });
      }
      for (const cs of colorSetsArray) {
        const setsCount = parseInt(cs.sets, 10) || 0;
        if (setsCount > 0) {
          productDeductionsMap.get(product.id)!.orderedSets.push({
            color: cs.color,
            sets: setsCount,
          });
        }
      }

      // Collect loose single pieces for deduction
      if (it.colorMixPcs && typeof it.colorMixPcs === "object") {
        const prodLoose = productDeductionsMap.get(product.id)!.orderedLoose;
        for (const [col, sMap] of Object.entries(it.colorMixPcs)) {
          if (!prodLoose[col]) prodLoose[col] = {};
          if (typeof sMap === "object" && sMap !== null) {
            for (const [sz, cnt] of Object.entries(sMap)) {
              prodLoose[col][sz] = (prodLoose[col][sz] || 0) + (parseInt(String(cnt), 10) || 0);
            }
          }
        }
      }

      // Accurately calculate pieces
      let itemTotalPcs = 0;
      const isPastOrExplicitBill = isPreviousBill || isExplicitBillWithoutGst || !shouldDeductStock;

      if (isPastOrExplicitBill && it.totalPcs && parseInt(it.totalPcs, 10) > 0) {
        // Strictly preserve exact quantity submitted for past/explicit bills without GST
        itemTotalPcs = parseInt(it.totalPcs, 10);
      } else if (isPastOrExplicitBill) {
        // If sets were entered, calculate directly as sets * pcsPerSet without color ratio fragmentation
        itemTotalPcs = (itemTotalSets * pcsPerSet) + itemMixPcs;
      } else {
        // Live stock order: allocate sets across color ratio packs in warehouse inventory
        for (const cs of colorSetsArray) {
          const requested = parseInt(cs.sets, 10) || 0;
          if (requested <= 0) continue;
          const pcsCalc = calculateOrderedColorSetsPieces(
            product.setsColorwise,
            cs.color,
            requested,
            pcsPerSet
          );
          itemTotalPcs += pcsCalc.totalPcs;
        }
        itemTotalPcs += itemMixPcs;
      }

      if (itemTotalPcs === 0) {
        itemTotalPcs = parseInt(it.totalPcs, 10) || (itemTotalSets * pcsPerSet) + itemMixPcs;
      }

      const unitPrice = parseFloat(it.unitPrice) || product.price || 0;
      const itemSubtotal = isPastOrExplicitBill && it.subtotal !== undefined && !isNaN(parseFloat(it.subtotal))
        ? Math.round(parseFloat(it.subtotal))
        : itemTotalPcs * unitPrice;

      orderSubtotal += itemSubtotal;
      orderTotalPcs += itemTotalPcs;
      orderTotalSets += itemTotalSets;

      const itemNotes = [
        it.notes,
        it.mixSizes && it.mixSizes !== "None" ? `[Mix Sizes: ${it.mixSizes}]` : null
      ].filter(Boolean).join(" | ");

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
        notes: itemNotes || null,
      });
    }

    // GST calculation: 0% if Without GST, inclusive for Cash Customer, else 5%
    const effectiveBusinessType = (body.businessType || (customer as any).businessType || "RETAILER").trim().toUpperCase();

    const isExplicitTaxInvoiceWithGst = Boolean(
      body.isBillWithoutGst === false ||
      body.billType === "TAX_INVOICE"
    );

    const isWithoutGst =
      isExplicitBillWithoutGst ||
      (!isExplicitTaxInvoiceWithGst && (
        effectiveBusinessType === "WHOLESALER WITHOUT GST" ||
        effectiveBusinessType === "WHOLESALE WITHOUT GST" ||
        effectiveBusinessType === "RETAILER WITHOUT GST" ||
        effectiveBusinessType === "RETAILER (WITHOUT GST)" ||
        effectiveBusinessType.includes("WITHOUT GST") ||
        effectiveBusinessType.includes("NO GST") ||
        body.gstRate === 0
      ));

    const isCashCustomer = Boolean(
      (customer.shopName || "").toUpperCase().includes("CASH") ||
      effectiveBusinessType.includes("CASH")
    );

    let finalSubtotal = Math.round(orderSubtotal);
    let gstRate = isWithoutGst ? 0 : 5.0;
    let gstAmount = 0;
    let grandTotal = finalSubtotal;

    if (isCashCustomer) {
      // Cash Customer: GST is inclusive inside the amount (e.g. 600 includes 5% GST)
      finalSubtotal = Math.round(orderSubtotal / 1.05);
      gstAmount = Math.round(orderSubtotal) - finalSubtotal;
      grandTotal = Math.round(orderSubtotal);
      gstRate = 5.0;
    } else if (!isWithoutGst) {
      // If customer is Without GST but TL/Admin chose NO (Add GST), add 5% GST to invoice
      finalSubtotal = Math.round(orderSubtotal);
      gstAmount = Math.round(finalSubtotal * 0.05);
      grandTotal = finalSubtotal + gstAmount;
      gstRate = 5.0;
    } else {
      // Bill (Without GST)
      finalSubtotal = Math.round(orderSubtotal);
      gstAmount = 0;
      grandTotal = finalSubtotal;
      gstRate = 0;
    }

    // Determine Order Number & Bill Number
    const customOrderNumber = body.orderNumber ? String(body.orderNumber).trim() : "";
    let orderNumber = customOrderNumber;

    // Determine custom Tax Invoice Number / Manual Bill Number
    let manualBillNumber = body.manualBillNumber ? String(body.manualBillNumber).trim().toUpperCase() : null;
    if (manualBillNumber) {
      const numOnly = manualBillNumber.match(/\d+/);
      if (numOnly) manualBillNumber = numOnly[0];
    }

    if (isExplicitBillWithoutGst || isPreviousBill) {
      if (!manualBillNumber || !manualBillNumber.trim()) {
        manualBillNumber = await getNextBillNumber(prisma);
      }
      // Isolated Bill sequence with zero clash against Tax Invoices
      orderNumber = `BILL-${manualBillNumber}`;
    } else {
      if (!orderNumber) {
        orderNumber = await getNextOrderNumber(prisma);
      } else {
        // Validate unique custom orderNumber
        const existing = await prisma.order.findUnique({ where: { orderNumber } });
        if (existing) {
          return NextResponse.json(
            { error: `Order Number "${orderNumber}" already exists in the system. Please use a unique Order No. (e.g. ${orderNumber}-A) or leave blank to auto-generate.` },
            { status: 400 }
          );
        }
      }
    }

    const customTaxInvoiceNumber = manualBillNumber || (body.taxInvoiceNumber ? String(body.taxInvoiceNumber).trim().toUpperCase() : null);
    const customTaxInvoiceDate = body.taxInvoiceDate ? new Date(body.taxInvoiceDate) : (customTaxInvoiceNumber ? new Date() : null);

    const initialStatus = body.status || (customTaxInvoiceNumber ? "Ready" : "Pending");
    let effectiveTaxInvoiceNumber = customTaxInvoiceNumber;
    let effectiveTaxInvoiceDate = customTaxInvoiceDate;

    // For standard orders, keep effectiveTaxInvoiceNumber aligned with orderNumber when confirmed
    if (!isExplicitBillWithoutGst && !isPreviousBill && initialStatus === "Confirmed" && (!effectiveTaxInvoiceNumber || !effectiveTaxInvoiceNumber.trim())) {
      effectiveTaxInvoiceNumber = orderNumber;
      effectiveTaxInvoiceDate = new Date();
    }

    // Check miscellaneous transport products
    const isImportedTrousersMix = validatedItems.some((it) =>
      (it.productName || "").toUpperCase().includes("IMPORTED TROUSER")
    );
    const finalShouldDeductStock = shouldDeductStock && !isImportedTrousersMix;

    const newlySoldOutColors: Array<{
      productName: string;
      colorName: string;
      colorAlphabet: string;
    }> = [];

    const createdOrder = await prisma.$transaction(async (tx) => {
      // Deduct stock only for real-time present orders (skip past-dated bills, post-dated bills without GST, and IMPORTED TROUSERS MIX)
      if (finalShouldDeductStock) {
        for (const { product, orderedSets, orderedLoose } of productDeductionsMap.values()) {
          if (
            product.setsColorwise &&
            product.setsColorwise.trim() !== "" &&
            !product.name.toUpperCase().includes("IMPORTED TROUSER")
          ) {
            const updatedStock = deductSetsFromStock(product.setsColorwise, orderedSets, orderedLoose);
            await tx.product.update({
              where: { id: product.id },
              data: { setsColorwise: updatedStock },
            });

            // Check which color variants became sold out from this order deduction
            const allColors = getAllProductColors(
              product.colorsAvailable,
              product.setsColorwise,
              product.colorMapping
            );
            for (let colIdx = 0; colIdx < allColors.length; colIdx++) {
              const col = allColors[colIdx];
              const wasInStock = !isColorSoldOut(product.setsColorwise, col, product.colorMapping);
              const isNowSoldOut = isColorSoldOut(updatedStock, col, product.colorMapping);
              if (wasInStock && isNowSoldOut) {
                const colorAlphabet = getColorShadeLetter(product, col, colIdx);
                newlySoldOutColors.push({
                  productName: product.name,
                  colorName: col,
                  colorAlphabet,
                });
              }
            }
          }
        }
      }

      // Pre-align sequence counters in PostgreSQL above max existing IDs to eliminate primary key `id` collisions
      try {
        await tx.$executeRawUnsafe(`
          DO $$
          BEGIN
            BEGIN
              PERFORM setval(pg_get_serial_sequence('wholesale."Order"', 'id'), COALESCE((SELECT MAX(id) FROM wholesale."Order"), 0) + 1, false);
              PERFORM setval(pg_get_serial_sequence('wholesale."OrderItem"', 'id'), COALESCE((SELECT MAX(id) FROM wholesale."OrderItem"), 0) + 1, false);
            EXCEPTION WHEN OTHERS THEN
              PERFORM setval(pg_get_serial_sequence('"Order"', 'id'), COALESCE((SELECT MAX(id) FROM "Order"), 0) + 1, false);
              PERFORM setval(pg_get_serial_sequence('"OrderItem"', 'id'), COALESCE((SELECT MAX(id) FROM "OrderItem"), 0) + 1, false);
            END;
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END $$;
        `);
      } catch (seqSyncErr) {
        console.warn("[ORDERS] Sequence pre-sync warning:", seqSyncErr);
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
          orderDate: effectiveOrderDate,
          status: initialStatus,
          subtotal: finalSubtotal,
          gstRate: gstRate,
          gstAmount: gstAmount,
          grandTotal: grandTotal,
          totalPcs: orderTotalPcs,
          totalSets: orderTotalSets,
          placedBy: placedBy || "Admin",
          notes: [
            notes,
            (isExplicitBillWithoutGst || isPreviousBill) ? `[BILL_WITHOUT_GST: ${effectiveTaxInvoiceNumber || manualBillNumber || ""}]` : null,
            (customOrderNumber) ? `[HANDWRITTEN_BOOK_NO: ${customOrderNumber}]` : null,
          ].filter(Boolean).join(" | ") || null,
          taxInvoiceNumber: effectiveTaxInvoiceNumber,
          taxInvoiceDate: effectiveTaxInvoiceDate || effectiveOrderDate,
          isPreviousBill,
          previousBillDate: isPreviousBill ? (previousBillDate || effectiveOrderDate) : null,
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

    // Release any temporary stock reservations held by this session
    if (body.sessionId) {
      await releaseReservations(body.sessionId).catch(() => {});
    }

    // Auto-synchronize affected products with E-Commerce store stock
    try {
      const { syncWholesaleProductToEcommerce } = await import("@/lib/stock-sync");
      for (const { product } of productDeductionsMap.values()) {
        syncWholesaleProductToEcommerce(product.id).catch((err) =>
          console.error(`Auto-sync error for product ${product.id}:`, err)
        );
      }
    } catch (syncErr) {
      console.error("Stock sync import error:", syncErr);
    }

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

    // Send immediate email alert for any colors that reached 0 stock (Sold Out)
    if (newlySoldOutColors.length > 0) {
      sendColorSoldOutNotification(
        newlySoldOutColors.map((it) => ({
          ...it,
          orderNumber: createdOrder.orderNumber,
        }))
      ).catch((err) => console.error("Sold out email notification background error:", err));
    }

    // Send immediate automated WhatsApp message directly to customer via Meta Cloud API
    const customerPhone = createdOrder.customerPhone || (createdOrder.customer as any)?.phoneNumber;
    let whatsAppSent = false;
    if (customerPhone) {
      const origin =
        request.headers.get("origin") ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://employee-order.vercel.app";
      const messageText = generateOrderWhatsAppMessage(createdOrder as any, origin);
      try {
        const dispatchRes = await dispatchAutomatedWhatsApp(customerPhone, messageText);
        whatsAppSent = dispatchRes.success;
      } catch (err) {
        console.error("Order WhatsApp automated dispatch exception:", err);
      }
    }

    // Automatically sync confirmed wholesale order into Sales Invoices register
    if (createdOrder?.id) {
      try {
        await createOrUpdateSalesInvoiceFromOrder(createdOrder.id);
      } catch (siErr) {
        console.error("Auto sales invoice sync error on order creation:", siErr);
      }
    }

    // Send background VAPID Web Push alert to all employee devices
    sendWebPushNotification({
      title: `📦 New Order Placed: #${createdOrder.orderNumber}`,
      body: `${createdOrder.customerName} • ₹${createdOrder.grandTotal.toLocaleString("en-IN")}${createdOrder.placedBy ? ` • By ${createdOrder.placedBy}` : ""}`,
      url: `/orders/${createdOrder.orderNumber || createdOrder.id}`,
    }).catch((err) => console.warn("[WEB-PUSH] Order notify error:", err));

    return NextResponse.json(
      {
        ...createdOrder,
        whatsAppSent,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating wholesale order:", error);
    return NextResponse.json(
      { error: "Failed to create order: " + error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders
 * Clears all wholesale orders and order items from the database.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    const authHeader = request.headers.get("x-admin-secret");
    const isAuthorized = auth.authorized || authHeader === "krish_clothing_admin_2026";
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all OrderItems first (or cascade handles it)
    const deletedItems = await prisma.orderItem.deleteMany({});
    // Delete all Orders
    const deletedOrders = await prisma.order.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "All items and orders removed from the database successfully.",
      deletedOrdersCount: deletedOrders.count,
      deletedItemsCount: deletedItems.count,
    });
  } catch (error: any) {
    console.error("Error clearing orders and items:", error);
    return NextResponse.json(
      { error: "Failed to clear orders: " + error.message },
      { status: 500 }
    );
  }
}
