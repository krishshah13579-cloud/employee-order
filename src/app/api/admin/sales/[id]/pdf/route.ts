import { NextRequest, NextResponse } from "next/server";
import { generateSalesInvoicePdfBuffer } from "@/lib/pdf-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invId = parseInt(id, 10);
    if (isNaN(invId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const { pdfBuffer, fileName } = await generateSalesInvoicePdfBuffer(invId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating sales invoice PDF:", error);
    return NextResponse.json({ error: error.message || "Failed to generate sales invoice PDF" }, { status: 500 });
  }
}
