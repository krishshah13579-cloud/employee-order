import { NextRequest, NextResponse } from "next/server";
import { getInvoiceTemplateSettings, saveInvoiceTemplateSettings } from "@/lib/invoice-template";

export async function GET() {
  try {
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
