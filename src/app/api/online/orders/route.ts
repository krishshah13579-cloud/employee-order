import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const orders = await prisma.ecommerceOrder.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true, images: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Failed to fetch online orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders: " + error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { orderId, status, trackingNumber } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const data: any = {};
    if (status) data.status = status;
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;

    const updated = await prisma.ecommerceOrder.update({
      where: { id: orderId },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, images: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const PUT = PATCH;

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Delete items first then order
    await prisma.ecommerceOrderItem.deleteMany({ where: { orderId } });
    await prisma.ecommerceOrder.delete({ where: { id: orderId } });

    return NextResponse.json({ success: true, message: "Order deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

