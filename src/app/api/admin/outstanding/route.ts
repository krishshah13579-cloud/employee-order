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
            items: true,
            notes: true,
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
            notes: true,
            items: {
              select: {
                productName: true,
              },
            },
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

      const isWithoutGstCustomer = (c.businessType || "").toUpperCase().includes("WITHOUT GST");

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
        .filter((si) => {
          if (si.paymentType === "Cash") return false;
          // Exclude IMPORTED TROUSER MIX only and only for Retailers / Wholesalers (Without GST)
          if (isWithoutGstCustomer) {
            const isMix = Boolean(
              (si.items && si.items.toUpperCase().includes("IMPORTED TROUSER")) ||
              (si.notes && si.notes.toUpperCase().includes("IMPORTED TROUSER"))
            );
            if (isMix) return false;
          }
          return true;
        })
        .map((si) => {
          const bookNoMatch = si.notes?.match(/\[HANDWRITTEN_BOOK_NO:\s*([^\]]+)\]/i);
          const docNo = bookNoMatch ? bookNoMatch[1].trim() : (si.orderNumber || si.invoiceNumber || `INV-${si.id}`);
          return {
            id: si.id,
            docNo,
            orderNumber: si.orderNumber,
            date: si.invoiceDate,
            amount: si.grandTotal,
            totalSets: si.totalSets || 0,
            totalPcs: si.totalPcs || 0,
            paymentType: si.paymentType,
            status: "Confirmed",
          };
        });

      // Merge all bills: Tax Invoices & Bills Without GST from orders not yet in salesInvoices
      c.orders?.forEach((ord) => {
        // Exclude IMPORTED TROUSER MIX only and only for Retailers / Wholesalers (Without GST)
        if (isWithoutGstCustomer) {
          const isMix = Boolean(
            (ord.notes && ord.notes.toUpperCase().includes("IMPORTED TROUSER")) ||
            ord.items?.some((it) => (it.productName || "").toUpperCase().includes("IMPORTED TROUSER"))
          );
          if (isMix) return;
        }

        const isAlreadyInvoiced =
          (ord.id && invoiceOrderIds.has(ord.id)) ||
          (ord.orderNumber && invoiceDocNumbers.has(ord.orderNumber)) ||
          (ord.taxInvoiceNumber && invoiceDocNumbers.has(ord.taxInvoiceNumber));

        if (!isAlreadyInvoiced) {
          const billNoMatch = ord.notes?.match(/\[BILL_WITHOUT_GST:\s*([^\]]+)\]/i);
          const bookNoMatch = ord.notes?.match(/\[HANDWRITTEN_BOOK_NO:\s*([^\]]+)\]/i);
          const docNo = bookNoMatch ? bookNoMatch[1].trim() : (billNoMatch ? billNoMatch[1].trim() : (ord.orderNumber || ord.taxInvoiceNumber || `ORD-${ord.id}`));

          bills.push({
            id: `ORD-${ord.id}`,
            docNo,
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
        customerId: c.id,
        firmName: c.shopName,
        shopName: c.shopName,
        businessType: c.businessType,
        totalOutstanding: netOutstanding,
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
        salesReturns: c.salesReturns.map((r) => ({
          id: r.id,
          returnNumber: r.returnNumber,
          totalAmount: r.totalAmount,
          returnDate: r.returnDate,
        })),
        returnNumbers: c.salesReturns.map((r) => r.returnNumber),
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
