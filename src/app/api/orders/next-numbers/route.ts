import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // 1. Calculate next Order Form number starting from 1
    const allOrders = await prisma.order.findMany({
      select: { orderNumber: true, taxInvoiceNumber: true },
    });

    let maxOrderNum = 0;
    for (const ord of allOrders) {
      const raw = (ord.orderNumber || "").trim();
      // Match pure numbers like "1", "2", "10"
      if (/^\d+$/.test(raw)) {
        const val = parseInt(raw, 10);
        if (val > maxOrderNum) maxOrderNum = val;
      }
    }
    const nextOrderNumber = String(maxOrderNum + 1);

    // 2. Calculate next Tax Invoice number starting from 1
    // Check both Orders and SalesInvoices
    const allSalesInvoices = await prisma.salesInvoice.findMany({
      select: { invoiceNumber: true },
    });

    let maxInvoiceNum = 0;
    for (const ord of allOrders) {
      const raw = (ord.taxInvoiceNumber || "").trim();
      if (/^\d+$/.test(raw)) {
        const val = parseInt(raw, 10);
        if (val > maxInvoiceNum) maxInvoiceNum = val;
      }
    }
    for (const si of allSalesInvoices) {
      const raw = (si.invoiceNumber || "").trim();
      if (/^\d+$/.test(raw)) {
        const val = parseInt(raw, 10);
        if (val > maxInvoiceNum) maxInvoiceNum = val;
      }
    }
    const nextTaxInvoiceNumber = String(maxInvoiceNum + 1);

    return NextResponse.json({
      nextOrderNumber,
      nextTaxInvoiceNumber,
    });
  } catch (error: any) {
    console.error("Error fetching next numbers:", error);
    return NextResponse.json(
      { error: "Failed to calculate next numbers: " + error.message },
      { status: 500 }
    );
  }
}
