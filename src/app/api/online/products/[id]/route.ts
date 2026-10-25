import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  const { id } = await params;
  try {
    const product = await prisma.ecommerceProduct.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  const { id } = await params;
  try {
    const body = await req.json();
    const {
      name,
      description,
      careInstructions,
      price,
      comparePrice,
      categoryId,
      stock,
      images,
      sizes,
      colors,
      inventory,
      sizeGuide,
      featured,
      active,
    } = body;

    const data: any = {};
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (careInstructions !== undefined) data.careInstructions = careInstructions;
    if (price !== undefined) data.price = parseFloat(String(price).replace(/[^0-9.]/g, ""));
    if (comparePrice !== undefined) {
      data.comparePrice = comparePrice ? parseFloat(String(comparePrice).replace(/[^0-9.]/g, "")) : null;
    }
    if (categoryId) data.categoryId = categoryId;
    if (stock !== undefined) data.stock = Number(stock) || 0;
    if (images !== undefined) {
      data.images = Array.isArray(images) ? JSON.stringify(images) : String(images);
    }
    if (sizes !== undefined) {
      data.sizes = Array.isArray(sizes) ? JSON.stringify(sizes) : String(sizes);
    }
    if (colors !== undefined) {
      data.colors = Array.isArray(colors) ? JSON.stringify(colors) : String(colors);
    }
    if (inventory !== undefined) {
      data.inventory = typeof inventory === "object" ? JSON.stringify(inventory) : String(inventory);
    }
    if (sizeGuide !== undefined) {
      data.sizeGuide = typeof sizeGuide === "object" ? JSON.stringify(sizeGuide) : String(sizeGuide);
    }
    if (featured !== undefined) data.featured = Boolean(featured);
    if (active !== undefined) data.active = Boolean(active);

    const updated = await prisma.ecommerceProduct.update({
      where: { id },
      data,
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  const { id } = await params;
  try {
    await prisma.ecommerceProduct.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
