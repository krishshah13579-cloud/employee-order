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
      orderNumber,
      customerId,
      placedBy,
      notes,
      items,
      orderDate,
      status,
      taxInvoiceNumber,
      taxInvoiceDate,
      taxInvoiceItems,
      templateOverrides,
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

    let targetOrderNumber = existingOrder.orderNumber;
    if (orderNumber && String(orderNumber).trim()) {
      const cleanNum = String(orderNumber).trim();
      if (cleanNum !== existingOrder.orderNumber) {
        const conflict = await prisma.order.findUnique({ where: { orderNumber: cleanNum } });
        if (conflict && conflict.id !== orderId) {
          return NextResponse.json(
            { error: `Order Number "${cleanNum}" is already used by another order.` },
            { status: 400 }
          );
        }
        targetOrderNumber = cleanNum;
      }
    }

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
          orderNumber: targetOrderNumber,
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
          templateOverrides:
            templateOverrides !== undefined
              ? typeof templateOverrides === "string"
                ? templateOverrides
                : JSON.stringify(templateOverrides)
              : (existingOrder as any).templateOverrides,
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

    // Determine whether to restore stock:
    // Support URL param ?restoreStock=true/false
    // Support JSON body { restoreStock: true/false }
    let restoreStock = true;
    const url = new URL(_request.url);
    if (url.searchParams.has("restoreStock")) {
      restoreStock = url.searchParams.get("restoreStock") !== "false";
    } else {
      try {
        const body = await _request.json();
        if (typeof body.restoreStock === "boolean") {
          restoreStock = body.restoreStock;
        }
      } catch {
        // No JSON body provided, default to true
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 1. Preserve any generated Tax Invoice in Sales Register!
    // If taxInvoiceNumber was assigned, ensure a SalesInvoice record exists before deleting the order
    if (order.taxInvoiceNumber) {
      try {
        const existingInvoice = await prisma.salesInvoice.findFirst({
          where: {
            OR: [
              { orderId: order.id },
              { invoiceNumber: order.taxInvoiceNumber },
            ],
          },
        });
        if (!existingInvoice) {
          await createOrUpdateSalesInvoiceFromOrder(order.id);
        }
      } catch (invErr) {
        console.error("Error ensuring sales invoice before order delete:", invErr);
      }
    }

    // Detach any linked SalesInvoice records so they are safely preserved in Sales Register
    try {
      await prisma.salesInvoice.updateMany({
        where: { orderId: order.id },
        data: {
          orderId: null,
          notes: order.orderNumber ? `Origin Order Form: ${order.orderNumber} (Order form deleted)` : undefined,
        },
      });
    } catch (detachErr) {
      console.error("Error detaching sales invoice from order:", detachErr);
    }

    // 2. If restoreStock is requested, restore the stock sets back to product setsColorwise
    if (restoreStock && order.items && order.items.length > 0) {
      const productItemsMap = new Map<number, { color: string; sets: number; ratio?: string }[]>();

      for (const item of order.items) {
        if (!productItemsMap.has(item.productId)) {
          productItemsMap.set(item.productId, []);
        }

        let colorSetsList: { color: string; sets: number }[] = [];
        try {
          if (typeof item.colorSets === "string") {
            colorSetsList = JSON.parse(item.colorSets);
          } else if (Array.isArray(item.colorSets)) {
            colorSetsList = item.colorSets;
          }
        } catch {
          colorSetsList = [];
        }

        if (Array.isArray(colorSetsList) && colorSetsList.length > 0) {
          for (const cs of colorSetsList) {
            const numSets = parseInt(String(cs.sets), 10) || 0;
            if (numSets > 0 && cs.color) {
              productItemsMap.get(item.productId)!.push({
                color: cs.color,
                sets: numSets,
                ratio: item.sizeRatio,
              });
            }
          }
        } else if (item.totalSets > 0) {
          productItemsMap.get(item.productId)!.push({
            color: "Standard",
            sets: item.totalSets,
            ratio: item.sizeRatio,
          });
        }
      }

      // Perform stock restoration for each affected product
      for (const [productId, returnedSets] of productItemsMap.entries()) {
        if (returnedSets.length === 0) continue;
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, setsColorwise: true },
        });

        if (product && product.setsColorwise && product.setsColorwise.trim() !== "") {
          const { restoreSetsToStock } = await import("@/lib/stock");
          const updatedStock = restoreSetsToStock(product.setsColorwise, returnedSets);
          await prisma.product.update({
            where: { id: productId },
            data: { setsColorwise: updatedStock },
          });
        }
      }
    }

    // 3. Delete the order (Prisma cascades deletion to OrderItem)
    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({
      message: restoreStock
        ? "Order deleted and stock added back to inventory successfully"
        : "Order form deleted successfully (stock unchanged)",
      id: orderId,
      stockRestored: restoreStock,
    });
  } catch (error: any) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order: " + error.message }, { status: 500 });
  }
}
