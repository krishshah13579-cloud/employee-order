import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generatePaymentReminderWhatsAppMessage,
  createWhatsAppDirectLink,
  dispatchAutomatedWhatsApp,
} from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  try {
    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://krish-clothing.vercel.app";

    // Find orders that are active (Pending, Confirmed, In Production, Ready, Dispatched)
    // and exclude Cancelled or completed Delivered payments
    const orders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ["Cancelled"],
        },
      },
      include: {
        customer: true,
      },
      orderBy: {
        orderDate: "desc",
      },
    });

    const now = new Date();
    const reminders: any[] = [];

    for (const ord of orders) {
      const creditDays = ord.creditDays || 0;
      const orderDate = new Date(ord.orderDate);
      const dueDate = new Date(orderDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const phone = ord.customerPhone || ord.customer?.phoneNumber || "";

      const message = generatePaymentReminderWhatsAppMessage(ord as any, origin);
      const whatsappUrl = phone ? createWhatsAppDirectLink(phone, message) : "";

      reminders.push({
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        customerName: ord.customerName,
        customerPhone: phone,
        grandTotal: ord.grandTotal,
        creditDays,
        orderDate: ord.orderDate,
        dueDate: dueDate.toISOString(),
        daysRemaining: daysDiff,
        isOverdue: daysDiff < 0,
        status: ord.status,
        whatsappUrl,
        message,
      });
    }

    return NextResponse.json({
      success: true,
      totalPendingReminders: reminders.length,
      reminders,
    });
  } catch (error: any) {
    console.error("Payment reminders error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly payment reminders: " + error.message },
      { status: 500 }
    );
  }
}
