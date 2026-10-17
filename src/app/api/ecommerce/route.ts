import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getTotalAvailableSets,
  parseColorwiseSets,
  getAllProductColors,
  deductSetsFromStock,
  restoreSetsToStock,
  parseDetailedColorStockWithLoose,
  calculateColorSizesBreakdown,
  calculateTotalColorPieces,
  cleanColorName,
  sellSingleSizeFromColorStock,
} from "@/lib/stock";
import { getProductCoverImage, getProductAllImages } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public & Secure E-Commerce Integration API
 * 
 * Enables seamless integration between your Stock Tab (/admin/stock)
 * and any external or custom E-Commerce Website (Shopify, WooCommerce, Custom Next.js/React storefront).
 * 
 * Features:
 * 1. Automatic Real-Time PCS Sync: Total PCS = Total Sets × PCS per Set + Mix PCS
 * 2. Automatic Out-of-Stock Filter: If total PCS = 0, automatically removed from customer view
 * 3. Colorwise stock breakdown for variation pickers
 * 4. Automatic Stock Deduction on E-commerce Order Placement
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "products";
    // For products feed, default to in-stock only. For inventory sync feed, default to all products (to detect 0-stock)
    const inStockOnly = action === "inventory"
      ? searchParams.get("in_stock_only") === "1"
      : searchParams.get("in_stock_only") !== "0";
    const category = searchParams.get("category");

    const where: any = { isActive: true };
    if (category && category !== "All") {
      where.category = category;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // 1. Lightweight Inventory Feed (ideal for periodic background polling by Shopify/WooCommerce)
    if (action === "inventory") {
      const inventoryFeed = products.map((p) => {
        const totalSets = getTotalAvailableSets(p.setsColorwise);
        const pcsPerSet = p.pcsPerSet || 5;
        const mixPcs = (p as any).mixPcs || 0;
        const totalPcs = totalSets * pcsPerSet + mixPcs;
        const inStock = totalPcs > 0;

        return {
          productId: p.id,
          sku: `KC-${p.id}`,
          name: p.name,
          category: p.category,
          totalSets,
          pcsPerSet,
          mixPcs,
          totalPcs,
          inStock,
          updatedAt: p.updatedAt,
        };
      });

      return NextResponse.json({
        success: true,
        count: inventoryFeed.length,
        inventory: inStockOnly ? inventoryFeed.filter((i) => i.inStock) : inventoryFeed,
      });
    }

    // 2. Full Products Feed for E-Commerce Storefront
    const ecommerceProducts = products
      .map((p) => {
        const totalSets = getTotalAvailableSets(p.setsColorwise);
        const pcsPerSet = p.pcsPerSet || 5;
        const mixPcs = (p as any).mixPcs || 0;

        const colors = getAllProductColors(p.colorsAvailable, p.setsColorwise, p.colorMapping);
        const detailedStock = parseDetailedColorStockWithLoose(p.setsColorwise, p.sizesRatio || "30 to 38");

        // Build color breakdown with real-time PCS and retail size matrix
        let computedTotalPcs = 0;
        let computedTotalSets = 0;
        let computedTotalLoose = 0;

        const colorBreakdown = colors.map((col) => {
          const clean = cleanColorName(col);
          const detail = detailedStock[clean] || detailedStock[col] || { ratios: {}, loosePcs: {} };
          const colorCalc = calculateTotalColorPieces(detail.ratios, detail.loosePcs, pcsPerSet);
          const sizesBreakdown = calculateColorSizesBreakdown(detail.ratios, detail.loosePcs);

          computedTotalPcs += colorCalc.totalPcs;
          computedTotalSets += colorCalc.totalSets;
          computedTotalLoose += colorCalc.loosePcs;

          return {
            color: col,
            setsInStock: colorCalc.totalSets,
            loosePcsInStock: colorCalc.loosePcs,
            pcsInStock: colorCalc.totalPcs,
            inStock: colorCalc.totalPcs > 0,
            ratios: detail.ratios,
            loosePcs: detail.loosePcs,
            sizesBreakdown,
          };
        });

        const finalTotalPcs = computedTotalPcs > 0 ? computedTotalPcs : (totalSets * pcsPerSet + mixPcs);
        const finalTotalSets = computedTotalSets > 0 ? computedTotalSets : totalSets;
        const finalTotalLoose = computedTotalLoose > 0 ? computedTotalLoose : mixPcs;
        const inStock = finalTotalPcs > 0;

        const allImages = getProductAllImages(p.imageUrl);
        const coverImage = getProductCoverImage(p.imageUrl);

        let colorImagesMap: Record<string, string> = {};
        if (p.colorImages) {
          try {
            colorImagesMap = JSON.parse(p.colorImages);
          } catch {}
        }

        return {
          id: p.id,
          sku: `KC-${p.id}`,
          name: p.name,
          category: p.category,
          price: p.retailerPrice || p.price,
          retailerPrice: p.retailerPrice || p.price,
          wholesalerPrice: p.wholesalerPrice || (p.retailerPrice ? p.retailerPrice - 100 : p.price - 100),
          mrp: p.mrp || (p.retailerPrice ? p.retailerPrice * 2 : p.price * 2),
          sizesRatio: p.sizesRatio || "30 to 38",
          sizesList: p.sizesList || "30, 32, 34, 36, 38",
          pcsPerSet,
          totalSets: finalTotalSets,
          mixPcs: finalTotalLoose,
          totalPcs: finalTotalPcs,
          inStock,
          images: allImages,
          coverImage,
          colorImages: colorImagesMap,
          colors: colorBreakdown,
          sizeGuide: p.sizeGuide,
          updatedAt: p.updatedAt,
        };
      })
      // Automatically remove Out of Stock products from customer view!
      .filter((p) => (inStockOnly ? p.inStock : true));

    return NextResponse.json({
      success: true,
      store: "Krish Clothing Co. E-Commerce Integration",
      totalProducts: ecommerceProducts.length,
      products: ecommerceProducts,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=29",
      },
    });
  } catch (error: any) {
    console.error("E-commerce API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handle Order Placement or Stock Webhook from E-Commerce Website
 * 
 * Automatically deducts stock from the Stock Tab in real-time
 * when an e-commerce customer places an order!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "order"; // "order" | "webhook" | "stock_sync"

    // Action: Order placed on E-Commerce Storefront
    if (action === "order" || action === "deduct") {
      const items: Array<{
        productId: number;
        color: string;
        sets: number;
        pcs?: number;
      }> = body.items || [];

      if (!items || items.length === 0) {
        return NextResponse.json({ error: "No items provided in order" }, { status: 400 });
      }

      const updatedProducts: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of items as any) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || !product.setsColorwise || product.setsColorwise.trim() === "") continue;

          // 1. Single-size sale (e.g. retail order specifying size)
          if (item.size) {
            const detailed = parseDetailedColorStockWithLoose(product.setsColorwise, product.sizesRatio || "30 to 38");
            const cleanCol = cleanColorName(item.color);
            const colorStock = detailed[cleanCol] || { ratios: {}, loosePcs: {} };

            const qty = Number(item.quantity || item.pcs || 1);
            let curRatios = { ...colorStock.ratios };
            let curLoose = { ...colorStock.loosePcs };

            for (let q = 0; q < qty; q++) {
              const res = sellSingleSizeFromColorStock(curRatios, curLoose, String(item.size));
              if (res.success) {
                curRatios = res.ratios;
                curLoose = res.loosePcs;
              }
            }

            detailed[cleanCol] = {
              ratios: curRatios,
              loosePcs: curLoose,
            };

            let totalLooseAcrossColors = 0;
            for (const d of Object.values(detailed)) {
              for (const cnt of Object.values(d.loosePcs)) {
                totalLooseAcrossColors += cnt;
              }
            }

            const updated = await tx.product.update({
              where: { id: item.productId },
              data: {
                setsColorwise: JSON.stringify(detailed),
                mixPcs: totalLooseAcrossColors,
              },
            });

            const newTotalSets = getTotalAvailableSets(updated.setsColorwise);
            const newTotalPcs = newTotalSets * (updated.pcsPerSet || 5) + ((updated as any).mixPcs || 0);

            updatedProducts.push({
              productId: updated.id,
              name: updated.name,
              color: item.color,
              size: item.size,
              quantityDeducted: qty,
              remainingSets: newTotalSets,
              remainingPcs: newTotalPcs,
              inStock: newTotalPcs > 0,
            });
          } else {
            // 2. Whole sets wholesale order
            const deductMap = [{ color: item.color, sets: Number(item.sets) || 1 }];
            const updatedStockStr = deductSetsFromStock(product.setsColorwise, deductMap);

            const updated = await tx.product.update({
              where: { id: item.productId },
              data: {
                setsColorwise: updatedStockStr,
              },
            });

            const newTotalSets = getTotalAvailableSets(updated.setsColorwise);
            const newTotalPcs = newTotalSets * (updated.pcsPerSet || 5) + ((updated as any).mixPcs || 0);

            updatedProducts.push({
              productId: updated.id,
              name: updated.name,
              color: item.color,
              setsDeducted: item.sets,
              remainingSets: newTotalSets,
              remainingPcs: newTotalPcs,
              inStock: newTotalPcs > 0,
            });
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: "E-Commerce order processed and stock synchronized automatically!",
        deductedItems: updatedProducts,
      });
    }

    // Action: Order cancelled on E-Commerce Storefront (restores stock)
    if (action === "cancel" || action === "restore") {
      const items: Array<{
        productId: number;
        color: string;
        sets: number;
      }> = body.items || [];

      const restoredProducts: any[] = [];

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || !product.setsColorwise) continue;

          const restoreMap = [{ color: item.color, sets: Number(item.sets) || 1 }];
          const updatedStockStr = restoreSetsToStock(product.setsColorwise, restoreMap);

          const updated = await tx.product.update({
            where: { id: item.productId },
            data: { setsColorwise: updatedStockStr },
          });

          const newTotalSets = getTotalAvailableSets(updated.setsColorwise);
          const newTotalPcs = newTotalSets * (updated.pcsPerSet || 5) + ((updated as any).mixPcs || 0);

          restoredProducts.push({
            productId: updated.id,
            remainingSets: newTotalSets,
            remainingPcs: newTotalPcs,
            inStock: newTotalPcs > 0,
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: "Stock restored successfully from cancelled e-commerce order!",
        restoredItems: restoredProducts,
      });
    }

    return NextResponse.json({ error: "Invalid action. Supported: order, deduct, cancel, restore" }, { status: 400 });
  } catch (error: any) {
    console.error("E-commerce webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
