import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-security";

const CANDIDATE_GATEWAYS = [
  process.env.WHATSAPP_GATEWAY_URL,
  "http://whatsapp-gateway:5050",
  "http://10.0.1.1:5050",
  "http://172.17.0.1:5050",
  "http://127.0.0.1:5050",
  "http://localhost:5050",
].filter(Boolean) as string[];

async function getGatewayUrl(): Promise<string> {
  for (const url of CANDIDATE_GATEWAYS) {
    try {
      const res = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(800) });
      if (res.ok) return url;
    } catch {}
  }
  return CANDIDATE_GATEWAYS[0] || "http://127.0.0.1:5050";
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gatewayUrl = await getGatewayUrl();

    // Query local Baileys Gateway
    try {
      const statusRes = await fetch(`${gatewayUrl}/api/status`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!statusRes.ok) {
        return NextResponse.json({
          online: false,
          status: "OFFLINE",
          error: "Gateway returned " + statusRes.status,
        });
      }

      const statusData = await statusRes.json();
      let qr = null;

      if (!statusData.connected) {
        const qrRes = await fetch(`${gatewayUrl}/api/qr`, {
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        if (qrRes && qrRes.ok) {
          const qrData = await qrRes.json();
          qr = qrData.qr;
        }
      }

      return NextResponse.json({
        online: true,
        status: statusData.status,
        connected: Boolean(statusData.connected),
        phone: statusData.phone,
        name: statusData.name,
        qr,
      });
    } catch (e: any) {
      return NextResponse.json({
        online: false,
        status: "OFFLINE",
        error: "Gateway service is not running on port 5050. Run `npm run whatsapp:gateway` to start it.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || "test";
    const gatewayUrl = await getGatewayUrl();

    if (action === "disconnect") {
      const res = await fetch(`${gatewayUrl}/api/disconnect`, {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      return NextResponse.json({ success: res.ok });
    }

    if (action === "test") {
      const { to, message } = body;
      if (!to || !message) {
        return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 });
      }

      const res = await fetch(`${gatewayUrl}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ error: data.error || "Failed to send test message" }, { status: res.status });
      }

      return NextResponse.json({ success: true, messageId: data.messageId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
