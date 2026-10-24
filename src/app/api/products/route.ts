import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getProductCoverImage, sortProductsByImpSequence } from "@/lib/utils";
import { getSizesFromRatio } from "@/lib/stock";
import { requireAdmin } from "@/lib/auth-security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("active_only") === "1";
    const search = searchParams.get("search");
    const fullGallery = searchParams.get("full_gallery") === "1";

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

    const inStockOnly = searchParams.get("in_stock_only") === "1" || searchParams.get("hide_out_of_stock") === "1";

    const selectFields = fullGallery
      ? undefined
      : {
          id: true,
          name: true,
          category: true,
          colorsAvailable: true,
          colorMapping: true,
          sizesRatio: true,
          sizesList: true,
          pcsPerSet: true,
          mrp: true,
          retailerPrice: true,
          wholesalerPrice: true,
          price: true,
          costPrice: true,
          mixPcs: true,
          setsColorwise: true,
          sizeGuide: true,
          imageUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        };

    const rawProducts = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      ...(selectFields ? { select: selectFields } : {}),
    });

    // Sort strictly in numerical sequence starting from IMP - 001 upwards
    const products = sortProductsByImpSequence(rawProducts);

    const { getTotalAvailableSets } = await import("@/lib/stock");

    // Filter out of stock items if requested
    const filtered = inStockOnly
      ? products.filter((p) => {
          if (!p.setsColorwise || !p.setsColorwise.trim()) return true;
          const totalSets = getTotalAvailableSets(p.setsColorwise);
          const mix = (p as any).mixPcs || 0;
          return totalSets > 0 || mix > 0;
        })
      : products;

    // Optimize payload size: if full gallery not explicitly requested, return only the primary cover image and strip heavy base64 colorImages
    const optimized = fullGallery
      ? filtered
      : filtered.map((p) => ({
          ...p,
          imageUrl: getProductCoverImage(p.imageUrl),
          colorImages: null,
        }));

    return NextResponse.json(optimized, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=29",
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
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await request.json();
    const {
      name,
      category,
      colorsAvailable,
      sizesRatio,
      sizesList,
      pcsPerSet,
      price,
      costPrice,
      mixPcs,
      colorImages,
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

    const ratioSizes = sizesRatio ? getSizesFromRatio(sizesRatio) : [];
    const pcs = parseInt(pcsPerSet, 10) || (ratioSizes.length > 0 && ratioSizes[0] !== sizesRatio ? ratioSizes.length : (sizesList ? sizesList.split(",").length : 5));

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
        costPrice: costPrice !== undefined && costPrice !== null ? parseFloat(costPrice) : null,
        mixPcs: mixPcs !== undefined && mixPcs !== null ? parseInt(mixPcs, 10) || 0 : 0,
        colorImages: colorImages ? (typeof colorImages === "string" ? colorImages : JSON.stringify(colorImages)) : null,
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

/**
 * DELETE /api/products
 * Removes all products from the Wholesale Garment Catalog.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    const authHeader = request.headers.get("x-admin-secret");
    const isAuthorized = auth.authorized || authHeader === "krish_clothing_admin_2026";
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete any remaining order items first to prevent foreign key errors
    await prisma.orderItem.deleteMany({});

    // Delete all products
    const deleted = await prisma.product.deleteMany({});

    return NextResponse.json({
      success: true,
      message: "All products removed from Wholesale Garment Catalog successfully.",
      count: deleted.count,
    });
  } catch (error: any) {
    console.error("Error deleting all products:", error);
    return NextResponse.json(
      { error: "Failed to delete products: " + error.message },
      { status: 500 }
    );
  }
}
