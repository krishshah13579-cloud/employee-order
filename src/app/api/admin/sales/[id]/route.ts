import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

// GET /api/admin/sales/[id]: Get single sales invoice details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Sales Invoice not found" }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error("Error fetching sales invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales invoice: " + error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sales/[id]: Delete sales invoice (Super Admin or Admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Sales Invoice not found" }, { status: 404 });
    }

    await prisma.salesInvoice.delete({
      where: { id: invoiceId },
    });

    return NextResponse.json({
      success: true,
      message: `Sales Invoice ${invoice.invoiceNumber} deleted successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting sales invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete sales invoice: " + error.message },
      { status: 500 }
    );
  }
}
