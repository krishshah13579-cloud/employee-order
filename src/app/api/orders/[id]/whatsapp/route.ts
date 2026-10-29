import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generateOrderWhatsAppMessage,
  generateTaxInvoiceWhatsAppMessage,
  generatePaymentReminderWhatsAppMessage,
  createWhatsAppDirectLink,
  createWhatsAppNativeLink,
  dispatchAutomatedWhatsApp,
} from "@/lib/whatsapp";
import { generateOrderPdfBuffer } from "@/lib/pdf-generator";

import { getAdminSession, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
import { sanitizePositiveInt } from "@/lib/navigation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized. Please log in to dispatch WhatsApp messages." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const messageType = body.type || "ORDER_CONFIRMATION"; // ORDER_CONFIRMATION | TAX_INVOICE | PAYMENT_REMINDER
    const formatType = body.formatType || (messageType === "TAX_INVOICE" ? "tax_invoice" : "order_form");

    const orderId = sanitizePositiveInt(id);
    const isExplicitBillId = id.toUpperCase().startsWith("BILL-");
    const rawBillNum = id.replace(/^BILL-/i, "").trim();

    // 1. Look up by official document number first
    let order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: id },
          { taxInvoiceNumber: id },
          ...(isExplicitBillId ? [{ orderNumber: id }] : []),
          ...(rawBillNum ? [{ orderNumber: `BILL-${rawBillNum}` }, { taxInvoiceNumber: rawBillNum }] : []),
        ],
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // 2. Fallback to internal database primary key if not found by document number
    if (!order && orderId) {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true,
        },
      });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Role-based IDOR Defense
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah && employee) {
      const empName = (employee.name || "").trim().toLowerCase();
      const placedBy = (order.placedBy || "").trim().toLowerCase();
      const custAllocatedEmpId = order.customer?.allocatedEmployeeId;
      const custAllocatedEmpName = (order.customer?.allocatedEmployeeName || "").trim().toLowerCase();

      const isMyOrder = placedBy === empName;
      const isMyAllocatedCustomer =
        (custAllocatedEmpId && custAllocatedEmpId === employee.id) ||
        (custAllocatedEmpName && custAllocatedEmpName === empName);

      if (!isMyOrder && !isMyAllocatedCustomer) {
        return NextResponse.json(
          { error: "Forbidden: You cannot dispatch WhatsApp messages for another employee's order." },
          { status: 403 }
        );
      }
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
    const docNo = (isTaxInvoice && order.taxInvoiceNumber ? order.taxInvoiceNumber : order.orderNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
    let pdfFilename = `${isTaxInvoice ? "Tax_Invoice" : "Order_Form"}_${docNo}.pdf`;
    let pdfBase64: string | undefined = undefined;

    try {
      const pdfRes = await generateOrderPdfBuffer(order.id, isTaxInvoice ? "TAX_INVOICE" : "ORDER_FORM");
      pdfBase64 = pdfRes.pdfBuffer.toString("base64");
      pdfFilename = pdfRes.fileName;
    } catch (pdfErr) {
      console.warn("Could not generate in-memory PDF buffer for order WhatsApp:", pdfErr);
    }

    const pdfUrl = `${origin.replace(/\/$/, "")}/api/orders/${order.id}/pdf?type=${pdfDocType}`;

    if (messageType === "PAYMENT_REMINDER") {
      messageText = generatePaymentReminderWhatsAppMessage(workingOrder as any, origin);
    } else if (isTaxInvoice) {
      messageText = generateTaxInvoiceWhatsAppMessage(workingOrder as any, origin);
    } else {
      messageText = generateOrderWhatsAppMessage(workingOrder as any, origin);
    }

    // Automated background dispatch with PDF document attachment (base64 directly)
    const autoResult = await dispatchAutomatedWhatsApp(customerPhone, messageText, {
      pdfUrl,
      pdfBase64,
      filename: pdfFilename,
    });

    // Generate direct click URL for instant web/app fallback
    const directLink = createWhatsAppDirectLink(customerPhone, messageText);
    const nativeLink = createWhatsAppNativeLink(customerPhone, messageText);

    return NextResponse.json({
      success: true,
      automated: autoResult.success,
      method: autoResult.method,
      whatsappUrl: directLink,
      nativeUrl: nativeLink,
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
