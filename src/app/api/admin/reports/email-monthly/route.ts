import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMonthlyOrdersReportEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const month = body.month ? parseInt(body.month, 10) : now.getMonth() + 1; // 1-12
    const year = body.year ? parseInt(body.year, 10) : now.getFullYear();
    const profile = await prisma.adminProfile.findFirst({ select: { email: true } });
    const admin = await prisma.adminAccount.findFirst({ select: { username: true } });
    const defaultAdminEmail = profile?.email || admin?.username || process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "";
    const recipientEmail = body.recipientEmail || defaultAdminEmail;

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "No administrator email address found in profile or database." },
        { status: 400 }
      );
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month - 1] || "Current Month";

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const allOrders = await prisma.order.findMany({
      where: {
        status: { not: "Cancelled" },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    const pastDateMap = new Map<string, string>();
    try {
      const { PAST_INVOICES_1_TO_39 } = require("@/lib/pastInvoicesData");
      for (const p of PAST_INVOICES_1_TO_39) {
        pastDateMap.set(String(p.invoiceNumber).trim(), p.date);
      }
    } catch {}

    const orders = allOrders.filter((o) => {
      const invNum = (o.taxInvoiceNumber || "").trim();
      const histStr = invNum ? pastDateMap.get(invNum) : undefined;
      const d = histStr ? new Date(histStr) : (o.taxInvoiceDate || o.orderDate || o.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    let totalRevenue = 0;
    let totalSets = 0;
    let totalPcs = 0;
    let retailerOrdersCount = 0;
    let wholesalerOrdersCount = 0;

    let taxInvoicesCount = 0;
    let taxInvoicesRevenue = 0;
    let billsWithoutGstCount = 0;
    let billsWithoutGstRevenue = 0;

    const reportOrders = orders.map((o) => {
      const bType = o.businessType || o.customer?.businessType || "RETAILER";
      const isWholesaler = bType === "WHOLESALER" || bType === "WHOLESALER WITHOUT GST";
      const orderRevenue = o.grandTotal || 0;
      totalRevenue += orderRevenue;

      // Detect if order is a Bill (Without GST)
      const notes = o.notes || "";
      const billNoMatch = notes.match(/\[BILL_WITHOUT_GST:\s*([^\]]+)\]/i);
      const isBillWithoutGst = Boolean(
        (o as any).isPreviousBill ||
        billNoMatch ||
        notes.includes("[BILL_WITHOUT_GST") ||
        (o.taxInvoiceNumber && o.taxInvoiceNumber.toUpperCase().startsWith("BILL")) ||
        bType.toUpperCase().includes("WITHOUT GST") ||
        bType.toUpperCase().includes("NO GST") ||
        (o.gstRate === 0 && o.gstAmount === 0)
      );

      if (isBillWithoutGst) {
        billsWithoutGstCount++;
        billsWithoutGstRevenue += orderRevenue;
      } else {
        taxInvoicesCount++;
        taxInvoicesRevenue += orderRevenue;
      }

      if (isWholesaler) {
        wholesalerOrdersCount++;
      } else {
        retailerOrdersCount++;
      }

      let orderSets = 0;
      let orderPcs = 0;
      o.items.forEach((it) => {
        const sets = (it as any).totalSets || 0;
        const pcsPerSet = (it as any).pcsPerSet || 5;
        const pcs = (it as any).totalPcs || sets * pcsPerSet;
        orderSets += sets;
        orderPcs += pcs;
        totalSets += sets;
        totalPcs += pcs;
      });

      const extractedBillNo = billNoMatch ? billNoMatch[1].trim() : (isBillWithoutGst ? (o.taxInvoiceNumber || o.orderNumber) : undefined);

      return {
        orderNumber: o.orderNumber,
        customerName: o.customer?.shopName || "Unknown Customer",
        customerGstPan: o.customer?.gstPanNo || "N/A",
        businessType: bType,
        creditDays: o.creditDays ?? o.customer?.creditDays ?? 0,
        totalSets: orderSets,
        totalPcs: orderPcs,
        grandTotal: o.grandTotal,
        status: o.status,
        isBillWithoutGst,
        billNumber: extractedBillNo,
        orderDate: new Date(o.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
    });

    const reportData = {
      monthName,
      year,
      totalOrders: orders.length,
      totalRevenue,
      totalSets,
      totalPcs,
      retailerOrdersCount,
      wholesalerOrdersCount,
      taxInvoicesCount,
      taxInvoicesRevenue,
      billsWithoutGstCount,
      billsWithoutGstRevenue,
      orders: reportOrders,
      generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    };

    const emailResult = await sendMonthlyOrdersReportEmail(reportData, recipientEmail);

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: "Failed to dispatch email: " + emailResult.error,
          summary: reportData,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Monthly report for ${monthName} ${year} sent to ${recipientEmail}`,
      summary: {
        monthName,
        year,
        totalOrders: orders.length,
        totalRevenue,
        totalSets,
        totalPcs,
      },
    });
  } catch (error: any) {
    console.error("Error sending monthly report email:", error);
    return NextResponse.json(
      { error: "Internal error sending monthly report: " + error.message },
      { status: 500 }
    );
  }
}
