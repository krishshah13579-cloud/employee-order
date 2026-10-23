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
        salesInvoices: {
          orderBy: {
            invoiceDate: "asc",
          },
        },
        orders: {
          where: {
            status: { in: ["Confirmed", "In Production", "Ready", "Dispatched", "Delivered"] },
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

    // 1. Process customer bills datewise from Sales Invoices (Credit sales)
    const invoiceOrderIds = new Set(customer.salesInvoices.map((si) => si.orderId).filter(Boolean));
    const invoiceDocNumbers = new Set(
      customer.salesInvoices.flatMap((si) => [si.invoiceNumber, si.orderNumber]).filter(Boolean)
    );

    const bills: {
      id: number | string;
      orderId?: number | null;
      orderNumber?: string | null;
      taxInvoiceNumber?: string | null;
      displayDocNo: string;
      invoiceDate: Date | string;
      totalSets: number;
      totalPcs: number;
      totalAmount: number;
      paymentType?: string | null;
      status: string;
    }[] = customer.salesInvoices
      .filter((si) => si.paymentType !== "Cash")
      .map((si) => ({
        id: si.id,
        orderId: si.orderId,
        orderNumber: si.orderNumber || si.invoiceNumber,
        taxInvoiceNumber: si.invoiceNumber,
        displayDocNo: si.invoiceNumber || si.orderNumber || `INV-${si.id}`,
        invoiceDate: si.invoiceDate,
        totalSets: si.totalSets || 0,
        totalPcs: si.totalPcs || 0,
        totalAmount: si.grandTotal,
        paymentType: si.paymentType,
        status: "Confirmed",
      }));

    // Merge all bills: Tax Invoices & Bills Without GST from orders not yet in salesInvoices
    customer.orders?.forEach((ord) => {
      const isAlreadyInvoiced =
        (ord.id && invoiceOrderIds.has(ord.id)) ||
        (ord.orderNumber && invoiceDocNumbers.has(ord.orderNumber)) ||
        (ord.taxInvoiceNumber && invoiceDocNumbers.has(ord.taxInvoiceNumber));

      if (!isAlreadyInvoiced) {
        bills.push({
          id: `ORD-${ord.id}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          taxInvoiceNumber: ord.taxInvoiceNumber,
          displayDocNo: ord.taxInvoiceNumber || ord.orderNumber || `ORD-${ord.id}`,
          invoiceDate: ord.taxInvoiceDate || ord.orderDate || new Date(),
          totalSets: ord.totalSets || 0,
          totalPcs: ord.totalPcs || 0,
          totalAmount: ord.grandTotal,
          paymentType: "Credit",
          status: ord.status,
        });
      }
    });

    // Sort all bills chronologically by date
    bills.sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());

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
