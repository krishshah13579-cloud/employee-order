import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const discounts = await prisma.ecommerceDiscount.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(discounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json();
    const {
      code,
      type,
      value,
      minOrder,
      maxDiscount,
      maxUses,
      expiresAt,
      description,
      targetAudience,
      minOrders,
      maxOrders,
      minSpend,
    } = body;

    if (!code?.trim() || !type || value === undefined) {
      return NextResponse.json(
        { error: "Code, type, and value are required" },
        { status: 400 }
      );
    }

    const upperCode = code.trim().toUpperCase();

    const existing = await prisma.ecommerceDiscount.findUnique({
      where: { code: upperCode },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A discount with this code already exists" },
        { status: 400 }
      );
    }

    const discount = await prisma.ecommerceDiscount.create({
      data: {
        code: upperCode,
        type: type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
        value: Number(value),
        minOrder: Number(minOrder) || 0,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        description: description?.trim() || null,
        targetAudience: targetAudience || "ALL",
        minOrders: minOrders ? Number(minOrders) : 0,
        maxOrders: maxOrders ? Number(maxOrders) : null,
        minSpend: minSpend ? Number(minSpend) : 0,
      },
    });

    return NextResponse.json(discount, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { id, active } = body;

    if (!id) {
      return NextResponse.json({ error: "Discount ID is required" }, { status: 400 });
    }

    const updated = await prisma.ecommerceDiscount.update({
      where: { id },
      data: { active: Boolean(active) },
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
      return NextResponse.json({ error: "Discount ID is required" }, { status: 400 });
    }

    await prisma.ecommerceDiscount.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Discount deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
