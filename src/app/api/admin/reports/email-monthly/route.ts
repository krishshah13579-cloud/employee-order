import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMonthlyOrdersReportEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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

    // Fetch processed orders for the month (exclude Cancelled)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: { not: "Cancelled" },
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let totalRevenue = 0;
    let totalSets = 0;
    let totalPcs = 0;
    let retailerOrdersCount = 0;
    let wholesalerOrdersCount = 0;

    const reportOrders = orders.map((o) => {
      const bType = o.businessType || o.customer?.businessType || "RETAILER";
      const isWholesaler = bType === "WHOLESALER";
      totalRevenue += o.grandTotal || 0;

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
