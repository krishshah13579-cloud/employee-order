import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const { id } = await params;

    const orderItemsCount = await prisma.ecommerceOrderItem.count({ where: { productId: id } });
    if (orderItemsCount > 0) {
      await prisma.ecommerceProduct.update({
        where: { id },
        data: { active: false, stock: 0 },
      });
      return NextResponse.json({
        success: true,
        message: "Product has existing order history; deactivated from store catalog.",
      });
    }

    await prisma.ecommerceCartItem.deleteMany({ where: { productId: id } });
    await prisma.ecommerceReview.deleteMany({ where: { productId: id } });
    await prisma.ecommerceProduct.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
