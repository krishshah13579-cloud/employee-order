import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";
import { calculateDiscountedPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { action, productId, discountPercent } = body;

    if (action === "APPLY_25_ALL") {
      const products = await prisma.ecommerceProduct.findMany({
        where: { active: true },
        select: { id: true, price: true, comparePrice: true },
      });

      let updatedCount = 0;
      for (const p of products) {
        const basePrice = p.comparePrice && p.comparePrice > p.price ? p.comparePrice : p.price;
        const newPrice = calculateDiscountedPrice(basePrice, 25);

        await prisma.ecommerceProduct.update({
          where: { id: p.id },
          data: {
            comparePrice: basePrice,
            price: newPrice,
          },
        });
        updatedCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Successfully applied 25% OFF to ${updatedCount} products (prices end in 99 or 49).`,
        updatedCount,
      });
    }

    if (action === "SET_PRODUCT_DISCOUNT") {
      if (!productId) {
        return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
      }

      const product = await prisma.ecommerceProduct.findUnique({
        where: { id: productId },
      });
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      const percent = Number(discountPercent);
      if (percent <= 0) {
        // Reset to original price
        const originalPrice = product.comparePrice || product.price;
        await prisma.ecommerceProduct.update({
          where: { id: productId },
          data: {
            price: originalPrice,
            comparePrice: null,
          },
        });
        return NextResponse.json({
          success: true,
          message: "Product restored to standard price.",
          price: originalPrice,
        });
      }

      const basePrice = product.comparePrice && product.comparePrice > product.price
        ? product.comparePrice
        : product.price;

      const newPrice = calculateDiscountedPrice(basePrice, percent);

      const updated = await prisma.ecommerceProduct.update({
        where: { id: productId },
        data: {
          comparePrice: basePrice,
          price: newPrice,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Product updated to ${percent}% OFF (${newPrice}/-).`,
        product: updated,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Bulk discount error:", err);
    return NextResponse.json({ error: err.message || "Failed to update pricing" }, { status: 500 });
  }
}
