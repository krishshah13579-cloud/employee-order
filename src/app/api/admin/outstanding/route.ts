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

    // Fetch all customers with their sales invoices, confirmed orders, payments, and sales returns
    const customers = await prisma.customer.findMany({
      include: {
        salesInvoices: {
          select: {
            id: true,
            invoiceNumber: true,
            orderNumber: true,
            orderId: true,
            invoiceDate: true,
            grandTotal: true,
            paymentType: true,
            paymentStatus: true,
            totalSets: true,
            totalPcs: true,
          },
          orderBy: {
            invoiceDate: "asc",
          },
        },
        orders: {
          where: {
            status: { in: ["Confirmed", "In Production", "Ready", "Dispatched", "Delivered"] },
          },
          select: {
            id: true,
            orderNumber: true,
            taxInvoiceNumber: true,
            orderDate: true,
            taxInvoiceDate: true,
            grandTotal: true,
            totalSets: true,
            totalPcs: true,
            businessType: true,
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
      // 1. Gather invoices from SalesInvoice table (Credit sales)
      const invoiceOrderIds = new Set(c.salesInvoices.map((si) => si.orderId).filter(Boolean));
      const invoiceDocNumbers = new Set(
        c.salesInvoices.flatMap((si) => [si.invoiceNumber, si.orderNumber]).filter(Boolean)
      );

      const bills: {
        id: number | string;
        docNo: string;
        orderNumber?: string | null;
        date: Date | string;
        amount: number;
        totalSets: number;
        totalPcs: number;
        paymentType?: string | null;
        status: string;
      }[] = c.salesInvoices
        .filter((si) => si.paymentType !== "Cash")
        .map((si) => ({
          id: si.id,
          docNo: si.invoiceNumber || si.orderNumber || `INV-${si.id}`,
          orderNumber: si.orderNumber,
          date: si.invoiceDate,
          amount: si.grandTotal,
          totalSets: si.totalSets || 0,
          totalPcs: si.totalPcs || 0,
          paymentType: si.paymentType,
          status: "Confirmed",
        }));

      // Merge all bills: Tax Invoices & Bills Without GST from orders not yet in salesInvoices
      c.orders?.forEach((ord) => {
        const isAlreadyInvoiced =
          (ord.id && invoiceOrderIds.has(ord.id)) ||
          (ord.orderNumber && invoiceDocNumbers.has(ord.orderNumber)) ||
          (ord.taxInvoiceNumber && invoiceDocNumbers.has(ord.taxInvoiceNumber));

        if (!isAlreadyInvoiced) {
          bills.push({
            id: `ORD-${ord.id}`,
            docNo: ord.taxInvoiceNumber || ord.orderNumber || `ORD-${ord.id}`,
            orderNumber: ord.orderNumber,
            date: ord.taxInvoiceDate || ord.orderDate || new Date(),
            amount: ord.grandTotal,
            totalSets: ord.totalSets || 0,
            totalPcs: ord.totalPcs || 0,
            paymentType: "Credit",
            status: ord.status,
          });
        }
      });

      // Sort all bills chronologically by date
      bills.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
