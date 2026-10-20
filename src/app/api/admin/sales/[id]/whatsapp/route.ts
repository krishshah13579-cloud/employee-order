import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";
import { generateSalesInvoicePdfBuffer } from "@/lib/pdf-generator";
import { dispatchAutomatedWhatsApp } from "@/lib/whatsapp";
import { formatDate, formatCurrency } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invId = parseInt(id, 10);
    if (isNaN(invId)) {
      return NextResponse.json({ error: "Invalid sales invoice ID" }, { status: 400 });
    }

    const inv = await prisma.salesInvoice.findUnique({
      where: { id: invId },
      include: {
        customer: true,
      },
    });

    if (!inv) {
      return NextResponse.json({ error: "Sales Invoice not found" }, { status: 404 });
    }

    const customerPhone = inv.customerPhone || inv.customer?.phoneNumber;
    if (!customerPhone || customerPhone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "Customer does not have a valid 10-digit phone number registered" },
        { status: 400 }
      );
    }

    // 1. Generate Sales Tax Invoice PDF Buffer in memory
    const { pdfBuffer, fileName } = await generateSalesInvoicePdfBuffer(invId);
    const pdfBase64 = pdfBuffer.toString("base64");

    // 2. Compose professional WhatsApp message
    const messageText =
      `📄 *KRISH CLOTHING CO.* — Tax Invoice #${inv.invoiceNumber}\n\n` +
      `Dear *${inv.customerName.toUpperCase()}*,\n` +
      `Please find attached your official *Tax Invoice* from Krish Clothing Co. dated ${formatDate(inv.invoiceDate)}.\n\n` +
      `📋 *Invoice Summary:*\n` +
      `• *Invoice No:* #${inv.invoiceNumber}\n` +
      `• *Date:* ${formatDate(inv.invoiceDate)}\n` +
      `• *Total Sets:* ${inv.totalSets} Sets (${inv.totalPcs} Pieces)\n` +
      `• *Total Bill Amount:* ₹${inv.grandTotal.toLocaleString("en-IN")}\n` +
      `• *Payment Mode:* ${inv.paymentType} (${inv.paymentStatus})\n\n` +
      `🏦 *Bank Account Details for Payment (RTGS / NEFT / IMPS):*\n` +
      `• *Bank:* ICICI BANK\n` +
      `• *Account No:* 750705000692\n` +
      `• *IFSC Code:* ICIC0007507\n` +
      `• *Beneficiary:* KRISH CLOTHING CO.\n` +
      `• *Branch:* Khokhra Maninagar, Ahmedabad\n\n` +
      `📄 *Official Tax Invoice Attached (PDF)*\n\n` +
      `Thank you for your business!\n` +
      `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`;

    // 3. Dispatch directly via the WhatsApp Gateway with PDF Base64 attachment
    const autoResult = await dispatchAutomatedWhatsApp(customerPhone, messageText, {
      pdfBase64,
      filename: fileName,
    });

    if (!autoResult.success) {
      return NextResponse.json(
        {
          error:
            autoResult.error ||
            "WhatsApp Gateway is offline or not connected. Please verify gateway status in WhatsApp Gateway tab.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      automated: true,
      method: autoResult.method,
      fileName,
      customerPhone,
      customerName: inv.customerName,
    });
  } catch (error: any) {
    console.error("Error generating and sending sales invoice PDF via WhatsApp:", error);
    return NextResponse.json(
      { error: "Failed to dispatch invoice via WhatsApp: " + error.message },
      { status: 500 }
    );
  }
}
