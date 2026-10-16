import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generateOrderWhatsAppMessage,
  generateTaxInvoiceWhatsAppMessage,
  generatePaymentReminderWhatsAppMessage,
  createWhatsAppDirectLink,
  dispatchAutomatedWhatsApp,
} from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const messageType = body.type || "ORDER_CONFIRMATION"; // ORDER_CONFIRMATION | TAX_INVOICE | PAYMENT_REMINDER
    const formatType = body.formatType || (messageType === "TAX_INVOICE" ? "tax_invoice" : "order_form");

    const orderId = parseInt(id, 10);
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(isNaN(orderId) ? [] : [{ id: orderId }]),
          { orderNumber: id },
        ],
      },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const customerPhone = order.customerPhone || order.customer?.phoneNumber || "";
    if (!customerPhone) {
      return NextResponse.json(
        { error: "Customer does not have a phone number registered" },
        { status: 400 }
      );
    }

    // Determine host URL for invoice link and PDF attachment
    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer")?.replace(/\/admin.*|\/orders.*/, "") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://krish-clothing.vercel.app";

    // If order has updated tax invoice items, recalculate totals for the tax invoice message
    let workingOrder = { ...order };
    if (order.taxInvoiceItems && (messageType === "TAX_INVOICE" || formatType === "tax_invoice")) {
      try {
        const parsed = JSON.parse(order.taxInvoiceItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sets = parsed.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
          const pcs = parsed.reduce((s, it) => s + (Number(it.totalPcs) || 0), 0);
          const subtotal = parsed.reduce((s, it) => s + (Number(it.itemSubtotal) || 0), 0);
          const gstAmount = Math.round(subtotal * 0.05 * 100) / 100;
          const grandTotal = Math.round(subtotal + gstAmount);
          workingOrder = {
            ...workingOrder,
            totalSets: sets,
            totalPcs: pcs,
            subtotal,
            gstAmount,
            grandTotal,
          };
        }
      } catch (e) {
        console.error("Error parsing taxInvoiceItems for WhatsApp:", e);
      }
    }

    let messageText = "";
    const isTaxInvoice = messageType === "TAX_INVOICE" || formatType === "tax_invoice";
    const pdfDocType = isTaxInvoice ? "tax_invoice" : "order_form";
    const pdfUrl = `${origin.replace(/\/$/, "")}/api/orders/${order.id}/pdf?type=${pdfDocType}`;
    const docNo = (isTaxInvoice && order.taxInvoiceNumber ? order.taxInvoiceNumber : order.orderNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
    const pdfFilename = `${isTaxInvoice ? "Tax_Invoice" : "Order_Form"}_${docNo}.pdf`;

    if (messageType === "PAYMENT_REMINDER") {
      messageText = generatePaymentReminderWhatsAppMessage(workingOrder as any, origin);
    } else if (isTaxInvoice) {
      messageText = generateTaxInvoiceWhatsAppMessage(workingOrder as any, origin);
    } else {
      messageText = generateOrderWhatsAppMessage(workingOrder as any, origin);
    }

    // Try automated background dispatch with PDF document attachment
    const autoResult = await dispatchAutomatedWhatsApp(customerPhone, messageText, {
      pdfUrl,
      filename: pdfFilename,
    });

    // Generate direct click URL for instant web/app fallback
    const directLink = createWhatsAppDirectLink(customerPhone, messageText);

    return NextResponse.json({
      success: true,
      automated: autoResult.success,
      method: autoResult.method,
      whatsappUrl: directLink,
      pdfUrl,
      message: messageText,
      customerPhone,
      customerName: order.customerName,
    });
  } catch (error: any) {
    console.error("WhatsApp API error:", error);
    return NextResponse.json(
      { error: "Failed to process WhatsApp request: " + error.message },
      { status: 500 }
    );
  }
}
