import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

// GET /api/admin/payments: List payments
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const payments = await prisma.payment.findMany({
      where: customerId ? { customerId: parseInt(customerId, 10) } : undefined,
      include: {
        customer: {
          select: {
            id: true,
            shopName: true,
            phoneNumber: true,
            city: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
    });

    return NextResponse.json(payments);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Failed to fetch payments: " + error.message }, { status: 500 });
  }
}

// POST /api/admin/payments: Record received payment
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, amount, paymentDate, paymentMode, referenceNo, notes } = body;

    const cid = parseInt(customerId, 10);
    const amt = parseFloat(amount);

    if (isNaN(cid)) {
      return NextResponse.json({ error: "Please select a valid customer" }, { status: 400 });
    }

    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than 0" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: cid },
      select: { id: true, shopName: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        customerId: cid,
        customerName: customer.shopName,
        amount: amt,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMode: paymentMode || "Bank Transfer",
        referenceNo: referenceNo?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return NextResponse.json({ error: "Failed to record payment: " + error.message }, { status: 500 });
  }
}

// DELETE /api/admin/payments: Delete a payment record
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const pid = parseInt(id || "", 10);

    if (isNaN(pid)) {
      return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
    }

    await prisma.payment.delete({
      where: { id: pid },
    });

    return NextResponse.json({ success: true, message: "Payment record deleted" });
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    return NextResponse.json({ error: "Failed to delete payment: " + error.message }, { status: 500 });
  }
}
