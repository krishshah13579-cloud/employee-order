import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseColorwiseSets, getTotalAvailableSets, getAllProductColors, parseDetailedColorRatioSets } from "@/lib/stock";
import { getProductCoverImage } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const stockItems = products.map((p) => {
      const colors = getAllProductColors(p.colorsAvailable, p.setsColorwise, p.colorMapping);
      const totalSets = getTotalAvailableSets(p.setsColorwise);
      const pcsPerSet = p.pcsPerSet || 5;
      const totalSetPcs = totalSets * pcsPerSet;
      const mixPcs = (p as any).mixPcs || 0;
      const totalPcs = totalSetPcs + mixPcs;
      const costPrice = (p as any).costPrice !== null && (p as any).costPrice !== undefined ? (p as any).costPrice : Math.round((p.retailerPrice || p.price) * 0.7);
      const sellingRate = p.retailerPrice || p.price;
      const totalValuation = Math.round(totalPcs * (costPrice || sellingRate));
      const detailedRatioSets = parseDetailedColorRatioSets(p.setsColorwise, p.sizesRatio || "30 to 38");

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        imageUrl: getProductCoverImage(p.imageUrl),
        colorsAvailable: p.colorsAvailable,
        colorMapping: p.colorMapping,
        colors,
        sizesRatio: p.sizesRatio,
        pcsPerSet,
        mrp: p.mrp,
        retailerPrice: p.retailerPrice,
        wholesalerPrice: p.wholesalerPrice,
        price: p.price,
        costPrice,
        mixPcs,
        totalSets,
        totalSetPcs,
        totalPcs,
        totalValuation,
        setsColorwise: p.setsColorwise,
        detailedRatioSets,
        isActive: p.isActive,
      };
    });

    // Calculate aggregated metrics
    const totalStyles = stockItems.length;
    const activeInStock = stockItems.filter((i) => i.totalSets > 0 || i.mixPcs > 0).length;
    const grandTotalSets = stockItems.reduce((acc, i) => acc + i.totalSets, 0);
    const grandTotalMixPcs = stockItems.reduce((acc, i) => acc + i.mixPcs, 0);
    const grandTotalPcs = stockItems.reduce((acc, i) => acc + i.totalPcs, 0);
    const grandTotalValuation = stockItems.reduce((acc, i) => acc + i.totalValuation, 0);

    return NextResponse.json({
      stockItems,
      metrics: {
        totalStyles,
        activeInStock,
        grandTotalSets,
        grandTotalMixPcs,
        grandTotalPcs,
        grandTotalValuation,
      },
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=29",
      },
    });
  } catch (error: any) {
    console.error("Error fetching stock:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock: " + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await request.json();
    const { productId, mixPcs, costPrice, setsColorwise } = body;

    const id = parseInt(String(productId), 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const updateData: any = {};
    if (mixPcs !== undefined) {
      updateData.mixPcs = Math.max(0, parseInt(String(mixPcs), 10) || 0);
    }
    if (costPrice !== undefined) {
      updateData.costPrice = costPrice === "" || costPrice === null ? null : parseFloat(String(costPrice)) || 0;
    }
    if (setsColorwise !== undefined) {
      updateData.setsColorwise = typeof setsColorwise === "string" ? setsColorwise : JSON.stringify(setsColorwise);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Real-time auto-sync to Storefront (iq-trousers-store-uge4.vercel.app)
    try {
      const totalSets = getTotalAvailableSets(updated.setsColorwise);
      const pcsPerSet = updated.pcsPerSet || 5;
      const totalPcs = totalSets * pcsPerSet + (updated.mixPcs || 0);

      fetch("https://iq-trousers-store-uge4.vercel.app/api/sync-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleCode: updated.name,
          totalPcs,
          inStock: totalPcs > 0,
        }),
      }).catch((err) =>
        console.warn("Auto-sync storefront notification failed:", err.message)
      );
    } catch (e: any) {
      console.warn("Stock sync trigger error:", e?.message);
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    console.error("Error updating stock:", error);
    return NextResponse.json(
      { error: "Failed to update stock: " + error.message },
      { status: 500 }
    );
  }
}
