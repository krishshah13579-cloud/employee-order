import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  parseColorwiseSets,
  getTotalAvailableSets,
  getAllProductColors,
  parseDetailedColorRatioSets,
  getSizesFromRatio,
  isColorSoldOut,
  getColorShadeLetter,
} from "@/lib/stock";
import { sendColorSoldOutNotification } from "@/lib/email";
import { getProductCoverImage, sortProductsByImpSequence } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth-security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const rawProducts = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    const products = sortProductsByImpSequence(rawProducts);

    const stockItems = products.map((p) => {
      const colors = getAllProductColors(p.colorsAvailable, p.setsColorwise, p.colorMapping);
      const totalSets = getTotalAvailableSets(p.setsColorwise);
      const detailedRatioSets = parseDetailedColorRatioSets(p.setsColorwise, p.sizesRatio || "30 to 38");

      // Calculate total set pieces dynamically from ratio breakdown (supports 2 to 8 sizes accurately)
      let accurateSetPcs = 0;
      let hasRatioBreakdown = false;
      for (const ratios of Object.values(detailedRatioSets)) {
        for (const [rKey, count] of Object.entries(ratios)) {
          const cnt = Math.max(0, count || 0);
          if (cnt > 0) {
            hasRatioBreakdown = true;
            const rSizes = getSizesFromRatio(rKey);
            const rPcs = rSizes.length > 0 && rSizes[0] !== rKey ? rSizes.length : (p.pcsPerSet || 5);
            accurateSetPcs += cnt * rPcs;
          }
        }
      }
      const pcsPerSet = p.pcsPerSet || 5;
      const totalSetPcs = hasRatioBreakdown ? accurateSetPcs : totalSets * pcsPerSet;
      const mixPcs = (p as any).mixPcs || 0;
      const totalPcs = totalSetPcs + mixPcs;
      const costPrice = (p as any).costPrice !== null && (p as any).costPrice !== undefined ? (p as any).costPrice : Math.round((p.retailerPrice || p.price) * 0.7);
      const sellingRate = p.retailerPrice || p.price;
      const totalValuation = Math.round(totalPcs * (costPrice || sellingRate));

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

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
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
    if (body.sizesRatio) {
      const cleanRatio = String(body.sizesRatio).trim();
      const rSizes = getSizesFromRatio(cleanRatio);
      updateData.sizesRatio = cleanRatio;
      updateData.sizesList = rSizes.join(", ");
      updateData.pcsPerSet = rSizes.length > 0 && rSizes[0] !== cleanRatio ? rSizes.length : (existing.pcsPerSet || 5);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Check if any color variant became sold out after this stock update
    if (updateData.setsColorwise !== undefined && existing.setsColorwise) {
      const allColors = getAllProductColors(existing.colorsAvailable, existing.setsColorwise, existing.colorMapping);
      const newlySoldOut: Array<{ productName: string; colorName: string; colorAlphabet: string }> = [];
      for (let colIdx = 0; colIdx < allColors.length; colIdx++) {
        const col = allColors[colIdx];
        const wasInStock = !isColorSoldOut(existing.setsColorwise, col, existing.colorMapping);
        const isNowSoldOut = isColorSoldOut(updateData.setsColorwise, col, existing.colorMapping);
        if (wasInStock && isNowSoldOut) {
          const colorAlphabet = getColorShadeLetter(existing, col, colIdx);
          newlySoldOut.push({
            productName: existing.name,
            colorName: col,
            colorAlphabet,
          });
        }
      }
      if (newlySoldOut.length > 0) {
        sendColorSoldOutNotification(newlySoldOut).catch((err) =>
          console.error("Sold out email notification error on stock update:", err)
        );
      }
    }

    // Real-time auto-sync to Storefront (www.iqtrousers.in)
    try {
      const totalSets = getTotalAvailableSets(updated.setsColorwise);
      const detailedRatioSets = parseDetailedColorRatioSets(updated.setsColorwise, updated.sizesRatio || "30 to 38");
      let accurateSetPcs = 0;
      let hasRatioBreakdown = false;
      for (const ratios of Object.values(detailedRatioSets)) {
        for (const [rKey, count] of Object.entries(ratios)) {
          const cnt = Math.max(0, count || 0);
          if (cnt > 0) {
            hasRatioBreakdown = true;
            const rSizes = getSizesFromRatio(rKey);
            const rPcs = rSizes.length > 0 && rSizes[0] !== rKey ? rSizes.length : (updated.pcsPerSet || 5);
            accurateSetPcs += cnt * rPcs;
          }
        }
      }
      const pcsPerSet = updated.pcsPerSet || 5;
      const totalSetPcs = hasRatioBreakdown ? accurateSetPcs : totalSets * pcsPerSet;
      const totalPcs = totalSetPcs + (updated.mixPcs || 0);

      fetch("https://www.iqtrousers.in/api/sync-stock", {
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
