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

    // Also forward to local gateway if available
    try {
      await fetch("http://localhost:5050/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
        signal: AbortSignal.timeout(2000),
      }).catch(() => null);
    } catch {}

    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
