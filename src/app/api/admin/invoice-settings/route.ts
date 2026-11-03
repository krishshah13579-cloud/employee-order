import { NextRequest, NextResponse } from "next/server";
import { getInvoiceTemplateSettings, saveInvoiceTemplateSettings } from "@/lib/invoice-template";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const settings = await getInvoiceTemplateSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch invoice template settings: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await request.json();
    const updated = await saveInvoiceTemplateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to save invoice template settings: " + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return POST(request);
}
