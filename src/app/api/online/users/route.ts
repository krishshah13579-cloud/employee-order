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
