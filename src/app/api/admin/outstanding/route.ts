import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";

    // Fetch all customers with their active orders, payments, and sales returns
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: { not: "Cancelled" },
          },
          select: {
            id: true,
            orderNumber: true,
            taxInvoiceNumber: true,
            taxInvoiceDate: true,
            taxInvoiceItems: true,
            orderDate: true,
            grandTotal: true,
            status: true,
          },
          orderBy: {
            orderDate: "asc",
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMode: true,
            referenceNo: true,
          },
          orderBy: {
            paymentDate: "asc",
          },
        },
        salesReturns: {
          select: {
            id: true,
            returnNumber: true,
            totalAmount: true,
            returnDate: true,
          },
          orderBy: {
            returnDate: "asc",
          },
        },
      },
      orderBy: {
        shopName: "asc",
      },
    });

    let totalBilledAll = 0;
    let totalCollectedAll = 0;
    let totalReturnsAll = 0;
    let totalOutstandingAll = 0;

    const customerSummaries = customers.map((c) => {
      // 1. Calculate bills
      const bills = c.orders.map((o) => {
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
        return {
          id: o.id,
          docNo: o.taxInvoiceNumber || o.orderNumber,
          date: o.taxInvoiceDate || o.orderDate,
          amount: billTotal,
          status: o.status,
        };
      });

      const totalBilled = bills.reduce((sum, b) => sum + b.amount, 0);
      const totalPaid = c.payments.reduce((sum, p) => sum + p.amount, 0);
      const totalReturns = c.salesReturns.reduce((sum, r) => sum + r.totalAmount, 0);
      const totalCredits = totalPaid + totalReturns;

      // 2. FIFO Allocation: Deduct total credits from first bill, then second, and so on
      let remainingCredit = totalCredits;
      let unpaidBillsCount = 0;

      const allocatedBills = bills.map((bill) => {
        let paid = 0;
        let balance = bill.amount;
        let billStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID" = "UNPAID";

        if (remainingCredit >= bill.amount) {
          paid = bill.amount;
          balance = 0;
          billStatus = "PAID";
          remainingCredit -= bill.amount;
        } else if (remainingCredit > 0) {
          paid = remainingCredit;
          balance = bill.amount - remainingCredit;
          billStatus = "PARTIALLY_PAID";
          remainingCredit = 0;
          unpaidBillsCount++;
        } else {
          paid = 0;
          balance = bill.amount;
          billStatus = "UNPAID";
          unpaidBillsCount++;
        }

        return {
          ...bill,
          paidAmount: paid,
          balanceAmount: balance,
          billStatus,
        };
      });

      const netOutstanding = Math.max(0, totalBilled - totalCredits);

      totalBilledAll += totalBilled;
      totalCollectedAll += totalPaid;
      totalReturnsAll += totalReturns;
      totalOutstandingAll += netOutstanding;

      return {
        id: c.id,
        firmName: c.shopName,
        city: c.city || "—",
        state: c.state || "—",
        phoneNumber: c.phoneNumber,
        gstPanNo: c.gstPanNo,
        creditDays: c.creditDays,
        totalBilled,
        totalPaid,
        totalReturns,
        totalCredits,
        netOutstanding,
        unallocatedCredit: remainingCredit,
        billsCount: bills.length,
        unpaidBillsCount,
        allocatedBills,
      };
    });

    // Filter by search if provided
    const filteredCustomers = search
      ? customerSummaries.filter(
          (c) =>
            c.firmName.toLowerCase().includes(search) ||
            c.city.toLowerCase().includes(search) ||
            c.phoneNumber.includes(search) ||
            c.gstPanNo.toLowerCase().includes(search)
        )
      : customerSummaries;

    return NextResponse.json({
      summary: {
        totalOutstandingAll,
        totalBilledAll,
        totalCollectedAll,
        totalReturnsAll,
        totalCustomersCount: customerSummaries.length,
        customersWithOutstandingCount: customerSummaries.filter((c) => c.netOutstanding > 0).length,
      },
      customers: filteredCustomers,
    });
  } catch (error: any) {
    console.error("Error fetching outstanding summary:", error);
    return NextResponse.json({ error: "Failed to fetch outstanding data: " + error.message }, { status: 500 });
  }
}
