import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generateOrderWhatsAppMessage,
  generatePaymentReminderWhatsAppMessage,
  createWhatsAppDirectLink,
  dispatchAutomatedWhatsApp,
} from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const messageType = body.type || "ORDER_CONFIRMATION"; // ORDER_CONFIRMATION | PAYMENT_REMINDER | CUSTOM

    const orderId = parseInt(id, 10);
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(isNaN(orderId) ? [] : [{ id: orderId }]),
          { orderNumber: id },
        ],
      },
      include: {
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const customerPhone = order.customerPhone || order.customer?.phoneNumber || "";
    if (!customerPhone) {
      return NextResponse.json(
        { error: "Customer does not have a phone number registered" },
        { status: 400 }
      );
    }

    // Determine host URL for invoice link
    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://krish-clothing.vercel.app";

    let messageText = "";
    if (messageType === "PAYMENT_REMINDER") {
      messageText = generatePaymentReminderWhatsAppMessage(order as any, origin);
    } else {
      messageText = generateOrderWhatsAppMessage(order as any, origin);
    }

    // Try automated background dispatch if credentials exist
    const autoResult = await dispatchAutomatedWhatsApp(customerPhone, messageText);

    // Generate direct click URL for instant web/app fallback
    const directLink = createWhatsAppDirectLink(customerPhone, messageText);

    return NextResponse.json({
      success: true,
      automated: autoResult.success,
      method: autoResult.method,
      whatsappUrl: directLink,
      message: messageText,
      customerPhone,
      customerName: order.customerName,
    });
  } catch (error: any) {
    console.error("WhatsApp API error:", error);
    return NextResponse.json(
      { error: "Failed to process WhatsApp request: " + error.message },
      { status: 500 }
    );
  }
}
