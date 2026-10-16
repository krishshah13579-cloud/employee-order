import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, requireAdmin } from "@/lib/auth-security";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order: " + error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await request.json();
    const { customerId, placedBy, notes, items, orderDate, status } = body;

    if (status === "Confirmed" && existingOrder.status !== "Confirmed") {
      const admin = await getAdminSession(request);
      if (!admin) {
        return NextResponse.json(
          { error: "Permission Denied: Only Admin or Super Admin can confirm orders." },
          { status: 403 }
        );
      }
    }

    let targetCustomerId = existingOrder.customerId;
    let targetCustomerName = existingOrder.customerName;
    let targetCustomerGstPan = existingOrder.customerGstPan;
    let targetCustomerPhone = existingOrder.customerPhone;
    let targetCustomerAddress = existingOrder.customerAddress;

    if (customerId) {
      const cust = await prisma.customer.findUnique({
        where: { id: parseInt(customerId, 10) },
      });
      if (cust) {
        targetCustomerId = cust.id;
        targetCustomerName = cust.shopName;
        targetCustomerGstPan = cust.gstPanNo;
        targetCustomerPhone = cust.phoneNumber;
        targetCustomerAddress = cust.address;
      }
    }

    let orderSubtotal = 0;
    let orderTotalPcs = 0;
    let orderTotalSets = 0;
    const validatedItems: any[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const product = await prisma.product.findUnique({
          where: { id: parseInt(it.productId, 10) },
        });

        const pcsPerSet = parseInt(it.pcsPerSet, 10) || product?.pcsPerSet || 5;

        let colorSetsArray = Array.isArray(it.colorSets)
          ? it.colorSets
          : typeof it.colorSets === "string"
          ? JSON.parse(it.colorSets || "[]")
          : [];

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

        const itemTotalPcs = itemTotalSets * pcsPerSet;
        const unitPrice = parseFloat(it.unitPrice) || product?.price || 0;
        const itemSubtotal = itemTotalPcs * unitPrice;

        orderSubtotal += itemSubtotal;
        orderTotalPcs += itemTotalPcs;
        orderTotalSets += itemTotalSets;

        validatedItems.push({
          orderId,
          productId: product ? product.id : it.productId,
          productName: product ? product.name : (it.productName || "Garment"),
          colorSets: JSON.stringify(colorSetsArray),
          sizeRatio: it.sizeRatio || product?.sizesRatio || "Standard",
          sizesList: it.sizesList || product?.sizesList || "Standard",
          pcsPerSet,
          totalSets: itemTotalSets,
          totalPcs: itemTotalPcs,
          unitPrice,
          itemSubtotal,
          notes: it.notes || null,
        });
      }
    }

    const gstRate = 5.0;
    const gstAmount = Math.round(orderSubtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round(orderSubtotal + gstAmount);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (validatedItems.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({ data: validatedItems });
      }

      return await tx.order.update({
        where: { id: orderId },
        data: {
          customerId: targetCustomerId,
          customerName: targetCustomerName,
          customerGstPan: targetCustomerGstPan,
          customerPhone: targetCustomerPhone,
          customerAddress: targetCustomerAddress,
          orderDate: orderDate ? new Date(orderDate) : existingOrder.orderDate,
          status: status || existingOrder.status,
          subtotal: validatedItems.length > 0 ? orderSubtotal : existingOrder.subtotal,
          gstRate,
          gstAmount: validatedItems.length > 0 ? gstAmount : existingOrder.gstAmount,
          grandTotal: validatedItems.length > 0 ? grandTotal : existingOrder.grandTotal,
          totalPcs: validatedItems.length > 0 ? orderTotalPcs : existingOrder.totalPcs,
          totalSets: validatedItems.length > 0 ? orderTotalSets : existingOrder.totalSets,
          placedBy: placedBy !== undefined ? placedBy : existingOrder.placedBy,
          notes: notes !== undefined ? notes : existingOrder.notes,
        },
        include: {
          customer: true,
          items: true,
        },
      });
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order: " + error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(_request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({ message: "Order deleted successfully", id: orderId });
  } catch (error: any) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order: " + error.message }, { status: 500 });
  }
}
