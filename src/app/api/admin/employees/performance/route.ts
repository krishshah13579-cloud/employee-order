import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    // 1. Fetch Employees
    const employees = await prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        mobileNumber: true,
        address: true,
        proofUrl: true,
        designation: true,
        isTeamLeader: true,
        canEditOrders: true,
        canUpdateStock: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 2. Fetch Customers with sales invoices, payments, and sales returns for outstanding
    const customers = await prisma.customer.findMany({
      include: {
        salesInvoices: {
          select: {
            id: true,
            invoiceNumber: true,
            orderNumber: true,
            invoiceDate: true,
            grandTotal: true,
            paymentType: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
          },
        },
        salesReturns: {
          select: {
            id: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { shopName: "asc" },
    });

    // Calculate customer outstanding using FIFO
    const customerOutstandingMap = new Map<number, number>();
    const customerTotalBilledMap = new Map<number, number>();
    const customerTotalPaidMap = new Map<number, number>();

    customers.forEach((c) => {
      const creditBills = c.salesInvoices.filter((si) => si.paymentType !== "Cash");
      const totalBilled = creditBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
      const totalPaid = c.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalReturns = c.salesReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
      const outstanding = Math.max(0, totalBilled - (totalPaid + totalReturns));

      customerOutstandingMap.set(c.id, outstanding);
      customerTotalBilledMap.set(c.id, totalBilled);
      customerTotalPaidMap.set(c.id, totalPaid + totalReturns);
    });

    // 3. Fetch Orders (exclude cancelled) to compute employee sales performance
    const orders = await prisma.order.findMany({
      where: { status: { not: "Cancelled" } },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        customerName: true,
        placedBy: true,
        totalSets: true,
        totalPcs: true,
        grandTotal: true,
        status: true,
        orderDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group orders by placedBy
    const employeeOrdersMap = new Map<string, typeof orders>();
    orders.forEach((ord) => {
      const placed = (ord.placedBy || "").trim().toLowerCase();
      if (placed) {
        if (!employeeOrdersMap.has(placed)) {
          employeeOrdersMap.set(placed, []);
        }
        employeeOrdersMap.get(placed)!.push(ord);
      }
    });

    // 4. Assemble performance profiles for each employee
    let totalCompanyTurnover = 0;
    let totalAllocatedCustomersCount = 0;
    let totalAllocatedOutstandingSum = 0;

    const employeeProfiles = employees.map((emp) => {
      const empCleanName = emp.name.trim().toLowerCase();
      const empOrders = employeeOrdersMap.get(empCleanName) || [];

      const empTotalRevenue = empOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      const empTotalSets = empOrders.reduce((sum, o) => sum + (o.totalSets || 0), 0);
      const empTotalPcs = empOrders.reduce((sum, o) => sum + (o.totalPcs || 0), 0);
      totalCompanyTurnover += empTotalRevenue;

      // Find allocated customers
      const allocated = customers.filter(
        (c) =>
          c.allocatedEmployeeId === emp.id ||
          (c.allocatedEmployeeName && c.allocatedEmployeeName.trim().toLowerCase() === empCleanName)
      );

      totalAllocatedCustomersCount += allocated.length;

      let empCustomerOutstanding = 0;
      const allocatedCustomerList = allocated.map((c) => {
        const out = customerOutstandingMap.get(c.id) || 0;
        empCustomerOutstanding += out;
        return {
          id: c.id,
          shopName: c.shopName,
          phoneNumber: c.phoneNumber,
          city: c.city || "—",
          businessType: c.businessType,
          creditDays: c.creditDays,
          outstanding: out,
          totalBilled: customerTotalBilledMap.get(c.id) || 0,
          totalPaid: customerTotalPaidMap.get(c.id) || 0,
        };
      });

      totalAllocatedOutstandingSum += empCustomerOutstanding;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        mobileNumber: emp.mobileNumber,
        address: emp.address,
        proofUrl: emp.proofUrl,
        designation: emp.designation,
        isTeamLeader: emp.isTeamLeader,
        canEditOrders: Boolean(emp.canEditOrders),
        canUpdateStock: Boolean(emp.canUpdateStock),
        isActive: emp.isActive,
        createdAt: emp.createdAt,
        stats: {
          totalOrders: empOrders.length,
          totalRevenue: empTotalRevenue,
          totalSets: empTotalSets,
          totalPcs: empTotalPcs,
          allocatedCustomersCount: allocated.length,
          allocatedOutstanding: empCustomerOutstanding,
        },
        allocatedCustomers: allocatedCustomerList,
        recentOrders: empOrders.slice(0, 8),
      };
    });

    // 5. Unallocated Customers
    const unallocated = customers
      .filter((c) => !c.allocatedEmployeeId && !c.allocatedEmployeeName)
      .map((c) => ({
        id: c.id,
        shopName: c.shopName,
        phoneNumber: c.phoneNumber,
        city: c.city || "—",
        businessType: c.businessType,
        outstanding: customerOutstandingMap.get(c.id) || 0,
      }));

    // Customer summary list for assignment picker
    const customerPickerList = customers.map((c) => ({
      id: c.id,
      shopName: c.shopName,
      phoneNumber: c.phoneNumber,
      city: c.city || "—",
      businessType: c.businessType,
      allocatedEmployeeId: c.allocatedEmployeeId,
      allocatedEmployeeName: c.allocatedEmployeeName,
      outstanding: customerOutstandingMap.get(c.id) || 0,
    }));

    return NextResponse.json({
      overview: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e) => e.isActive).length,
        teamLeaders: employees.filter((e) => e.isTeamLeader).length,
        totalCompanyTurnover,
        totalAllocatedCustomers: totalAllocatedCustomersCount,
        totalUnallocatedCustomers: unallocated.length,
        totalAllocatedOutstanding: totalAllocatedOutstandingSum,
      },
      employees: employeeProfiles,
      unallocatedCustomers: unallocated,
      allCustomers: customerPickerList,
    });
  } catch (error: any) {
    console.error("Error fetching employee performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee performance: " + error.message },
      { status: 500 }
    );
  }
}
