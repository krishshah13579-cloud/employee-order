import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";
import { generateCustomerLedgerPdfBuffer } from "@/lib/pdf-generator";
import { dispatchAutomatedWhatsApp } from "@/lib/whatsapp";
import { formatDate, formatCurrency, numberToIndianWords } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId } = await params;
    const cid = parseInt(customerId, 10);
    if (isNaN(cid)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const formatType: "format1" | "format2" = body.formatType === "format2" ? "format2" : "format1";

    const customer = await prisma.customer.findUnique({
      where: { id: cid },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const customerPhone = customer.phoneNumber;
    if (!customerPhone || customerPhone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "Customer does not have a valid 10-digit phone number registered" },
        { status: 400 }
      );
    }

    // 1. Generate the PDF Document Buffer in memory
    const { pdfBuffer, fileName, customerName } = await generateCustomerLedgerPdfBuffer(cid, formatType);
    const pdfBase64 = pdfBuffer.toString("base64");

    // 2. Compose professional WhatsApp message
    let messageText = "";
    if (formatType === "format1") {
      messageText =
        `🔔 *KRISH CLOTHING CO.* — Outstanding Payment Reminder\n\n` +
        `Dear *${customer.shopName.toUpperCase()}*,\n` +
        `Please find attached your official *Statement of Pending & Partly Paid Bills* as on ${formatDate(new Date())}.\n\n` +
        `📄 *Attached PDF:* ${fileName}\n` +
        `_Note: The bills that are partly paid (Amount left after Deducting the amount received) and not paid bills are shown in the attached statement._\n\n` +
        `🏦 *Bank Account Details for Payment (RTGS / NEFT / IMPS):*\n` +
        `• *Bank:* ICICI BANK\n` +
        `• *Account No:* 750705000692\n` +
        `• *IFSC Code:* ICIC0007507\n` +
        `• *Beneficiary:* KRISH CLOTHING CO.\n` +
        `• *Branch:* Khokhra Maninagar, Ahmedabad\n\n` +
        `Kindly remit the pending balance at your earliest convenience.\n` +
        `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`;
    } else {
      messageText =
        `📊 *KRISH CLOTHING CO.* — Statement of Account / Ledger\n\n` +
        `Dear *${customer.shopName.toUpperCase()}*,\n` +
        `Please find attached your complete *Statement of Account* as on ${formatDate(new Date())}.\n\n` +
        `📄 *Attached PDF:* ${fileName}\n\n` +
        `🏦 *Bank Account Details for Payment:*\n` +
        `• *Bank:* ICICI BANK\n` +
        `• *Account No:* 750705000692\n` +
        `• *IFSC Code:* ICIC0007507\n` +
        `• *Beneficiary:* KRISH CLOTHING CO.\n\n` +
        `For any queries regarding this statement, please contact 8128756632.\n` +
        `_Krish Clothing Co., Ahmedabad_`;
    }

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
      customerName: customer.shopName,
    });
  } catch (error: any) {
    console.error("Error generating and sending ledger PDF via WhatsApp:", error);
    return NextResponse.json(
      { error: "Failed to dispatch ledger via WhatsApp: " + error.message },
      { status: 500 }
    );
  }
}
