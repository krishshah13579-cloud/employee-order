import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);

    // "JUST TEAM LEADER CAN HAVE A LOOK I.E. KRISH SHAH NO OTHER T.L. CAN CHECK ANY OTHER EMPLOYEES DATA."
    if (!admin && !isTLKrishShah) {
      return NextResponse.json(
        { error: "Access Denied: Only Team Leader Krish Shah has access to team member activity." },
        { status: 403 }
      );
    }

    // 1. Fetch active employees (team members)
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobileNumber: true,
        designation: true,
        isTeamLeader: true,
        proofUrl: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    // Filter out Krish Shah from team members list so Krish Shah oversees his team
    const teamMembersList = employees.filter(
      (e) => !e.name.toLowerCase().includes("krish")
    );

    // 2. Fetch all non-cancelled orders for these team members
    const allOrders = await prisma.order.findMany({
      where: {
        status: { not: "Cancelled" },
      },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        customerName: true,
        customerGstPan: true,
        customerPhone: true,
        placedBy: true,
        orderDate: true,
        createdAt: true,
        status: true,
        totalPcs: true,
        totalSets: true,
        subtotal: true,
        grandTotal: true,
        taxInvoiceNumber: true,
        taxInvoiceDate: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. Fetch all customers with payments and invoices
    const allCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        shopName: true,
        gstPanNo: true,
        phoneNumber: true,
        city: true,
        state: true,
        businessType: true,
        creditDays: true,
        allocatedEmployeeId: true,
        allocatedEmployeeName: true,
        salesInvoices: {
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            paymentType: true,
          },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            grandTotal: true,
            status: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            createdAt: true,
          },
          orderBy: { paymentDate: "desc" },
        },
        salesReturns: {
          select: {
            id: true,
            totalAmount: true,
          },
        },
      },
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 4. Build per-member profile
    const membersData = teamMembersList.map((emp) => {
      const cleanEmpName = emp.name.toLowerCase().trim();

      // Orders placed by this member
      const empOrders = allOrders.filter(
        (o) => o.placedBy && o.placedBy.toLowerCase().trim() === cleanEmpName
      );

      const totalOrdersCount = empOrders.length;
      const totalSalesAmount = empOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      const totalPiecesCount = empOrders.reduce((sum, o) => sum + (o.totalPcs || 0), 0);

      // Customers allocated to this member
      const allocatedCusts = allCustomers.filter(
        (c) =>
          c.allocatedEmployeeId === emp.id ||
          (c.allocatedEmployeeName && c.allocatedEmployeeName.toLowerCase().trim() === cleanEmpName)
      );

      let totalAllocatedOutstanding = 0;
      let paymentsReceivedThisWeekCount = 0;
      let totalPaidThisWeek = 0;
      let mostRecentPaymentDate: string | null = null;

      const customerBreakdown = allocatedCusts.map((c) => {
        // Calculate billed amount
        const creditInvoices = c.salesInvoices.filter((si) => si.paymentType !== "Cash");
        const totalBilled = creditInvoices.length > 0
          ? creditInvoices.reduce((s, si) => s + (si.grandTotal || 0), 0)
          : c.orders.filter((o) => o.status !== "Cancelled").reduce((s, o) => s + (o.grandTotal || 0), 0);

        const totalPaid = c.payments.reduce((s, p) => s + (p.amount || 0), 0);
        const totalReturns = c.salesReturns.reduce((s, r) => s + (r.totalAmount || 0), 0);
        const outstanding = Math.max(0, totalBilled - (totalPaid + totalReturns));

        totalAllocatedOutstanding += outstanding;

        // Check payments received in last 7 days
        const recentPayments = c.payments.filter((p) => {
          const pDate = new Date(p.paymentDate || p.createdAt);
          return pDate >= sevenDaysAgo;
        });

        if (recentPayments.length > 0) {
          paymentsReceivedThisWeekCount += recentPayments.length;
          totalPaidThisWeek += recentPayments.reduce((s, p) => s + (p.amount || 0), 0);
        }

        if (c.payments.length > 0) {
          const lastP = c.payments[0];
          const lastDate = new Date(lastP.paymentDate || lastP.createdAt).toISOString();
          if (!mostRecentPaymentDate || lastDate > mostRecentPaymentDate) {
            mostRecentPaymentDate = lastDate;
          }
        }

        return {
          id: c.id,
          shopName: c.shopName,
          phoneNumber: c.phoneNumber,
          city: c.city || "—",
          businessType: c.businessType,
          creditDays: c.creditDays || 0,
          outstanding,
          paymentsThisWeek: recentPayments.length > 0,
          lastPaymentDate: c.payments.length > 0 ? (c.payments[0].paymentDate || c.payments[0].createdAt) : null,
        };
      });

      // Weekly payment status
      let weeklyPaymentStatus: "PAYMENT_RECEIVED" | "PENDING_PAYMENT" | "NO_OUTSTANDING" = "NO_OUTSTANDING";
      if (totalAllocatedOutstanding > 0) {
        weeklyPaymentStatus = paymentsReceivedThisWeekCount > 0 ? "PAYMENT_RECEIVED" : "PENDING_PAYMENT";
      }

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        mobileNumber: emp.mobileNumber,
        designation: emp.designation,
        isTeamLeader: emp.isTeamLeader,
        proofUrl: emp.proofUrl,
        totalOrdersCount,
        totalSalesAmount,
        totalPiecesCount,
        allocatedCustomersCount: allocatedCusts.length,
        totalAllocatedOutstanding,
        weeklyPaymentStatus,
        paymentsReceivedThisWeekCount,
        totalPaidThisWeek,
        mostRecentPaymentDate,
        orders: empOrders,
        customers: customerBreakdown,
      };
    });

    return NextResponse.json({
      teamLeader: {
        name: employee?.name || "Krish Shah",
        isTeamLeader: true,
      },
      teamMembers: membersData,
      summary: {
        totalMembers: membersData.length,
        totalTeamOrders: membersData.reduce((s, m) => s + m.totalOrdersCount, 0),
        totalTeamSales: membersData.reduce((s, m) => s + m.totalSalesAmount, 0),
        totalTeamOutstanding: membersData.reduce((s, m) => s + m.totalAllocatedOutstanding, 0),
        membersWithPendingPayments: membersData.filter((m) => m.weeklyPaymentStatus === "PENDING_PAYMENT").length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching team data for Team Leader:", error);
    return NextResponse.json(
      { error: "Failed to fetch team data: " + error.message },
      { status: 500 }
    );
  }
}
