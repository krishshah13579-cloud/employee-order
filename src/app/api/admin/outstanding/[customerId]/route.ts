import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

export async function GET(
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
            items: true,
          },
          orderBy: {
            orderDate: "asc",
          },
        },
        payments: {
          orderBy: {
            paymentDate: "asc",
          },
        },
        salesReturns: {
          orderBy: {
            returnDate: "asc",
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // 1. Process customer bills datewise
    const bills = customer.orders.map((o) => {
      let billTotal = o.grandTotal;
      let totalSets = o.totalSets;
      let totalPcs = o.totalPcs;

      if (o.taxInvoiceItems) {
        try {
          const parsed = JSON.parse(o.taxInvoiceItems);
          if (Array.isArray(parsed) && parsed.length > 0) {
            totalSets = parsed.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
            totalPcs = parsed.reduce((s, it) => s + (Number(it.totalPcs) || 0), 0);
            const subtotal = parsed.reduce((sum, it) => sum + (Number(it.itemSubtotal) || 0), 0);
            const gst = Math.round(subtotal * 0.05 * 100) / 100;
            billTotal = Math.round(subtotal + gst);
          }
        } catch {}
      }

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        taxInvoiceNumber: o.taxInvoiceNumber,
        displayDocNo: o.taxInvoiceNumber || o.orderNumber,
        invoiceDate: o.taxInvoiceDate || o.orderDate,
        totalSets,
        totalPcs,
        totalAmount: billTotal,
        status: o.status,
      };
    });

    // 2. Total credits = Payments + Sales Returns
    const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
    const totalReturns = customer.salesReturns.reduce((sum, r) => sum + r.totalAmount, 0);
    const totalCredits = totalPaid + totalReturns;

    // 3. FIFO Deduction Algorithm:
    // Deduct totalCredits from the oldest bill first, then second, and so on
    let runningCredit = totalCredits;
    const allocatedBills = bills.map((bill) => {
      let paid = 0;
      let balance = bill.totalAmount;
      let billStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID" = "UNPAID";

      if (runningCredit >= bill.totalAmount) {
        paid = bill.totalAmount;
        balance = 0;
        billStatus = "PAID";
        runningCredit -= bill.totalAmount;
      } else if (runningCredit > 0) {
        paid = runningCredit;
        balance = bill.totalAmount - runningCredit;
        billStatus = "PARTIALLY_PAID";
        runningCredit = 0;
      } else {
        paid = 0;
        balance = bill.totalAmount;
        billStatus = "UNPAID";
      }

      return {
        ...bill,
        paidAmount: paid,
        balanceAmount: balance,
        billStatus,
      };
    });

    const netOutstanding = Math.max(0, totalBilled - totalCredits);

    return NextResponse.json({
      customer: {
        id: customer.id,
        shopName: customer.shopName,
        gstPanNo: customer.gstPanNo,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        creditDays: customer.creditDays,
        contactPerson: customer.contactPerson,
      },
      summary: {
        totalBilled,
        totalPaid,
        totalReturns,
        totalCredits,
        netOutstanding,
        unallocatedCredit: runningCredit,
        totalBillsCount: bills.length,
        unpaidBillsCount: allocatedBills.filter((b) => b.balanceAmount > 0).length,
      },
      bills: allocatedBills,
      payments: customer.payments,
      salesReturns: customer.salesReturns,
    });
  } catch (error: any) {
    console.error("Error fetching customer outstanding ledger:", error);
    return NextResponse.json({ error: "Failed to fetch customer ledger: " + error.message }, { status: 500 });
  }
}
