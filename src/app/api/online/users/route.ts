import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const users = await prisma.ecommerceUser.findMany({
      include: {
        _count: {
          select: { orders: true, reviews: true },
        },
        orders: {
          select: { total: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = users.map((u) => {
      const totalSpend = u.orders.reduce((sum, ord) => sum + (ord.total || 0), 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        phoneVerified: u.phoneVerified,
        role: u.role,
        visitCount: u.visitCount,
        lastVisitedAt: u.lastVisitedAt,
        createdAt: u.createdAt,
        ordersCount: u._count.orders,
        reviewsCount: u._count.reviews,
        totalSpend,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { id, role, phoneVerified } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const data: any = {};
    if (role) data.role = role;
    if (phoneVerified !== undefined) data.phoneVerified = Boolean(phoneVerified);

    const updated = await prisma.ecommerceUser.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if user has orders
    const userOrdersCount = await prisma.ecommerceOrder.count({ where: { userId: id } });
    if (userOrdersCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete user: ${userOrdersCount} order(s) are linked to this customer account.` },
        { status: 400 }
      );
    }

    // Clean up dependent cart items, reviews, discounts
    await prisma.ecommerceCartItem.deleteMany({ where: { userId: id } });
    await prisma.ecommerceReview.deleteMany({ where: { userId: id } });
    await prisma.ecommerceDiscount.deleteMany({ where: { userId: id } });

    await prisma.ecommerceUser.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

