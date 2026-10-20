import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ORDER_STATUSES, OrderStatus } from "@/lib/types";
import { restoreSetsToStock, deductSetsFromStock } from "@/lib/stock";
import { getAdminSession, getEmployeeSession } from "@/lib/auth-security";
import { createOrUpdateSalesInvoiceFromOrder } from "@/lib/sales";
import { recordAuditLog } from "@/lib/audit";
import { getNextTaxInvoiceNumber } from "@/lib/order-numbers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = !admin ? await getEmployeeSession(request) : null;

    if (!admin && !employee) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to update order status." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values are: ${ORDER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (status === "Confirmed" && !admin) {
      return NextResponse.json(
        { error: "Permission Denied: Only Admin or Super Admin can confirm orders." },
        { status: 403 }
      );
    }

    // Fetch existing order with items to handle stock adjustment
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 1. If cancelling order, restore stock sets back to inventory
    if (status === "Cancelled" && existingOrder.status !== "Cancelled") {
      for (const item of existingOrder.items) {
        if (item.productId && item.colorSets) {
          try {
            const parsed = JSON.parse(item.colorSets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, setsColorwise: true },
              });
              if (product && product.setsColorwise) {
                const restored = restoreSetsToStock(product.setsColorwise, parsed);
                await prisma.product.update({
                  where: { id: product.id },
                  data: { setsColorwise: restored },
                });
              }
            }
          } catch (e) {
            console.error("Error restoring stock sets on cancellation:", e);
          }
        }
      }
    }

    // 2. If un-cancelling order, re-deduct stock
    if (existingOrder.status === "Cancelled" && status !== "Cancelled") {
      for (const item of existingOrder.items) {
        if (item.productId && item.colorSets) {
          try {
            const parsed = JSON.parse(item.colorSets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, setsColorwise: true },
              });
              if (product && product.setsColorwise) {
                const deducted = deductSetsFromStock(product.setsColorwise, parsed);
                await prisma.product.update({
                  where: { id: product.id },
                  data: { setsColorwise: deducted },
                });
              }
            }
          } catch (e) {
            console.error("Error re-deducting stock sets:", e);
          }
        }
      }
    }

    let autoTaxInvoiceNumber = existingOrder.taxInvoiceNumber;
    let autoTaxInvoiceDate = existingOrder.taxInvoiceDate;

    if (status === "Confirmed" && (!autoTaxInvoiceNumber || !autoTaxInvoiceNumber.trim())) {
      autoTaxInvoiceNumber = await getNextTaxInvoiceNumber();
      autoTaxInvoiceDate = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(autoTaxInvoiceNumber ? { taxInvoiceNumber: autoTaxInvoiceNumber } : {}),
        ...(autoTaxInvoiceDate ? { taxInvoiceDate: autoTaxInvoiceDate } : {}),
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // Automatically send/sync confirmed order to Sales Register
    await createOrUpdateSalesInvoiceFromOrder(orderId);

    const invoiceGenNote =
      autoTaxInvoiceNumber && autoTaxInvoiceNumber !== existingOrder.taxInvoiceNumber
        ? ` (Auto-generated Tax Invoice #${autoTaxInvoiceNumber})`
        : "";

    await recordAuditLog({
      action: "ORDER_STATUS_CHANGED",
      actorType: admin ? "ADMIN" : "EMPLOYEE",
      actorName: admin?.username || employee?.name || "Staff",
      entityType: "Order",
      entityId: orderId,
      details: `Order #${existingOrder.orderNumber} status transitioned from "${existingOrder.status}" to "${status}"${invoiceGenNote}`,
      status: "SUCCESS",
    });

    // Automated WhatsApp trigger on status change
    const customerPhone = updatedOrder.customerPhone || updatedOrder.customer?.phoneNumber;
    let whatsappPayload: any = null;

    if (customerPhone) {
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
          status,
          origin
        );

        const effectivePdfUrl = statusMsgConfig.hasDocument ? statusMsgConfig.pdfUrl : undefined;
        let effectiveFilename = statusMsgConfig.hasDocument ? statusMsgConfig.filename : undefined;
        let pdfBase64: string | undefined = undefined;

        if (statusMsgConfig.hasDocument) {
          try {
            const { generateOrderPdfBuffer } = await import("@/lib/pdf-generator");
            const pdfRes = await generateOrderPdfBuffer(
              orderId,
              statusMsgConfig.pdfType === "tax_invoice" ? "TAX_INVOICE" : "ORDER_FORM"
            );
            pdfBase64 = pdfRes.pdfBuffer.toString("base64");
            effectiveFilename = pdfRes.fileName;
          } catch (pdfErr) {
            console.warn("Could not generate PDF buffer for status update WhatsApp:", pdfErr);
          }
        }

        // Run automated dispatch with base64 PDF attachment directly
        const autoResult = await dispatchAutomatedWhatsApp(customerPhone, statusMsgConfig.message, {
          pdfUrl: effectivePdfUrl,
          pdfBase64,
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
        console.error("Auto WhatsApp notification error:", waErr);
      }
    }

    return NextResponse.json({
      ...updatedOrder,
      whatsapp: whatsappPayload,
    });
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: "Failed to update order status: " + error.message }, { status: 500 });
  }
}
