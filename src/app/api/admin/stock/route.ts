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
import { requireAdmin, getAdminSession, getEmployeeSession } from "@/lib/auth-security";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && (!employee || !employee.canUpdateStock)) {
      return NextResponse.json({ error: "Unauthorized. Stock update permission required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeProfit = searchParams.get("includeProfit") === "1";

    const rawProducts = await prisma.product.findMany({
      select: {
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
        imageUrl: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    // Exclude transport-only miscellaneous products (e.g. IMPORTED TROUSERS MIX) from live stock
    const filteredProducts = rawProducts.filter(
      (p) => !p.name.toUpperCase().includes("IMPORTED TROUSER")
    );
    const products = sortProductsByImpSequence(filteredProducts);

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

    // Calculate aggregated inventory metrics
    const totalStyles = stockItems.length;
    const activeInStock = stockItems.filter((i) => i.totalSets > 0 || i.mixPcs > 0).length;
    const grandTotalSets = stockItems.reduce((acc, i) => acc + i.totalSets, 0);
    const grandTotalMixPcs = stockItems.reduce((acc, i) => acc + i.mixPcs, 0);
    const grandTotalPcs = stockItems.reduce((acc, i) => acc + i.totalPcs, 0);
    const grandTotalValuation = stockItems.reduce((acc, i) => acc + i.totalValuation, 0);

    let grandTotalSoldUnits = 0;
    let grandTotalSalesRevenue = 0;
    let grandTotalCostOfSold = 0;
    let grandTotalSoldProfit = 0;
    let overallMarginPercent = 0;
    let soldProfitBreakdown: any[] = [];
    let billProfitBreakdown: any[] = [];

    // Calculate aggregated sold units & profit from all non-cancelled orders only when requested (e.g. /admin/profit)
    if (includeProfit) {
      const soldOrders = await prisma.order.findMany({
        where: {
          status: { not: "Cancelled" },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  costPrice: true,
                  retailerPrice: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      });

      const soldPerProductMap = new Map<
        number,
        {
          productId: number;
          productName: string;
          category: string;
          soldUnits: number;
          avgSellingPrice: number;
          costPrice: number;
          sellingRevenue: number;
          totalCost: number;
          grossProfit: number;
          marginPercent: number;
        }
      >();

      for (const order of soldOrders) {
        let orderUnits = 0;
        let orderRev = 0;
        let orderCost = 0;

        for (const item of order.items) {
          const prodName = (item.productName || item.product?.name || "").toUpperCase();
          if (prodName.includes("IMPORTED TROUSER")) {
            continue; // Skip transport miscellaneous products from profit and sold metrics
          }

          const pcs = item.totalPcs || 0;
          const subtotal = item.itemSubtotal || (pcs * item.unitPrice) || 0;

          // Accurate unit costing:
          // If product costPrice is explicitly configured, use it; otherwise default to 70% of actual selling rate
          let prodCost = 0;
          if (item.product?.costPrice !== null && item.product?.costPrice !== undefined) {
            prodCost = item.product.costPrice;
          } else {
            prodCost = Math.round(item.unitPrice * 0.7);
          }
          const cost = Math.round(pcs * prodCost);
          const profit = Math.round(subtotal - cost);

          orderUnits += pcs;
          orderRev += subtotal;
          orderCost += cost;

          grandTotalSoldUnits += pcs;
          grandTotalSalesRevenue += subtotal;
          grandTotalCostOfSold += cost;

          const pId = item.productId;
          if (!soldPerProductMap.has(pId)) {
            soldPerProductMap.set(pId, {
              productId: pId,
              productName: item.productName || item.product?.name || "Garment",
              category: item.product?.category || "Trouser",
              soldUnits: 0,
              avgSellingPrice: 0,
              costPrice: prodCost,
              sellingRevenue: 0,
              totalCost: 0,
              grossProfit: 0,
              marginPercent: 0,
            });
          }
          const entry = soldPerProductMap.get(pId)!;
          entry.soldUnits += pcs;
          entry.sellingRevenue += subtotal;
          entry.totalCost += cost;
          entry.grossProfit += profit;
        }

        const orderProfit = Math.round(orderRev - orderCost);
        const orderMargin = orderRev > 0 ? Math.round((orderProfit / orderRev) * 1000) / 10 : 0;

        if (orderUnits > 0 || orderRev > 0) {
          billProfitBreakdown.push({
            billNo: order.taxInvoiceNumber || String(order.id),
            orderId: order.id,
            customerName: order.customerName || "Customer",
            date: (order.orderDate || order.createdAt).toISOString(),
            totalPcs: orderUnits,
            revenue: orderRev,
            cost: orderCost,
            profit: orderProfit,
            marginPercent: orderMargin,
          });
        }
      }

      soldProfitBreakdown = Array.from(soldPerProductMap.values()).map((p) => {
        p.avgSellingPrice = p.soldUnits > 0 ? Math.round(p.sellingRevenue / p.soldUnits) : 0;
        p.marginPercent = p.sellingRevenue > 0 ? Math.round((p.grossProfit / p.sellingRevenue) * 1000) / 10 : 0;
        return p;
      }).sort((a, b) => b.grossProfit - a.grossProfit);

      grandTotalSoldProfit = Math.round(grandTotalSalesRevenue - grandTotalCostOfSold);
      overallMarginPercent = grandTotalSalesRevenue > 0
        ? Math.round((grandTotalSoldProfit / grandTotalSalesRevenue) * 1000) / 10
        : 0;
    }

    return NextResponse.json({
      stockItems,
      metrics: {
        totalStyles,
        activeInStock,
        grandTotalSets,
        grandTotalMixPcs,
        grandTotalPcs,
        grandTotalValuation,
        grandTotalSoldUnits,
        grandTotalSalesRevenue,
        grandTotalCostOfSold,
        grandTotalSoldProfit,
        overallMarginPercent,
        soldProfitBreakdown,
        billProfitBreakdown,
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
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && (!employee || !employee.canUpdateStock)) {
      return NextResponse.json({ error: "Permission Denied: Stock update access required." }, { status: 403 });
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
    if (body.imageUrl !== undefined) {
      updateData.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    }
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

    // Real-time auto-sync directly to E-Commerce database
    try {
      const { syncWholesaleProductToEcommerce } = await import("@/lib/stock-sync");
      await syncWholesaleProductToEcommerce(id);
    } catch (ecomSyncErr) {
      console.warn("Direct E-Commerce stock sync warning:", ecomSyncErr);
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
