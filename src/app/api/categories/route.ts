import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

const DEFAULT_CATEGORIES = [
  {
    name: "EVERYDAY CASUAL",
    slug: "everyday-casual",
    description: "Comfortable stretch chinos, casual trousers, and everyday versatile wear.",
    image: null,
  },
  {
    name: "FORMAL WEAR",
    slug: "formal-wear",
    description: "Executive formal trousers, pleated & flat-front business trousers for professional elegance.",
    image: null,
  },
  {
    name: "LINEN",
    slug: "linen",
    description: "Lightweight, ultra-breathable pure linen and linen-blend summer trousers.",
    image: null,
  },
];

export async function GET() {
  try {
    let categories = await prisma.category.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Auto seed defaults if empty
    if (categories.length === 0) {
      for (const def of DEFAULT_CATEGORIES) {
        await prisma.category.create({
          data: def,
        });
      }
      categories = await prisma.category.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    // Compute products count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (c) => {
        const productCount = await prisma.product.count({
          where: {
            category: c.name,
          },
        });
        return {
          ...c,
          _count: {
            products: productCount,
          },
        };
      })
    );

    return NextResponse.json(categoriesWithCount);
  } catch (error: any) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { name, slug, description, image } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const generatedSlug = (slug?.trim() || trimmedName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    // Check if name or slug exists
    const existing = await prisma.category.findFirst({
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

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        slug: generatedSlug,
        description: description?.trim() || null,
        image: image?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        ...category,
        _count: { products: 0 },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Failed to create category: " + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { id, name, slug, description, image } = body;

    const catId = typeof id === "string" ? parseInt(id, 10) : id;
    if (!catId || isNaN(catId)) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const generatedSlug = (slug?.trim() || trimmedName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    // Check conflict
    const existing = await prisma.category.findFirst({
      where: {
        id: { not: catId },
        OR: [{ name: trimmedName }, { slug: generatedSlug }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Another category with this name or slug already exists" },
        { status: 400 }
      );
    }

    // Get previous category name to handle product renaming if changed
    const previous = await prisma.category.findUnique({
      where: { id: catId },
    });

    const category = await prisma.category.update({
      where: { id: catId },
      data: {
        name: trimmedName,
        slug: generatedSlug,
        description: description?.trim() || null,
        image: image?.trim() || null,
      },
    });

    // If category name changed, update all existing products that used the old name
    if (previous && previous.name !== trimmedName) {
      await prisma.product.updateMany({
        where: { category: previous.name },
        data: { category: trimmedName },
      });
    }

    const count = await prisma.product.count({
      where: { category: trimmedName },
    });

    return NextResponse.json({
      ...category,
      _count: { products: count },
    });
  } catch (error: any) {
    console.error("Failed to update category:", error);
    return NextResponse.json(
      { error: "Failed to update category: " + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    const catId = parseInt(idParam, 10);
    if (isNaN(catId)) {
      return NextResponse.json(
        { error: "Invalid Category ID" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: catId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Delete the category record
    await prisma.category.delete({
      where: { id: catId },
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
      deletedCategory: category.name,
    });
  } catch (error: any) {
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      { error: "Failed to delete category: " + error.message },
      { status: 500 }
    );
  }
}
