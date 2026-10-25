import { prisma } from "@/lib/prisma";
import {
  parseColorwiseSets,
  parseDetailedColorRatioSets,
  getAllProductColors,
  getSizesFromRatio,
  cleanColorName,
} from "@/lib/stock";

export function normalizeCode(str: string): string {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Synchronizes a single wholesale product to its corresponding E-Commerce product.
 * Enforces the "1-Set Break Limit" rule:
 * - If loose pieces exist, e-commerce sells from loose pieces.
 * - If no loose pieces exist but sets > 0, unlocks at most 1 set (1 pc each of 30, 32, 34, 36, 38).
 * - Once any size is sold from that set, does NOT automatically unlock a new set.
 */
export async function syncWholesaleProductToEcommerce(wholesaleProductId: number) {
  try {
    const wholesaleProduct = await prisma.product.findUnique({
      where: { id: wholesaleProductId },
    });

    if (!wholesaleProduct) return null;

    const canonicalCode = normalizeCode(wholesaleProduct.name);
    if (!canonicalCode) return null;

    // Find matching E-Commerce product
    const ecomProducts = await prisma.ecommerceProduct.findMany({
      select: { id: true, name: true, slug: true, inventory: true, active: true },
    });

    const matchedEcom = ecomProducts.find((ep) => {
      return (
        normalizeCode(ep.name) === canonicalCode ||
        normalizeCode(ep.slug) === canonicalCode
      );
    });

    if (!matchedEcom) {
      // E-commerce only sells a subset of wholesale products
      return null;
    }

    const availableColors = getAllProductColors(
      wholesaleProduct.colorsAvailable,
      wholesaleProduct.setsColorwise,
      wholesaleProduct.colorMapping
    );

    const detailedRatioSets = parseDetailedColorRatioSets(
      wholesaleProduct.setsColorwise,
      wholesaleProduct.sizesRatio || "30 to 38"
    );

    // Existing online inventory map: { [color]: { [size]: count } }
    let currentOnlineInventory: Record<string, Record<string, number>> = {};
    try {
      if (matchedEcom.inventory && matchedEcom.inventory.trim().startsWith("{")) {
        currentOnlineInventory = JSON.parse(matchedEcom.inventory);
      }
    } catch {}

    const newInventoryMap: Record<string, Record<string, number>> = {};
    let totalPieces = 0;

    // Determine default sizes array from wholesale product
    const defaultSizes = getSizesFromRatio(wholesaleProduct.sizesRatio || "30 to 38");
    const standardSizes =
      defaultSizes.length > 0 && defaultSizes[0] !== wholesaleProduct.sizesRatio
        ? defaultSizes
        : ["30", "32", "34", "36", "38"];

    for (const color of availableColors) {
      const cleanColor = cleanColorName(color);
      const colorRatios = detailedRatioSets[cleanColor] || {};

      // Calculate total available wholesale sets for this color
      let totalSetsForColor = 0;
      for (const count of Object.values(colorRatios)) {
        totalSetsForColor += Math.max(0, count || 0);
      }

      const existingColorBreakdown = currentOnlineInventory[color] || currentOnlineInventory[cleanColor] || {};
      const newBreakdown: Record<string, number> = {};

      if (totalSetsForColor <= 0) {
        // Wholesale has 0 sets left for this color -> Out of stock online
        for (const sz of standardSizes) {
          newBreakdown[sz] = 0;
        }
      } else {
        // Wholesale has sets available (> 0)
        // Check if an existing broken set is currently active online
        const hasExistingBrokenSet = Object.keys(existingColorBreakdown).length > 0 &&
          Object.values(existingColorBreakdown).some((qty) => qty > 0);

        if (hasExistingBrokenSet) {
          // A set was ALREADY broken for this color.
          // By the strict rule: "Once any particular size is sold from that set don't make any size available from new set."
          // We preserve the current online breakdown (do NOT replenish sold-out sizes from a new set).
          for (const sz of standardSizes) {
            const currentQty = Number(existingColorBreakdown[sz]) || 0;
            // Cap at 1 pc per size from the single unlocked set
            newBreakdown[sz] = Math.min(1, Math.max(0, currentQty));
            totalPieces += newBreakdown[sz];
          }
        } else {
          // No set is currently broken for this color, but wholesale has sets available.
          // Unlock EXACTLY 1 SET: 1 pc for each size (e.g. 30, 32, 34, 36, 38)
          for (const sz of standardSizes) {
            newBreakdown[sz] = 1;
            totalPieces += 1;
          }
        }
      }

      newInventoryMap[color] = newBreakdown;
    }

    // Update E-Commerce Product
    const updatedEcom = await prisma.ecommerceProduct.update({
      where: { id: matchedEcom.id },
      data: {
        inventory: JSON.stringify(newInventoryMap),
        stock: totalPieces,
        active: totalPieces > 0 ? matchedEcom.active : false,
      },
    });

    return {
      wholesaleId: wholesaleProduct.id,
      ecomId: updatedEcom.id,
      name: updatedEcom.name,
      totalPieces,
      inventory: newInventoryMap,
    };
  } catch (error: any) {
    console.error(`Failed to sync wholesale product ${wholesaleProductId} to ecom:`, error);
    return null;
  }
}

/**
 * Synchronizes ALL wholesale products to corresponding E-Commerce products in batch.
 */
export async function syncAllCatalogStock() {
  const wholesaleProducts = await prisma.product.findMany({
    select: { id: true },
  });

  const results: any[] = [];
  for (const wp of wholesaleProducts) {
    const res = await syncWholesaleProductToEcommerce(wp.id);
    if (res) results.push(res);
  }

  return results;
}
