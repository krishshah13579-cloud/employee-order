import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active_only") === "1";
    const search = searchParams.get("search");

    const where: any = {};

    if (category && category !== "All") {
      where.category = category;
    }

    if (activeOnly) {
      where.isActive = true;
    }

    if (search && search.trim() !== "") {
      where.OR = [
        { name: { contains: search.trim() } },
        { colorsAvailable: { contains: search.trim() } },
        { sizesRatio: { contains: search.trim() } },
      ];
    }

    const fullImages = searchParams.get("full_images") === "1";

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const optimizedProducts = fullImages
      ? products
      : products.map((p) => {
          let cover = p.imageUrl;
          if (cover && cover.startsWith("[") && cover.endsWith("]")) {
            try {
              const arr = JSON.parse(cover);
              if (Array.isArray(arr) && arr.length > 0) {
                cover = arr[0];
              }
            } catch {}
          }
          return {
            ...p,
            imageUrl: cover,
          };
        });

    return NextResponse.json(optimizedProducts, {
      headers: {
        "Cache-Control": "public, max-age=4, s-maxage=8, stale-while-revalidate=20",
      },
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      category,
      colorsAvailable,
      sizesRatio,
      sizesList,
      pcsPerSet,
      price,
      setsColorwise,
      sizeGuide,
      imageUrl,
      colorMapping,
      isActive,
    } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    if (!colorsAvailable || colorsAvailable.trim() === "") {
      return NextResponse.json({ error: "Available colors are required" }, { status: 400 });
    }

    const pcs = parseInt(pcsPerSet, 10) || (sizesList ? sizesList.split(",").length : 5);

    const numMrp = body.mrp !== undefined && body.mrp !== null && String(body.mrp).trim() !== ""
      ? parseFloat(body.mrp)
      : null;
    const retailerPrice = numMrp !== null
      ? Math.round(numMrp / 2)
      : body.retailerPrice !== undefined
      ? parseFloat(body.retailerPrice)
      : parseFloat(price) || 0;
    const wholesalerPrice = numMrp !== null
      ? Math.max(0, Math.round(numMrp / 2) - 100)
      : body.wholesalerPrice !== undefined
      ? parseFloat(body.wholesalerPrice)
      : Math.max(0, retailerPrice - 100);

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        category: category || "Jeans & Denim",
        colorsAvailable: colorsAvailable.trim(),
        sizesRatio: sizesRatio || "30 to 38",
        sizesList: sizesList || "30, 32, 34, 36, 38",
        pcsPerSet: pcs,
        mrp: numMrp,
        retailerPrice: retailerPrice,
        wholesalerPrice: wholesalerPrice,
        price: retailerPrice,
        setsColorwise: setsColorwise || null,
        sizeGuide: sizeGuide || null,
        imageUrl: imageUrl || null,
        colorMapping: colorMapping || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Failed to create product: " + error.message },
      { status: 500 }
    );
  }
}
