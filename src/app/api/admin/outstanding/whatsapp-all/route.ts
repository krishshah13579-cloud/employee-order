import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";
import {
  generateCustomerOutstandingWhatsAppMessage,
  createWhatsAppDirectLink,
  createWhatsAppNativeLink,
  dispatchAutomatedWhatsApp,
} from "@/lib/whatsapp";
import { updateWhatsAppSettings } from "@/lib/whatsapp-settings";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    const authHeader = request.headers.get("authorization");
    const isCron = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!admin && !isCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const autoDispatch = Boolean(body.autoDispatch !== false); // Default to sending directly

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer")?.replace(/\/admin.*$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://krish-clothing.vercel.app";

    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: {
            status: { not: "Cancelled" },
          },
          orderBy: {
            orderDate: "asc",
          },
        },
        payments: true,
        salesReturns: true,
      },
      orderBy: {
        shopName: "asc",
      },
    });

    const pendingReminders: any[] = [];
    let totalOutstandingSum = 0;

    for (const customer of customers) {
      if (!customer.phoneNumber) continue;

      // Calculate bills
      const bills = customer.orders.map((o) => {
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
          invoiceNo: o.taxInvoiceNumber || o.orderNumber,
          invoiceDate: o.taxInvoiceDate || o.orderDate,
          totalAmount: billTotal,
        };
      });

      const totalBilled = bills.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
      const totalReturns = customer.salesReturns.reduce((sum, r) => sum + r.totalAmount, 0);
      const totalCredits = totalPaid + totalReturns;

      // FIFO allocation
      let remainingCredit = totalCredits;
      const pendingBills: Array<{
        invoiceNo: string;
        invoiceDate: string | Date;
        totalAmount: number;
        balanceAmount: number;
      }> = [];

      bills.forEach((bill) => {
        if (remainingCredit >= bill.totalAmount) {
          remainingCredit -= bill.totalAmount;
        } else if (remainingCredit > 0) {
          const bal = bill.totalAmount - remainingCredit;
          remainingCredit = 0;
          pendingBills.push({
            ...bill,
            balanceAmount: bal,
          });
        } else {
          pendingBills.push({
            ...bill,
            balanceAmount: bill.totalAmount,
          });
        }
      });

      const outstandingBalance = Math.max(0, totalBilled - totalCredits);

      // Only include customers with actual outstanding balance
      if (outstandingBalance > 0) {
        totalOutstandingSum += outstandingBalance;

        const messageText = generateCustomerOutstandingWhatsAppMessage(
          {
            customerName: customer.shopName,
            customerPhone: customer.phoneNumber,
            city: customer.city,
            gstPanNo: customer.gstPanNo,
            creditDays: customer.creditDays,
            totalBilled,
            totalPaid,
            totalReturns,
            outstandingBalance,
            pendingBillsCount: pendingBills.length,
            billsSummary: pendingBills,
          },
          origin
        );

        pendingReminders.push({
          customerId: customer.id,
          customerName: customer.shopName,
          phone: customer.phoneNumber,
          outstandingBalance,
          pendingBillsCount: pendingBills.length,
          message: messageText,
          whatsappUrl: createWhatsAppDirectLink(customer.phoneNumber, messageText),
          nativeUrl: createWhatsAppNativeLink(customer.phoneNumber, messageText),
        });
      }
    }

    // If autoDispatch requested, run through reminders
    const dispatchResults: any[] = [];
    if (autoDispatch && pendingReminders.length > 0) {
      for (const item of pendingReminders) {
        try {
          const autoResult = await dispatchAutomatedWhatsApp(item.phone, item.message);
          dispatchResults.push({
            customerId: item.customerId,
            customerName: item.customerName,
            phone: item.phone,
            success: autoResult.success,
            method: autoResult.method,
          });
        } catch (dispatchErr: any) {
          dispatchResults.push({
            customerId: item.customerId,
            customerName: item.customerName,
            phone: item.phone,
            success: false,
            error: dispatchErr.message,
          });
        }
      }

      // Record dispatch date & count in settings
      const todayStr = new Date().toISOString().split("T")[0];
      updateWhatsAppSettings({
        lastDispatchedDate: todayStr,
        lastDispatchedCount: pendingReminders.length,
      });
    }

    return NextResponse.json({
      success: true,
      count: pendingReminders.length,
      totalOutstanding: totalOutstandingSum,
      reminders: pendingReminders,
      dispatchResults,
    });
  } catch (error: any) {
    console.error("Batch weekly reminders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
