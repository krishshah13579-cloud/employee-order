import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";
import {
  generateCustomerOutstandingWhatsAppMessage,
  createWhatsAppDirectLink,
  createWhatsAppNativeLink,
  dispatchAutomatedWhatsApp,
} from "@/lib/whatsapp";
import { generateCustomerLedgerPdfBuffer } from "@/lib/pdf-generator";

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

    const customer = await prisma.customer.findUnique({
      where: { id: cid },
      include: {
        orders: {
          where: {
            status: { not: "Cancelled" },
          },
          include: {
            items: {
              select: {
                productName: true,
              },
            },
          },
          orderBy: {
            orderDate: "asc",
          },
        },
        payments: true,
        salesReturns: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const isWithoutGstCustomer = (customer.businessType || "").toUpperCase().includes("WITHOUT GST");

    const customerPhone = customer.phoneNumber;
    if (!customerPhone) {
      return NextResponse.json(
        { error: "Customer has no phone number registered" },
        { status: 400 }
      );
    }

    // Calculate bills
    const bills = customer.orders
      .filter((o) => {
        if (isWithoutGstCustomer) {
          const isMix = Boolean(
            (o.notes && o.notes.toUpperCase().includes("IMPORTED TROUSER")) ||
            o.items?.some((it: any) => (it.productName || "").toUpperCase().includes("IMPORTED TROUSER"))
          );
          if (isMix) return false;
        }
        return true;
      })
      .map((o) => {
        let billTotal = o.grandTotal;
        if (o.taxInvoiceItems) {
          try {
            const parsed = JSON.parse(o.taxInvoiceItems);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const subtotal = parsed.reduce((sum, it) => sum + (Number(it.itemSubtotal) || 0), 0);
              const gst = Math.round(subtotal * 0.05 * 100) / 100;
              billTotal = Math.round(subtotal + gst);
            }
          } catch {}
        }

        const bookNoMatch = o.notes?.match(/\[HANDWRITTEN_BOOK_NO:\s*([^\]]+)\]/i);
        const billNoMatch = o.notes?.match(/\[BILL_WITHOUT_GST:\s*([^\]]+)\]/i);
        const handwrittenOrderNo = (bookNoMatch ? bookNoMatch[1].trim() : (o.orderNumber || billNoMatch ? billNoMatch![1].trim() : o.taxInvoiceNumber || `ORD-${o.id}`));

        return {
          id: o.id,
          invoiceNo: handwrittenOrderNo,
          invoiceDate: o.taxInvoiceDate || o.orderDate,
          totalAmount: billTotal,
        };
      });

    const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
    const totalReturns = customer.salesReturns.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalCredits = totalPaid + totalReturns;

    // FIFO allocation
    let remainingCredit = totalCredits;
    const pendingBills: Array<{
      invoiceNo: string;
      invoiceDate: string | Date;
      totalAmount: number;
      balanceAmount: number;
    }> = [];

    bills.forEach((bill) => {
      if (remainingCredit >= bill.totalAmount) {
        remainingCredit -= bill.totalAmount;
      } else if (remainingCredit > 0) {
        const bal = bill.totalAmount - remainingCredit;
        remainingCredit = 0;
        pendingBills.push({
          ...bill,
          balanceAmount: bal,
        });
      } else {
        pendingBills.push({
          ...bill,
          balanceAmount: bill.totalAmount,
        });
      }
    });

    const outstandingBalance = Math.max(0, totalBilled - totalCredits);

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://krish-clothing.vercel.app";

    const messageText = generateCustomerOutstandingWhatsAppMessage(
      {
        customerName: customer.shopName,
        customerPhone: customer.phoneNumber,
        city: customer.city,
        gstPanNo: customer.gstPanNo,
        creditDays: customer.creditDays,
        totalBilled,
        totalPaid,
        totalReturns,
        outstandingBalance,
        pendingBillsCount: pendingBills.length,
        billsSummary: pendingBills,
      },
      origin
    );

    // Generate the official Pending Bills Reminder PDF Document Buffer
    let pdfBase64: string | undefined = undefined;
    let fileName: string = `Statement_${customer.shopName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    try {
      const pdfRes = await generateCustomerLedgerPdfBuffer(cid, "format1");
      pdfBase64 = pdfRes.pdfBuffer.toString("base64");
      fileName = pdfRes.fileName;
    } catch (pdfErr) {
      console.warn("Could not generate PDF buffer for outstanding reminder:", pdfErr);
    }

    const autoResult = await dispatchAutomatedWhatsApp(customerPhone, messageText, {
      pdfBase64,
      filename: fileName,
    });
    const directLink = createWhatsAppDirectLink(customerPhone, messageText);
    const nativeLink = createWhatsAppNativeLink(customerPhone, messageText);

    return NextResponse.json({
      success: true,
      automated: autoResult.success,
      method: autoResult.method,
      fileName,
      whatsappUrl: directLink,
      nativeUrl: nativeLink,
      message: messageText,
      customerName: customer.shopName,
      customerPhone,
      outstandingBalance,
    });
  } catch (error: any) {
    console.error("Error sending customer outstanding reminder:", error);
    return NextResponse.json(
      { error: "Failed to send reminder: " + error.message },
      { status: 500 }
    );
  }
}
