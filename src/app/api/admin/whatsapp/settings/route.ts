import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-security";
import { getWhatsAppSettings, updateWhatsAppSettings } from "@/lib/whatsapp-settings";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = getWhatsAppSettings();
    return NextResponse.json(settings);
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
    const updated = updateWhatsAppSettings(body);

    // Also forward to gateway if available
    const candidateGateways = [
      process.env.WHATSAPP_GATEWAY_URL,
      "http://whatsapp-gateway:5050",
      "http://10.0.1.1:5050",
      "http://127.0.0.1:5050",
      "http://localhost:5050",
    ].filter(Boolean) as string[];

    for (const url of candidateGateways) {
      try {
        const res = await fetch(`${url}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
          signal: AbortSignal.timeout(1000),
        }).catch(() => null);
        if (res && res.ok) break;
      } catch {}
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
