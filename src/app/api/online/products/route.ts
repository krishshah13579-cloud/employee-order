import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const products = await prisma.ecommerceProduct.findMany({
      include: {
        category: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("Failed to fetch online products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

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

    if (!name || !description || price === undefined || !categoryId) {
      return NextResponse.json(
        { error: "Name, description, price, and category are required" },
        { status: 400 }
      );
    }

    let baseSlug = slugify(name) || `trouser-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.ecommerceProduct.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const parsedPrice = parseFloat(String(price).replace(/[^0-9.]/g, ""));
    const parsedComparePrice = comparePrice
      ? parseFloat(String(comparePrice).replace(/[^0-9.]/g, "")) || null
      : null;

    const imagesStr = Array.isArray(images)
      ? JSON.stringify(images)
      : typeof images === "string"
      ? images
      : "[]";

    const sizesStr = Array.isArray(sizes)
      ? JSON.stringify(sizes)
      : typeof sizes === "string"
      ? sizes
      : JSON.stringify(["28", "30", "32", "34", "36", "38", "40", "42", "44"]);

    const colorsStr = Array.isArray(colors)
      ? JSON.stringify(colors)
      : typeof colors === "string"
      ? colors
      : "[]";

    const inventoryStr = typeof inventory === "object" && inventory !== null
      ? JSON.stringify(inventory)
      : typeof inventory === "string"
      ? inventory
      : "{}";

    const product = await prisma.ecommerceProduct.create({
      data: {
        name,
        slug,
        description,
        careInstructions: careInstructions || "",
        price: parsedPrice,
        comparePrice: parsedComparePrice,
        categoryId,
        stock: Number(stock) || 0,
        images: imagesStr,
        sizes: sizesStr,
        colors: colorsStr,
        inventory: inventoryStr,
        sizeGuide: typeof sizeGuide === "string" ? sizeGuide : JSON.stringify(sizeGuide || ""),
        featured: Boolean(featured),
        active: active !== undefined ? Boolean(active) : true,
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
