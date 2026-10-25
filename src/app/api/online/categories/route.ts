import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const categories = await prisma.ecommerceCategory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error("Failed to fetch online categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { name, slug, description, image } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const generatedSlug = (slug?.trim() || trimmedName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const existing = await prisma.ecommerceCategory.findFirst({
      where: {
        OR: [{ name: trimmedName }, { slug: generatedSlug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A category with this name or slug already exists" },
        { status: 400 }
      );
    }

    const category = await prisma.ecommerceCategory.create({
      data: {
        name: trimmedName,
        slug: generatedSlug,
        description: description?.trim() || null,
        image: image?.trim() || null,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json();
    const { id, name, slug, description, image } = body;

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const trimmedName = name?.trim();
    const generatedSlug = slug?.trim()
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
      : undefined;

    const updated = await prisma.ecommerceCategory.update({
      where: { id },
      data: {
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(generatedSlug ? { slug: generatedSlug } : {}),
        description: description !== undefined ? description?.trim() || null : undefined,
        image: image !== undefined ? image?.trim() || null : undefined,
      },
      include: {
        _count: { select: { products: true } },
      },
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
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    // Check if category has products
    const productCount = await prisma.ecommerceProduct.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category: ${productCount} products are still linked to it` },
        { status: 400 }
      );
    }

    await prisma.ecommerceCategory.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
