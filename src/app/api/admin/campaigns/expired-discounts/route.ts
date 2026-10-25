import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const now = new Date();

    const users = await prisma.ecommerceUser.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        firstDiscountCode: true,
        expiredCouponCampaignSentAt: true,
        createdAt: true,
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true, total: true, createdAt: true },
        },
        discounts: {
          select: {
            id: true,
            code: true,
            active: true,
            expiresAt: true,
            usedCount: true,
            maxUses: true,
            type: true,
            value: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const candidates: any[] = [];

    for (const u of users) {
      const hasActiveUnexpired = u.discounts.some(
        (d) =>
          d.active &&
          (d.expiresAt === null || d.expiresAt > now) &&
          (d.maxUses === null || d.usedCount < d.maxUses)
      );

      if (hasActiveUnexpired) continue;

      const expiredCoupon = u.discounts.find(
        (d) =>
          d.expiresAt &&
          d.expiresAt <= now &&
          (d.maxUses === null || d.usedCount < d.maxUses)
      );

      const hadRegistrationCode = Boolean(u.firstDiscountCode);

      if (expiredCoupon || hadRegistrationCode) {
        candidates.push({
          id: u.id,
          name: u.name || "Customer",
          email: u.email,
          phone: u.phone,
          orderCount: u.orders.length,
          lastCampaignSentAt: u.expiredCouponCampaignSentAt,
          expiredCouponCode: expiredCoupon?.code || u.firstDiscountCode || "WELCOME",
          expiredAt: expiredCoupon?.expiresAt || null,
          isEligible: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalRegistered: users.length,
      eligibleCount: candidates.length,
      candidates,
    });
  } catch (error: any) {
    console.error("Failed to fetch expired discount candidates:", error);
    return NextResponse.json(
      { error: "Failed to fetch expired discount candidates" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      targetUserId,
      discountValue = 10,
      discountType = "PERCENTAGE",
      minOrder = 999,
      maxDiscount = 350,
      validDays = 7,
    } = body;

    const userQuery: any = { role: "USER" };
    if (targetUserId) {
      userQuery.id = targetUserId;
    }

    const users = await prisma.ecommerceUser.findMany({
      where: userQuery,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        firstDiscountCode: true,
      },
    });

    const results: Array<{
      userId: string;
      email: string;
      newCouponCode: string;
      status: string;
    }> = [];

    for (const user of users) {
      const shortId = user.id.slice(-4).toUpperCase();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newCouponCode = `RENEW10-${shortId}-${randomSuffix}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (Number(validDays) || 7));

      const createdDiscount = await prisma.ecommerceDiscount.create({
        data: {
          code: newCouponCode,
          type: discountType === "FIXED" ? "FIXED" : "PERCENTAGE",
          value: parseFloat(String(discountValue)),
          minOrder: minOrder ? parseFloat(String(minOrder)) : 0,
          maxDiscount: maxDiscount ? parseFloat(String(maxDiscount)) : null,
          maxUses: 1,
          usedCount: 0,
          active: true,
          expiresAt,
          userId: user.id,
          userPhone: user.phone || null,
          targetAudience: "ALL",
          description: `Renewed ${discountValue}% Off privilege for registered customer`,
        },
      });

      await prisma.ecommerceUser.update({
        where: { id: user.id },
        data: { expiredCouponCampaignSentAt: new Date() },
      });

      results.push({
        userId: user.id,
        email: user.email,
        newCouponCode: createdDiscount.code,
        status: "Generated",
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
