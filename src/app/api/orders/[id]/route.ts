import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, requireAdmin } from "@/lib/auth-security";
import { calculateOrderedColorSetsPieces } from "@/lib/stock";
import { createOrUpdateSalesInvoiceFromOrder } from "@/lib/sales";

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
    const {
      customerId,
      placedBy,
      notes,
      items,
      orderDate,
      status,
      taxInvoiceNumber,
      taxInvoiceDate,
      taxInvoiceItems,
    } = body;

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
        const rawPid = parseInt(String(it.productId), 10);
        let product = !isNaN(rawPid) && rawPid > 0
          ? await prisma.product.findUnique({
              where: { id: rawPid },
            })
          : null;

        // If product not found by id, try find by name
        if (!product && it.productName) {
          product = await prisma.product.findFirst({
            where: { name: it.productName },
          });
        }

        // Guaranteed valid foreign key product ID
        let targetPid = product ? product.id : (!isNaN(rawPid) && rawPid > 0 ? rawPid : 0);
        if (targetPid <= 0) {
          const firstP = await prisma.product.findFirst({ select: { id: true } });
          targetPid = firstP?.id || 1;
        }

        const pcsPerSet = parseInt(String(it.pcsPerSet), 10) || product?.pcsPerSet || 5;

        let colorSetsArray: any[] = [];
        if (Array.isArray(it.colorSets)) {
          colorSetsArray = it.colorSets;
        } else if (typeof it.colorSets === "string") {
          try {
            const p = JSON.parse(it.colorSets);
            if (Array.isArray(p)) colorSetsArray = p;
          } catch {
            colorSetsArray = [];
          }
        }

        let itemTotalSets = colorSetsArray.reduce(
          (sum: number, cs: any) => sum + (parseInt(String(cs.sets), 10) || 0),
          0
        );

        if (itemTotalSets === 0) {
          if (it.totalSets) {
            itemTotalSets = parseInt(String(it.totalSets), 10) || 1;
          } else if (it.quantity) {
            itemTotalSets = Math.max(1, Math.round(parseInt(String(it.quantity), 10) / pcsPerSet));
          } else {
            itemTotalSets = 1;
          }
          colorSetsArray = [{ color: it.color || "Standard", sets: itemTotalSets }];
        }

        let itemTotalPcs = 0;
        for (const cs of colorSetsArray) {
          const requested = parseInt(String(cs.sets), 10) || 0;
          const pcsCalc = calculateOrderedColorSetsPieces(
            product ? product.setsColorwise : null,
            cs.color,
            requested,
            pcsPerSet
          );
          itemTotalPcs += pcsCalc.totalPcs;
        }
        if (itemTotalPcs === 0) {
          itemTotalPcs = Number(it.totalPcs) || (itemTotalSets * pcsPerSet);
        }

        const unitPrice = parseFloat(String(it.unitPrice)) || product?.price || 0;
        const itemSubtotal = itemTotalPcs * unitPrice;

        orderSubtotal += itemSubtotal;
        orderTotalPcs += itemTotalPcs;
        orderTotalSets += itemTotalSets;

        validatedItems.push({
          orderId,
          productId: targetPid,
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
          taxInvoiceNumber:
            taxInvoiceNumber !== undefined
              ? taxInvoiceNumber
                ? String(taxInvoiceNumber).trim().toUpperCase()
                : null
              : existingOrder.taxInvoiceNumber,
          taxInvoiceDate:
            taxInvoiceDate !== undefined
              ? taxInvoiceDate
                ? new Date(taxInvoiceDate)
                : null
              : existingOrder.taxInvoiceDate,
          taxInvoiceItems:
            taxInvoiceItems !== undefined
              ? typeof taxInvoiceItems === "string"
                ? taxInvoiceItems
                : JSON.stringify(taxInvoiceItems)
              : existingOrder.taxInvoiceItems,
        },
        include: {
          customer: true,
          items: true,
        },
      });
    });

    // Automatically sync updated confirmed order to Sales Register
    await createOrUpdateSalesInvoiceFromOrder(orderId);

    // Automated WhatsApp trigger on status change or order edit for Confirmed / Ready
    const effectiveStatus = updatedOrder.status;
    const customerPhone = updatedOrder.customerPhone || updatedOrder.customer?.phoneNumber;
    let whatsappPayload: any = null;

    const shouldNotify = Boolean(
      body.notifyCustomer ||
      (status && status !== existingOrder.status) ||
      ((effectiveStatus === "Confirmed" || effectiveStatus === "Ready") && body.sendWhatsApp !== false)
    );

    if (customerPhone && shouldNotify) {
      try {
        const origin =
          request.headers.get("origin") ||
          request.headers.get("referer")?.replace(/\/admin.*$/, "") ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://krish-clothing.vercel.app";

        const {
          generateOrderStatusUpdateWhatsAppMessage,
          dispatchAutomatedWhatsApp,
          createWhatsAppDirectLink,
          createWhatsAppNativeLink,
        } = await import("@/lib/whatsapp");

        const statusMsgConfig = generateOrderStatusUpdateWhatsAppMessage(
          updatedOrder as any,
          effectiveStatus,
          origin
        );

        const effectivePdfUrl = statusMsgConfig.hasDocument ? statusMsgConfig.pdfUrl : undefined;
        const effectiveFilename = statusMsgConfig.hasDocument ? statusMsgConfig.filename : undefined;

        const autoResult = await dispatchAutomatedWhatsApp(customerPhone, statusMsgConfig.message, {
          pdfUrl: effectivePdfUrl,
          filename: effectiveFilename || "Invoice.pdf",
        }).catch((err) => ({ success: false, method: "ERROR", error: err.message }));

        whatsappPayload = {
          customerPhone,
          message: statusMsgConfig.message,
          pdfUrl: effectivePdfUrl,
          filename: effectiveFilename,
          hasDocument: statusMsgConfig.hasDocument,
          directUrl: createWhatsAppDirectLink(customerPhone, statusMsgConfig.message),
          nativeUrl: createWhatsAppNativeLink(customerPhone, statusMsgConfig.message),
          dispatchedByServer: autoResult.success,
          dispatchMethod: autoResult.method,
        };
      } catch (waErr) {
        console.error("Auto WhatsApp notification error in order update:", waErr);
      }
    }

    return NextResponse.json({
      ...updatedOrder,
      whatsapp: whatsappPayload,
    });
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
