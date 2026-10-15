import { NextRequest, NextResponse } from "next/server";

/**
 * Meta WhatsApp Cloud API Webhook Handler
 *
 * 1. GET: Verification Challenge from Meta
 *    Meta will call:
 *    GET /api/webhook/whatsapp?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
 *
 * 2. POST: Real-time Message & Delivery Status Updates
 *    Meta sends incoming messages from customers and delivery receipts (sent, delivered, read)
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    // Default verify token: krish_clothing_webhook_2026 or from environment variable
    const expectedToken =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "krish_clothing_webhook_2026";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("✅ [Meta Webhook Verification] Successfully verified by Meta!");
      return new NextResponse(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.warn("⚠️ [Meta Webhook Verification] Token mismatch or invalid mode:", { mode, token });
    return new NextResponse("Forbidden: Verification token mismatch", { status: 403 });
  } catch (error: any) {
    console.error("Error verifying WhatsApp webhook:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("📩 [WhatsApp Webhook Event Received]:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // 1. Handle incoming customer text/media messages
    if (value?.messages && Array.isArray(value.messages)) {
      for (const msg of value.messages) {
        const from = msg.from; // Customer mobile number with country code
        const msgType = msg.type;
        const text = msg.text?.body || "";
        console.log(`💬 Incoming customer reply from ${from} (${msgType}): "${text}"`);
      }
    }

    // 2. Handle message delivery status updates (sent, delivered, read, failed)
    if (value?.statuses && Array.isArray(value.statuses)) {
      for (const st of value.statuses) {
        console.log(`📊 Message status for ${st.recipient_id} (${st.id}): ${st.status}`);
      }
    }

    // Acknowledge receipt to Meta with 200 OK
    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing WhatsApp webhook event:", error);
    // Still return 200 to prevent Meta from spamming retries
    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  }
}
