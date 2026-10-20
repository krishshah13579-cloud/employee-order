import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";
import { DEFAULT_INVOICE_TEMPLATE } from "@/lib/invoice-template-types";

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

    // 1. Fetch Customer with all related records
    const customer = await prisma.customer.findUnique({
      where: { id: cid },
      include: {
        salesInvoices: {
          orderBy: { invoiceDate: "asc" },
        },
        payments: {
          orderBy: { paymentDate: "asc" },
        },
        salesReturns: {
          orderBy: { returnDate: "asc" },
        },
        orders: {
          where: {
            status: { in: ["Confirmed", "In Production", "Ready", "Dispatched", "Delivered"] },
          },
          orderBy: { orderDate: "asc" },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // 2. Fetch Company Template Details (bank info, letterhead)
    let companyTemplate = DEFAULT_INVOICE_TEMPLATE;
    try {
      const dbTpl = await prisma.invoiceTemplate.findFirst();
      if (dbTpl) {
        companyTemplate = { ...DEFAULT_INVOICE_TEMPLATE, ...dbTpl };
      }
    } catch (e) {
      console.warn("Could not load invoice template, using defaults:", e);
    }

    // 3. Collect all credit bills/invoices deduplicated
    interface RawBill {
      id: string;
      billNo: string;
      billDate: Date;
      dueDate: Date;
      totalAmount: number;
      totalSets: number;
      totalPcs: number;
      source: "salesInvoice" | "order";
    }

    const billsMap = new Map<string, RawBill>();
    const creditDays = Number(customer.creditDays) || 45;

    // Process from salesInvoices first
    for (const si of customer.salesInvoices) {
      if (si.paymentType === "Cash") continue; // Exclude direct cash sales
      const bDate = new Date(si.invoiceDate);
      const dDate = new Date(bDate.getTime() + creditDays * 24 * 60 * 60 * 1000);
      const docNo = (si.invoiceNumber || si.orderNumber || String(si.id)).trim();
      const key = (si.orderId ? `order-${si.orderId}` : `si-${si.id}`).toLowerCase();

      billsMap.set(key, {
        id: `si-${si.id}`,
        billNo: docNo,
        billDate: bDate,
        dueDate: dDate,
        totalAmount: Number(si.grandTotal) || 0,
        totalSets: Number(si.totalSets) || 0,
        totalPcs: Number(si.totalPcs) || 0,
        source: "salesInvoice",
      });
    }

    // Also include any confirmed orders not yet synced in salesInvoices
    for (const ord of customer.orders) {
      const key = `order-${ord.id}`.toLowerCase();
      if (billsMap.has(key)) continue;

      const docNo = (ord.taxInvoiceNumber || ord.orderNumber || String(ord.id)).trim();
      const bDate = new Date(ord.taxInvoiceDate || ord.orderDate);
      const dDays = Number(ord.creditDays) || creditDays;
      const dDate = new Date(bDate.getTime() + dDays * 24 * 60 * 60 * 1000);

      billsMap.set(key, {
        id: `ord-${ord.id}`,
        billNo: docNo,
        billDate: bDate,
        dueDate: dDate,
        totalAmount: Number(ord.grandTotal) || 0,
        totalSets: Number(ord.totalSets) || 0,
        totalPcs: Number(ord.totalPcs) || 0,
        source: "order",
      });
    }

    // Sort bills chronologically by date
    const allBillsRaw = Array.from(billsMap.values()).sort(
      (a, b) => a.billDate.getTime() - b.billDate.getTime()
    );

    // 4. Calculate total credits = payments received + sales returns
    const totalBilled = allBillsRaw.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalPaid = customer.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalReturns = customer.salesReturns.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
    const totalCredits = totalPaid + totalReturns;

    // 5. FIFO Allocation to accurately compute Pending Amount for each bill
    let remainingCredits = totalCredits;
    const allocatedBills = allBillsRaw.map((b) => {
      let paid = 0;
      let pending = b.totalAmount;
      let status: "PAID" | "PARTIALLY_PAID" | "UNPAID" = "UNPAID";

      if (remainingCredits >= b.totalAmount) {
        paid = b.totalAmount;
        pending = 0;
        status = "PAID";
        remainingCredits -= b.totalAmount;
      } else if (remainingCredits > 0) {
        paid = remainingCredits;
        pending = Math.max(0, b.totalAmount - remainingCredits);
        status = "PARTIALLY_PAID";
        remainingCredits = 0;
      } else {
        paid = 0;
        pending = b.totalAmount;
        status = "UNPAID";
      }

      return {
        id: b.id,
        billNo: b.billNo,
        billDate: b.billDate.toISOString(),
        dueDate: b.dueDate.toISOString(),
        totalAmount: Math.round(b.totalAmount * 100) / 100,
        paidAmount: Math.round(paid * 100) / 100,
        pendingAmount: Math.round(pending * 100) / 100,
        totalSets: b.totalSets,
        totalPcs: b.totalPcs,
        status,
      };
    });

    // 6. Pending Bills (ONLY partially paid and unpaid bills, exactly as user requested)
    const pendingBills = allocatedBills.filter((b) => b.pendingAmount > 0);
    const totalPendingAmount = pendingBills.reduce((sum, b) => sum + b.pendingAmount, 0);

    // 7. Unified Chronological Ledger Transactions (Format 2: Statement of Account)
    interface LedgerTransaction {
      id: string;
      date: string;
      rawDate: Date;
      type: "INVOICE" | "PAYMENT" | "RETURN";
      docNo: string;
      particulars: string;
      debit: number;
      credit: number;
      balance: number;
    }

    const transactions: LedgerTransaction[] = [];

    // Add Invoices (Debits)
    for (const b of allBillsRaw) {
      transactions.push({
        id: b.id,
        date: b.billDate.toISOString(),
        rawDate: b.billDate,
        type: "INVOICE",
        docNo: `Bill #${b.billNo}`,
        particulars: `Wholesale Garment Tax Invoice (${b.totalSets} Sets / ${b.totalPcs} Pcs)`,
        debit: b.totalAmount,
        credit: 0,
        balance: 0,
      });
    }

    // Add Payments (Credits)
    for (const p of customer.payments) {
      const pDate = new Date(p.paymentDate);
      transactions.push({
        id: `pay-${p.id}`,
        date: pDate.toISOString(),
        rawDate: pDate,
        type: "PAYMENT",
        docNo: p.referenceNo ? `Ref: ${p.referenceNo}` : `Rcpt #${p.id}`,
        particulars: `Payment Received (${p.paymentMode || "Bank Transfer"})${p.notes ? ` - ${p.notes}` : ""}`,
        debit: 0,
        credit: Number(p.amount) || 0,
        balance: 0,
      });
    }

    // Add Sales Returns (Credits)
    for (const r of customer.salesReturns) {
      const rDate = new Date(r.returnDate);
      transactions.push({
        id: `ret-${r.id}`,
        date: rDate.toISOString(),
        rawDate: rDate,
        type: "RETURN",
        docNo: r.returnNumber || `RET-${r.id}`,
        particulars: `Sales Return Credit Note${r.reason ? ` - ${r.reason}` : ""}`,
        debit: 0,
        credit: Number(r.totalAmount) || 0,
        balance: 0,
      });
    }

    // Sort all transactions chronologically
    transactions.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithBalance = transactions.map((t) => {
      runningBalance = runningBalance + t.debit - t.credit;
      return {
        id: t.id,
        date: t.date,
        type: t.type,
        docNo: t.docNo,
        particulars: t.particulars,
        debit: Math.round(t.debit * 100) / 100,
        credit: Math.round(t.credit * 100) / 100,
        balance: Math.round(runningBalance * 100) / 100,
      };
    });

    const netOutstanding = Math.max(0, totalBilled - totalCredits);

    return NextResponse.json({
      customer: {
        id: customer.id,
        shopName: customer.shopName,
        contactPerson: customer.contactPerson,
        gstPanNo: customer.gstPanNo,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        creditDays: creditDays,
        businessType: customer.businessType,
      },
      company: {
        name: companyTemplate.companyName,
        addressLine1: companyTemplate.addressLine1,
        addressLine2: companyTemplate.addressLine2,
        phone: companyTemplate.phone,
        email: companyTemplate.email,
        gstNo: companyTemplate.gstNo,
        panNo: companyTemplate.panNo,
      },
      bank: {
        name: companyTemplate.bankName,
        branch: companyTemplate.branch,
        accountNumber: companyTemplate.accountNo,
        ifscCode: companyTemplate.ifscCode,
        beneficiary: companyTemplate.beneficiaryName,
      },
      summary: {
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalReturns: Math.round(totalReturns * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        netOutstanding: Math.round(netOutstanding * 100) / 100,
        unallocatedCredit: Math.max(0, Math.round(remainingCredits * 100) / 100),
        totalBillsCount: allBillsRaw.length,
        pendingBillsCount: pendingBills.length,
        totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
      },
      // Format 1: Due & Pending Bills (only unpaid and partly paid with pending balance)
      pendingBills,
      // Format 2: Full Chronological Ledger
      ledgerTransactions: ledgerWithBalance,
      // All Bills detailed
      allBills: allocatedBills,
      payments: customer.payments,
      salesReturns: customer.salesReturns,
      reportDate: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error generating customer ledger:", error);
    return NextResponse.json(
      { error: "Failed to generate customer ledger: " + error.message },
      { status: 500 }
    );
  }
}
