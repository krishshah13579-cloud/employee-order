import { NextRequest, NextResponse } from "next/server";
import { generateCustomerLedgerPdfBuffer } from "@/lib/pdf-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const cid = parseInt(customerId, 10);
    if (isNaN(cid)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const formatType: "format1" | "format2" =
      searchParams.get("format") === "format2" ? "format2" : "format1";

    const { pdfBuffer, fileName } = await generateCustomerLedgerPdfBuffer(cid, formatType);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating ledger PDF:", error);
    return NextResponse.json({ error: error.message || "Failed to generate ledger PDF" }, { status: 500 });
  }
}
