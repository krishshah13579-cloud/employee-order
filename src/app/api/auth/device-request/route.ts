import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    await recordAuditLog({
      action: "DEVICE_APPROVAL_REQUESTED",
      actorType: "SYSTEM",
      actorName: "External Terminal",
      details: `Unauthorized terminal requested device approval. IP: ${ip}, UA: ${userAgent.slice(0, 100)}, URL: ${body.url || "direct"}`,
      ipAddress: ip,
      status: "BLOCKED",
    });

    return NextResponse.json({
      success: true,
      message: "Device approval request has been logged. Please contact your company administrator to receive your official WhatsApp device authorization link.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to log device request." },
      { status: 500 }
    );
  }
}
