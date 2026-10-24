/**
 * Garment Wholesale Stock & Sets Helper Utilities
 * Handles parsing, validating, and updating color-wise stock sets.
 */

export interface ColorSetsStock {
  [color: string]: number;
}

/**
 * Parses setsColorwise string from product into a Record<string, number>.
 * Supports:
 * - JSON string: '{"Jet Black": 20, "Navy Blue": 15}'
 * - Colon-separated list: 'Jet Black: 20 sets, Navy Blue: 15 sets' or 'Jet Black: 20, Navy Blue: 15'
 * - Single number fallback: '25'
 */
export function parseColorwiseSets(raw: string | null | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  if (!raw) return result;

  const trimmed = raw.trim();
  if (!trimmed) return result;

  // 1. JSON Format
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "object" && v !== null) {
            // Nested breakdown, e.g. { ratios: {"30 to 38": 5}, loosePcs: {"34": 3} } or {"30 to 38": 5}
            let subtotal = 0;
            const ratioSource = (v as any).ratios && typeof (v as any).ratios === "object" ? (v as any).ratios : v;
            for (const [rK, rSets] of Object.entries(ratioSource)) {
              if (rK !== "loose" && rK !== "loosePcs") {
                const n = parseInt(String(rSets), 10);
                if (!isNaN(n)) subtotal += Math.max(0, n);
              }
            }
            result[k.trim()] = subtotal;
          } else {
            const num = parseInt(String(v), 10);
            if (!isNaN(num)) {
              result[k.trim()] = Math.max(0, num);
            }
          }
        }
        return result;
      }
    } catch {}
  }

  // 2. Comma or newline separated pairs: "Jet Black: 20 sets, Navy Blue: 15"
  const parts = trimmed.split(/[,;\n]+/);
  let foundPairs = false;

  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx !== -1) {
      const color = part.substring(0, colonIdx).trim();
      const valStr = part.substring(colonIdx + 1).replace(/[^0-9]/g, "").trim();
      const num = parseInt(valStr, 10);
      if (color && !isNaN(num)) {
        result[color] = Math.max(0, num);
        foundPairs = true;
      }
    }
  }

  if (foundPairs) return result;

  // 3. Single number fallback
  const cleanNum = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(cleanNum)) {
    result["__default__"] = Math.max(0, cleanNum);
  }

  return result;
}

/**
 * Parses detailed ratio breakdown for each color.
 * Returns: { "Navy Blue": { "30 to 38": 5, "32 to 38": 1 }, ... }
 */
export function parseDetailedColorRatioSets(
  raw: string | null | undefined,
  defaultRatio: string = "28 to 36"
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  if (!raw) return result;
  const trimmed = raw.trim();
  if (!trimmed) return result;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [col, val] of Object.entries(parsed)) {
          const colorKey = cleanColorName(col.trim());
          if (!colorKey) continue;
          if (typeof val === "object" && val !== null) {
            result[colorKey] = {};
            const ratioSource = (val as any).ratios && typeof (val as any).ratios === "object" ? (val as any).ratios : val;
            for (const [ratioKey, count] of Object.entries(ratioSource)) {
              if (ratioKey !== "loose" && ratioKey !== "loosePcs") {
                result[colorKey][ratioKey.trim()] = Math.max(0, parseInt(String(count), 10) || 0);
              }
            }
          } else {
            const num = parseInt(String(val), 10);
            result[colorKey] = {
              [defaultRatio]: Math.max(0, isNaN(num) ? 0 : num),
            };
          }
        }
        return result;
      }
    } catch {}
  }

  // Fallback to flat map
  const flat = parseColorwiseSets(raw);
  for (const [col, num] of Object.entries(flat)) {
    const colorKey = cleanColorName(col);
    if (colorKey && colorKey !== "__default__") {
      result[colorKey] = { [defaultRatio]: num };
    }
  }
  return result;
}

export interface ColorStockDetail {
  ratios: Record<string, number>;
  loosePcs: Record<string, number>;
}

/**
 * Parses full color breakdown including both ratio sets and single size loose pieces.
 * Returns: { "Indigo": { ratios: { "30 to 38": 5, "32 to 38": 1 }, loosePcs: { "34": 3, "36": 2 } } }
 */
export function parseDetailedColorStockWithLoose(
  raw: string | null | undefined,
  defaultRatio: string = "28 to 36"
): Record<string, ColorStockDetail> {
  const result: Record<string, ColorStockDetail> = {};
  if (!raw) return result;
  const trimmed = raw.trim();
  if (!trimmed) return result;

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [col, val] of Object.entries(parsed)) {
          const colorKey = cleanColorName(col.trim());
          if (!colorKey) continue;
          result[colorKey] = { ratios: {}, loosePcs: {} };

          if (typeof val === "object" && val !== null) {
            if ((val as any).ratios || (val as any).loosePcs) {
              const rMap = (val as any).ratios || {};
              for (const [rK, cnt] of Object.entries(rMap)) {
                result[colorKey].ratios[rK.trim()] = Math.max(0, parseInt(String(cnt), 10) || 0);
              }
              const lMap = (val as any).loosePcs || (val as any).loose || {};
              for (const [sK, cnt] of Object.entries(lMap)) {
                result[colorKey].loosePcs[sK.trim()] = Math.max(0, parseInt(String(cnt), 10) || 0);
              }
            } else {
              // Flat object e.g. {"30 to 38": 5, "32 to 38": 1}
              for (const [k, v] of Object.entries(val)) {
                if (k === "loose" || k === "loosePcs") {
                  if (typeof v === "object" && v !== null) {
                    for (const [sK, cnt] of Object.entries(v as any)) {
                      result[colorKey].loosePcs[sK.trim()] = Math.max(0, parseInt(String(cnt), 10) || 0);
                    }
                  }
                } else {
                  result[colorKey].ratios[k.trim()] = Math.max(0, parseInt(String(v), 10) || 0);
                }
              }
            }
          } else {
            const num = parseInt(String(val), 10);
            result[colorKey].ratios[defaultRatio] = Math.max(0, isNaN(num) ? 0 : num);
          }
        }
        return result;
      }
    } catch {}
  }

  // Fallback to flat map
  const flat = parseColorwiseSets(raw);
  for (const [col, num] of Object.entries(flat)) {
    const colorKey = cleanColorName(col);
    if (colorKey && colorKey !== "__default__") {
      result[colorKey] = {
        ratios: { [defaultRatio]: num },
        loosePcs: {},
      };
    }
  }
  return result;
}

/**
 * Extracts mandatory sizes from a size ratio string.
 * Supports "30 to 38", "30x38", "32 to 38", "28 to 36", etc.
 */
export function getSizesFromRatio(ratio: string): string[] {
  if (!ratio) return [];
  const clean = ratio.trim().toLowerCase();
  if (clean === "s to xxl") return ["S", "M", "L", "XL", "XXL"];
  if (clean === "m to 3xl") return ["M", "L", "XL", "XXL", "3XL"];

  // Match any "X to Y", "XxY", "X-Y", "X - Y" with optional surrounding labels (e.g. "28 to 40 - 7 pcs")
  const match = clean.match(/(\d+)\s*(?:to|x|-)\s*(\d+)/i);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end && (end - start) <= 30) {
      const sizes: string[] = [];
      for (let s = start; s <= end; s += 2) {
        sizes.push(String(s));
      }
      return sizes;
    }
  }

  // Exact fallback mappings
  if (clean === "28 to 36" || clean === "28x36") return ["28", "30", "32", "34", "36"];
  if (clean === "28 to 34" || clean === "28x34" || clean.includes("28 to 34")) return ["28", "30", "32", "34"];
  if (clean === "30 to 38" || clean === "30x38") return ["30", "32", "34", "36", "38"];
  if (clean === "32 to 38" || clean === "32x38") return ["32", "34", "36", "38"];
  if (clean === "28 to 38" || clean === "28x38") return ["28", "30", "32", "34", "36", "38"];
  if (clean === "30 to 40" || clean === "30x40") return ["30", "32", "34", "36", "38", "40"];
  if (clean === "32 to 40" || clean === "32x40") return ["32", "34", "36", "38", "40"];
  if (clean === "28 to 40" || clean === "28x40") return ["28", "30", "32", "34", "36", "38", "40"];
  if (clean === "28 to 42" || clean === "28x42") return ["28", "30", "32", "34", "36", "38", "40", "42"];
  if (clean === "38 to 40" || clean === "38x40") return ["38", "40"];
  if (clean === "26 to 40" || clean === "26x40") return ["26", "28", "30", "32", "34", "36", "38", "40"];
  if (clean === "32 to 42" || clean === "32x42") return ["32", "34", "36", "38", "40", "42"];

  return [ratio];
}

/**
 * Returns number of pieces per set for a size ratio.
 */
export function getPcsFromRatio(ratio: string, fallback: number = 5): number {
  const sizes = getSizesFromRatio(ratio);
  return sizes.length > 0 && sizes[0] !== ratio ? sizes.length : fallback;
}

/**
 * Sorts ratio keys according to garment business rules:
 * Product's configured primaryRatio (if given) is prioritized FIRST (0),
 * followed by standard wholesale ratios:
 * "28 to 36" (5 pcs), "28 to 34" (4 pc set), "30 to 38" (5 pcs), etc.
 */
export function sortSizeRatioKeys(ratios: string[], primaryRatio?: string): string[] {
  const cleanPrimary = primaryRatio ? primaryRatio.trim().toLowerCase() : "";

  const getPriority = (raw: string): number => {
    const clean = raw.trim().toLowerCase();
    if (cleanPrimary && clean === cleanPrimary) return 0;
    if (clean === "28 to 36" || clean === "28x36") return 1;
    if (clean === "28 to 34" || clean === "28x34" || clean.includes("28 to 34") || clean.includes("4 pc") || clean.includes("4pc")) return 2;
    if (clean === "30 to 38" || clean === "30x38") return 3;
    if (clean === "32 to 38" || clean === "32x38") return 4;
    if (clean === "28 to 40" || clean === "28x40") return 5;
    if (clean === "28 to 42" || clean === "28x42") return 6;
    if (clean === "38 to 40" || clean === "38x40") return 7;
    return 10;
  };

  return [...ratios].sort((a, b) => {
    const pA = getPriority(a);
    const pB = getPriority(b);
    if (pA !== pB) return pA - pB;
    return a.localeCompare(b);
  });
}

/**
 * Calculates real-time single size piece counts for a color from its sets and loose pieces.
 * e.g. Indigo: 5 sets of 30-38 + 1 set of 32-38 + loose: { 34: 3, 36: 2 }
 * Returns: { "30": 5, "32": 6, "34": 9, "36": 8, "38": 6 }
 */
export function calculateColorSizesBreakdown(
  ratios: Record<string, number>,
  loosePcs: Record<string, number> = {}
): Record<string, number> {
  const sizeStock: Record<string, number> = {};

  // 1. Add pieces from sets
  for (const [ratio, setCount] of Object.entries(ratios)) {
    const count = Math.max(0, setCount || 0);
    if (count <= 0) continue;
    const sizes = getSizesFromRatio(ratio);
    for (const sz of sizes) {
      sizeStock[sz] = (sizeStock[sz] || 0) + count;
    }
  }

  // 2. Add loose pieces for each size
  for (const [sz, looseCount] of Object.entries(loosePcs)) {
    const count = Math.max(0, looseCount || 0);
    if (count <= 0) continue;
    sizeStock[sz] = (sizeStock[sz] || 0) + count;
  }

  return sizeStock;
}

/**
 * Calculates total piece statistics for a color:
 * Set pieces + Loose pieces = Total pieces.
 */
export function calculateTotalColorPieces(
  ratios: Record<string, number>,
  loosePcs: Record<string, number> = {},
  fallbackPcsPerSet: number = 5
): { setPcs: number; loosePcs: number; totalPcs: number; totalSets: number } {
  let setPcs = 0;
  let totalSets = 0;

  for (const [ratio, setCount] of Object.entries(ratios)) {
    const count = Math.max(0, setCount || 0);
    totalSets += count;
    const sizes = getSizesFromRatio(ratio);
    const pcsInSet = sizes.length > 0 ? sizes.length : fallbackPcsPerSet;
    setPcs += count * pcsInSet;
  }

  let totalLoose = 0;
  for (const count of Object.values(loosePcs)) {
    totalLoose += Math.max(0, count || 0);
  }

  return {
    setPcs,
    loosePcs: totalLoose,
    totalPcs: setPcs + totalLoose,
    totalSets,
  };
}

/**
 * Calculates pieces and breakdown for a requested number of sets of a specific color,
 * allocating the requested sets across available ratio packs in stock.
 * E.g., if stock has 4 sets of 30 to 38 (5 pcs) and 1 set of 30 to 36 (4 pcs),
 * requesting 5 sets gives: 4*5 + 1*4 = 24 pcs, with breakdown "4×[30 to 38] + 1×[30 to 36]".
 */
export function calculateOrderedColorSetsPieces(
  setsColorwise: string | null | undefined,
  color: string,
  requestedSets: number,
  fallbackPcsPerSet: number = 5,
  preferredRatio?: string
): {
  totalPcs: number;
  breakdownText: string;
  allocations: { ratio: string; sets: number; pcsPerSet: number; pcs: number }[];
} {
  const safeSets = Math.max(0, requestedSets || 0);
  if (safeSets === 0) {
    return { totalPcs: 0, breakdownText: "", allocations: [] };
  }

  const detailed = parseDetailedColorRatioSets(setsColorwise);
  const clean = cleanColorName(color);
  const matchedKey = Object.keys(detailed).find(
    (k) => cleanColorName(k).toLowerCase() === clean.toLowerCase()
  );
  const ratios = matchedKey ? detailed[matchedKey] : {};

  let remaining = safeSets;
  let totalPcs = 0;
  const allocations: { ratio: string; sets: number; pcsPerSet: number; pcs: number }[] = [];

  // Sort ratio keys strictly: "28 to 36" (5 pcs) FIRST, then "28 to 34" (4 pc set) SECOND
  const sortedRatioKeys = sortSizeRatioKeys(Object.keys(ratios));
  if (preferredRatio && ratios[preferredRatio] !== undefined) {
    const prefIdx = sortedRatioKeys.indexOf(preferredRatio);
    if (prefIdx > 0) {
      sortedRatioKeys.splice(prefIdx, 1);
      sortedRatioKeys.unshift(preferredRatio);
    }
  }

  // Allocate across available ratio packs
  for (const ratioKey of sortedRatioKeys) {
    const availableCount = ratios[ratioKey];
    if (remaining <= 0) break;
    const count = Math.max(0, availableCount || 0);
    if (count <= 0) continue;

    const takeSets = Math.min(remaining, count);
    const sizes = getSizesFromRatio(ratioKey);
    const pcsInSet = sizes.length > 0 ? sizes.length : fallbackPcsPerSet;
    const pieces = takeSets * pcsInSet;

    totalPcs += pieces;
    remaining -= takeSets;
    allocations.push({
      ratio: ratioKey,
      sets: takeSets,
      pcsPerSet: pcsInSet,
      pcs: pieces,
    });
  }

  // If requested more sets than configured in ratio packs, or if no ratio packs exist
  if (remaining > 0) {
    const fallbackRatio = preferredRatio || sortedRatioKeys[0] || "Standard";
    const sizes = getSizesFromRatio(fallbackRatio);
    const pcsInSet = sizes.length > 0 ? sizes.length : fallbackPcsPerSet;
    const pieces = remaining * pcsInSet;
    totalPcs += pieces;
    allocations.push({
      ratio: fallbackRatio,
      sets: remaining,
      pcsPerSet: pcsInSet,
      pcs: pieces,
    });
  }

  const breakdownText = allocations
    .map((a) => `${a.sets}×[${a.ratio}]`)
    .join(" + ");

  return {
    totalPcs,
    breakdownText,
    allocations,
  };
}

export interface SellSingleSizeResult {
  success: boolean;
  method: "loose" | "set_converted" | "set_unpacked" | "out_of_stock";
  ratios: Record<string, number>;
  loosePcs: Record<string, number>;
  brokenRatio?: string;
  newRatio?: string;
  addedLooseSizes?: string[];
  message: string;
}

/**
 * Intelligent Single-Size Sale / Stock Deduction:
 * 1. If requested size has loose pieces (> 0), deduct from loose pieces.
 * 2. If NO loose pieces exist, unpack 1 set that contains this size:
 *    - If the removed size is the STARTING size (e.g. 30 from 30 to 38):
 *      remaining sizes (32 to 38) form a valid ratio. Convert 1 set of '30 to 38' into 1 set of '32 to 38'!
 *    - If the removed size is the ENDING size (e.g. 38 from 30 to 38):
 *      remaining sizes (30 to 36) form a valid ratio. Convert 1 set of '30 to 38' into 1 set of '30 to 36'!
 *    - If the removed size is a MIDDLE size (e.g. 34 from 30 to 38):
 *      Unpack the set into loose pieces for all remaining sizes (30, 32, 36, 38).
 */
export function sellSingleSizeFromColorStock(
  ratios: Record<string, number>,
  loosePcs: Record<string, number>,
  soldSize: string
): SellSingleSizeResult {
  const nextRatios = { ...ratios };
  const nextLoose = { ...loosePcs };
  const cleanSize = soldSize.trim();

  // 1. Check if loose piece is available
  if ((nextLoose[cleanSize] || 0) > 0) {
    nextLoose[cleanSize] = nextLoose[cleanSize] - 1;
    if (nextLoose[cleanSize] <= 0) {
      delete nextLoose[cleanSize];
    }
    return {
      success: true,
      method: "loose",
      ratios: nextRatios,
      loosePcs: nextLoose,
      message: `Sold 1 pc of Size ${cleanSize} from loose pieces stock.`,
    };
  }

  // 2. Loose piece not available: find a set ratio with count > 0 containing this size
  let targetRatio: string | null = null;
  let targetSizes: string[] = [];

  for (const [rKey, count] of Object.entries(nextRatios)) {
    if (count > 0) {
      const sizes = getSizesFromRatio(rKey);
      if (sizes.includes(cleanSize)) {
        targetRatio = rKey;
        targetSizes = sizes;
        break;
      }
    }
  }

  if (!targetRatio) {
    return {
      success: false,
      method: "out_of_stock",
      ratios: nextRatios,
      loosePcs: nextLoose,
      message: `Size ${cleanSize} is out of stock (no loose pieces and no sets contain this size).`,
    };
  }

  // Deduct 1 set from targetRatio
  nextRatios[targetRatio] = nextRatios[targetRatio] - 1;
  if (nextRatios[targetRatio] <= 0) {
    delete nextRatios[targetRatio];
  }

  const remainingSizes = targetSizes.filter((s) => s !== cleanSize);

  // Check if starting size was removed (e.g. 30 from [30, 32, 34, 36, 38])
  const isStartSize = cleanSize === targetSizes[0];
  // Check if ending size was removed (e.g. 38 from [30, 32, 34, 36, 38])
  const isEndSize = cleanSize === targetSizes[targetSizes.length - 1];

  if ((isStartSize || isEndSize) && remainingSizes.length >= 3) {
    const minSize = remainingSizes[0];
    const maxSize = remainingSizes[remainingSizes.length - 1];
    const newRatio = `${minSize} to ${maxSize}`;

    // Convert into new ratio set
    nextRatios[newRatio] = (nextRatios[newRatio] || 0) + 1;

    return {
      success: true,
      method: "set_converted",
      ratios: nextRatios,
      loosePcs: nextLoose,
      brokenRatio: targetRatio,
      newRatio,
      message: `Size ${cleanSize} had 0 loose pcs. Converted 1 set of '${targetRatio}' into 1 set of '${newRatio}'!`,
    };
  }

  // Middle size removed, or remaining sizes cannot form a valid set:
  // All remaining sizes become loose pieces
  for (const s of remainingSizes) {
    nextLoose[s] = (nextLoose[s] || 0) + 1;
  }

  return {
    success: true,
    method: "set_unpacked",
    ratios: nextRatios,
    loosePcs: nextLoose,
    brokenRatio: targetRatio,
    addedLooseSizes: remainingSizes,
    message: `Size ${cleanSize} had 0 loose pcs. Unpacked 1 set of '${targetRatio}' into loose pieces (${remainingSizes.join(", ")}) and sold size ${cleanSize}.`,
  };
}

/**
 * Manually unpacks 1 set of a given ratio into loose pieces.
 */
export function unpackSetToLoosePieces(
  ratios: Record<string, number>,
  loosePcs: Record<string, number>,
  ratioToUnpack: string
): { success: boolean; ratios: Record<string, number>; loosePcs: Record<string, number>; addedSizes: string[]; message: string } {
  const nextRatios = { ...ratios };
  const nextLoose = { ...loosePcs };

  if ((nextRatios[ratioToUnpack] || 0) <= 0) {
    return {
      success: false,
      ratios: nextRatios,
      loosePcs: nextLoose,
      addedSizes: [],
      message: `No sets of '${ratioToUnpack}' available to unpack.`,
    };
  }

  nextRatios[ratioToUnpack] -= 1;
  if (nextRatios[ratioToUnpack] <= 0) {
    delete nextRatios[ratioToUnpack];
  }

  const sizes = getSizesFromRatio(ratioToUnpack);
  for (const s of sizes) {
    nextLoose[s] = (nextLoose[s] || 0) + 1;
  }

  return {
    success: true,
    ratios: nextRatios,
    loosePcs: nextLoose,
    addedSizes: sizes,
    message: `Unpacked 1 set of '${ratioToUnpack}' into loose pieces (${sizes.join(", ")}).`,
  };
}

/**
 * Resolves the specific photo for a given color of a product.
 * Checks colorImages mapping, index match with gallery images, or falls back to cover image.
 */
export function getProductColorImage(
  product: { imageUrl?: string | null; colorImages?: string | null; colorsAvailable?: string | null; setsColorwise?: string | null; colorMapping?: string | null } | null | undefined,
  colorName: string
): string {
  if (!product) return "";
  const cleanTarget = cleanColorName(colorName).toLowerCase();

  // 1. Check colorImages JSON map if present
  if (product.colorImages) {
    try {
      const map = typeof product.colorImages === "string" ? JSON.parse(product.colorImages) : product.colorImages;
      if (typeof map === "object" && map !== null) {
        for (const [k, v] of Object.entries(map)) {
          if (cleanColorName(k).toLowerCase() === cleanTarget && typeof v === "string" && v) {
            return v;
          }
        }
      }
    } catch {}
  }

  // Helper to extract all images
  let images: string[] = [];
  if (product.imageUrl) {
    const trimmed = product.imageUrl.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) images = parsed.filter(Boolean);
      } catch {}
    } else if (trimmed.startsWith("data:")) {
      images = [trimmed];
    } else if (trimmed.includes(",")) {
      images = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      images = [trimmed];
    }
  }

  // 2. Map by color index to gallery photos
  const allColors = getAllProductColors(product.colorsAvailable, product.setsColorwise, product.colorMapping);
  const colorIndex = allColors.findIndex((c) => cleanColorName(c).toLowerCase() === cleanTarget);

  if (colorIndex !== -1 && images[colorIndex]) {
    return images[colorIndex];
  }

  // 3. Fallback to first image
  return images[0] || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' font-weight='600' fill='%2364748b'>Garment Photo</text></svg>";
}

/**
 * Extracts and cleans a color string by stripping alphabet prefixes (e.g., "A: Ice Grey" -> "Ice Grey", "A - Black" -> "Black")
 */
export function cleanColorName(color: string): string {
  if (!color) return "";
  let cleaned = color.trim();
  // Strip single-letter prefix like "A: ", "A - ", "A. ", "A) "
  cleaned = cleaned.replace(/^[A-Za-z][:\s\.\-\)]+\s*/, "").trim();
  return cleaned || color.trim();
}

/**
 * Gets all unique, normalized color names for a product from:
 * 1. colorsAvailable (comma-separated string)
 * 2. setsColorwise (JSON string or key-value list)
 * 3. colorMapping (JSON string mapping letters to colors)
 */
export function getAllProductColors(
  colorsAvailable: string | null | undefined,
  setsColorwise: string | null | undefined,
  colorMapping?: string | null | undefined
): string[] {
  const result: string[] = [];
  const seenLower = new Set<string>();

  const addColor = (raw: string) => {
    const cleaned = cleanColorName(raw);
    if (!cleaned || cleaned === "__default__") return;
    const lower = cleaned.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      result.push(cleaned);
    }
  };

  // 1. From colorsAvailable
  if (colorsAvailable) {
    colorsAvailable
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach(addColor);
  }

  // 2. From setsColorwise keys
  if (setsColorwise) {
    const parsed = parseColorwiseSets(setsColorwise);
    Object.keys(parsed).forEach(addColor);
  }

  // 3. From colorMapping values
  if (colorMapping) {
    try {
      const map = JSON.parse(colorMapping);
      if (typeof map === "object" && map !== null) {
        Object.values(map).forEach((val) => {
          if (typeof val === "string") addColor(val);
        });
      }
    } catch {}
  }

  return result;
}

/**
 * Gets the number of available sets for a specific color of a product.
 * Supports:
 * - Exact match
 * - Case-insensitive match
 * - Alphabet prefix match (e.g. key "A: Ice Grey" matching "Ice Grey" or vice-versa)
 * - Color mapping resolution (e.g. key "A" matching "Ice Grey" if A is mapped to Ice Grey)
 * - Normalized alphanumeric match
 * Returns 0 if none available or out of stock.
 */
export function getAvailableSetsForColor(
  setsColorwise: string | null | undefined,
  color: string,
  colorMapping?: string | null | undefined
): number {
  if (!setsColorwise || !color) return 0;
  const parsed = parseColorwiseSets(setsColorwise);
  const targetClean = cleanColorName(color);
  const targetLower = targetClean.toLowerCase();
  const targetAlphaNum = targetClean.replace(/[^a-z0-9]/gi, "").toLowerCase();

  // 1. Exact match on target or cleaned target
  if (parsed[color] !== undefined) return parsed[color];
  if (parsed[targetClean] !== undefined) return parsed[targetClean];

  // Parse color mapping if available
  let alphabetLetterForTarget: string | null = null;
  const letterToColorMap: Record<string, string> = {};
  if (colorMapping) {
    try {
      const map = JSON.parse(colorMapping);
      if (typeof map === "object" && map !== null) {
        for (const [letter, val] of Object.entries(map)) {
          const valStr = String(val).trim();
          letterToColorMap[letter.toUpperCase()] = valStr;
          if (valStr.toLowerCase() === targetLower || cleanColorName(valStr).toLowerCase() === targetLower) {
            alphabetLetterForTarget = letter.toUpperCase();
          }
        }
      }
    } catch {}
  }

  // If color was mapped to a letter (e.g. "A"), check if parsed has key "A"
  if (alphabetLetterForTarget && parsed[alphabetLetterForTarget] !== undefined) {
    return parsed[alphabetLetterForTarget];
  }

  // 2. Iterate through parsed keys with fuzzy/prefix matching
  for (const [rawKey, val] of Object.entries(parsed)) {
    if (rawKey === "__default__") continue;
    const keyClean = cleanColorName(rawKey);
    const keyLower = keyClean.toLowerCase();

    // Direct case-insensitive match
    if (keyLower === targetLower) return val;

    // Check if key is a mapped letter
    const mappedColor = letterToColorMap[rawKey.trim().toUpperCase()];
    if (mappedColor && mappedColor.toLowerCase() === targetLower) {
      return val;
    }

    // Alphanumeric match (ignoring spaces/dashes)
    const keyAlphaNum = keyClean.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (keyAlphaNum && keyAlphaNum === targetAlphaNum) {
      return val;
    }

    // Substring containment (e.g. "Ice Grey" contained in "A: Ice Grey Soft")
    if (keyLower.includes(targetLower) || targetLower.includes(keyLower)) {
      return val;
    }
  }

  // 3. Fallback if single number was provided for whole product
  if (parsed["__default__"] !== undefined) {
    return parsed["__default__"];
  }

  return 0;
}

/**
 * Calculates total available sets across all colors for a product.
 */
export function getTotalAvailableSets(setsColorwise: string | null | undefined): number {
  if (!setsColorwise) return 0;
  const parsed = parseColorwiseSets(setsColorwise);
  const values = Object.values(parsed);
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Checks if a specific color variant of a product is sold out.
 * Returns true if the product tracks setsColorwise and this color has 0 available sets AND 0 loose/mix pieces.
 */
export function isColorSoldOut(
  setsColorwise: string | null | undefined,
  color: string,
  colorMapping?: string | null | undefined
): boolean {
  if (!setsColorwise || !setsColorwise.trim()) return false;
  const sets = getAvailableSetsForColor(setsColorwise, color, colorMapping);
  if (sets > 0) return false;

  // Check loose / mix pieces for this color
  const stockWithLoose = parseDetailedColorStockWithLoose(setsColorwise);
  const cleanTarget = cleanColorName(color).toLowerCase();
  let looseTotal = 0;

  for (const [key, detail] of Object.entries(stockWithLoose)) {
    if (key.toLowerCase() === color.toLowerCase() || cleanColorName(key).toLowerCase() === cleanTarget) {
      looseTotal += Object.values(detail.loosePcs || {}).reduce((s, cnt) => s + Math.max(0, cnt || 0), 0);
    }
  }

  if (colorMapping) {
    try {
      const map = JSON.parse(colorMapping);
      for (const [letter, mappedName] of Object.entries(map)) {
        if (typeof mappedName === "string" && cleanColorName(mappedName).toLowerCase() === cleanTarget) {
          if (stockWithLoose[letter]) {
            looseTotal += Object.values(stockWithLoose[letter].loosePcs || {}).reduce(
              (s, cnt) => s + Math.max(0, cnt || 0),
              0
            );
          }
        }
      }
    } catch {}
  }

  return looseTotal <= 0;
}

/**
 * Converts Record<string, number> into a clean JSON string for storage in database.
 */
export function stringifyColorwiseSets(stockMap: Record<string, number>): string {
  const cleanMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(stockMap)) {
    const trimmed = cleanColorName(k.trim());
    if (trimmed && trimmed !== "__default__") {
      cleanMap[trimmed] = Math.max(0, parseInt(String(v), 10) || 0);
    }
  }
  return JSON.stringify(cleanMap);
}

/**
 * Deducts ordered sets from a product's setsColorwise string.
 * Returns the updated setsColorwise string.
 */
export function deductSetsFromStock(
  setsColorwise: string | null | undefined,
  orderedColorSets: { color: string; sets: number; ratio?: string }[],
  orderedLoosePieces?: { color: string; size: string; count: number }[] | Record<string, Record<string, number>>
): string {
  const stockWithLoose = parseDetailedColorStockWithLoose(setsColorwise);

  for (const orderItem of orderedColorSets) {
    const targetColor = cleanColorName(orderItem.color.trim());
    let remainingToDeduct = Math.max(0, orderItem.sets);

    let matchedColor = Object.keys(stockWithLoose).find(
      (c) => c.toLowerCase() === targetColor.toLowerCase()
    );

    if (matchedColor && stockWithLoose[matchedColor]) {
      const ratios = stockWithLoose[matchedColor].ratios;
      if (orderItem.ratio && ratios[orderItem.ratio] !== undefined) {
        const canDeduct = Math.min(remainingToDeduct, ratios[orderItem.ratio]);
        ratios[orderItem.ratio] -= canDeduct;
        remainingToDeduct -= canDeduct;
      }
      // Prioritize 28 to 36 first, then 28 to 34 (4 pc set)
      const sortedKeys = sortSizeRatioKeys(Object.keys(ratios));
      for (const r of sortedKeys) {
        if (remainingToDeduct <= 0) break;
        const count = ratios[r];
        if (count <= 0) continue;
        const canDeduct = Math.min(remainingToDeduct, count);
        ratios[r] -= canDeduct;
        remainingToDeduct -= canDeduct;
      }
    }
  }

  // Deduct loose single pieces if provided
  if (orderedLoosePieces) {
    if (Array.isArray(orderedLoosePieces)) {
      for (const lp of orderedLoosePieces) {
        const targetColor = cleanColorName(lp.color.trim());
        const matchedColor = Object.keys(stockWithLoose).find(
          (c) => c.toLowerCase() === targetColor.toLowerCase()
        );
        if (matchedColor && stockWithLoose[matchedColor]?.loosePcs) {
          const loose = stockWithLoose[matchedColor].loosePcs;
          if (loose[lp.size] !== undefined) {
            loose[lp.size] = Math.max(0, loose[lp.size] - Math.max(0, lp.count));
          }
        }
      }
    } else if (typeof orderedLoosePieces === "object") {
      for (const [col, sizesMap] of Object.entries(orderedLoosePieces)) {
        const targetColor = cleanColorName(col.trim());
        const matchedColor = Object.keys(stockWithLoose).find(
          (c) => c.toLowerCase() === targetColor.toLowerCase()
        );
        if (matchedColor && stockWithLoose[matchedColor]?.loosePcs && typeof sizesMap === "object") {
          const loose = stockWithLoose[matchedColor].loosePcs;
          for (const [sz, count] of Object.entries(sizesMap)) {
            if (loose[sz] !== undefined) {
              loose[sz] = Math.max(0, loose[sz] - Math.max(0, count));
            }
          }
        }
      }
    }
  }

  return JSON.stringify(stockWithLoose);
}

/**
 * Restores sets back to stock when an order is cancelled or modified.
 * Returns the updated setsColorwise string.
 */
export function restoreSetsToStock(
  setsColorwise: string | null | undefined,
  returnedColorSets: { color: string; sets: number; ratio?: string }[],
  returnedLoosePieces?: { color: string; size: string; count: number }[] | Record<string, Record<string, number>>
): string {
  const stockWithLoose = parseDetailedColorStockWithLoose(setsColorwise);

  for (const orderItem of returnedColorSets) {
    const targetColor = cleanColorName(orderItem.color.trim());
    const setsToRestore = Math.max(0, orderItem.sets);
    if (setsToRestore === 0) continue;

    let matchedColor = Object.keys(stockWithLoose).find(
      (c) => c.toLowerCase() === targetColor.toLowerCase()
    );

    if (!matchedColor) {
      matchedColor = targetColor;
      stockWithLoose[matchedColor] = { ratios: {}, loosePcs: {} };
    }

    const ratioKeys = Object.keys(stockWithLoose[matchedColor].ratios);
    const sortedRatioKeys = sortSizeRatioKeys(ratioKeys);
    const defaultRatioKey = orderItem.ratio || sortedRatioKeys[0] || "28 to 36";
    stockWithLoose[matchedColor].ratios[defaultRatioKey] =
      (stockWithLoose[matchedColor].ratios[defaultRatioKey] || 0) + setsToRestore;
  }

  // Restore loose single pieces if provided
  if (returnedLoosePieces) {
    if (Array.isArray(returnedLoosePieces)) {
      for (const lp of returnedLoosePieces) {
        const targetColor = cleanColorName(lp.color.trim());
        let matchedColor = Object.keys(stockWithLoose).find(
          (c) => c.toLowerCase() === targetColor.toLowerCase()
        );
        if (!matchedColor) {
          matchedColor = targetColor;
          stockWithLoose[matchedColor] = { ratios: {}, loosePcs: {} };
        }
        if (!stockWithLoose[matchedColor].loosePcs) {
          stockWithLoose[matchedColor].loosePcs = {};
        }
        const loose = stockWithLoose[matchedColor].loosePcs;
        loose[lp.size] = (loose[lp.size] || 0) + Math.max(0, lp.count);
      }
    } else if (typeof returnedLoosePieces === "object") {
      for (const [col, sizesMap] of Object.entries(returnedLoosePieces)) {
        const targetColor = cleanColorName(col.trim());
        let matchedColor = Object.keys(stockWithLoose).find(
          (c) => c.toLowerCase() === targetColor.toLowerCase()
        );
        if (!matchedColor) {
          matchedColor = targetColor;
          stockWithLoose[matchedColor] = { ratios: {}, loosePcs: {} };
        }
        if (!stockWithLoose[matchedColor].loosePcs) {
          stockWithLoose[matchedColor].loosePcs = {};
        }
        const loose = stockWithLoose[matchedColor].loosePcs;
        if (typeof sizesMap === "object" && sizesMap !== null) {
          for (const [sz, count] of Object.entries(sizesMap)) {
            loose[sz] = (loose[sz] || 0) + Math.max(0, Number(count) || 0);
          }
        }
      }
    }
  }

  return JSON.stringify(stockWithLoose);
}

/**
 * Returns available mix/loose single sizes for a product from its setsColorwise and mixPcs.
 * e.g. { totalMixPcs: 8, sizesSummary: "30 (2), 32 (1), 34 (5)", sizesList: ["30", "32", "34"] }
 */
export function getProductMixSizesInfo(
  setsColorwise: string | null | undefined,
  mixPcsFallback: number = 0
): {
  totalMixPcs: number;
  sizesSummary: string;
  sizesList: string[];
  bySize: Record<string, number>;
} {
  const stockWithLoose = parseDetailedColorStockWithLoose(setsColorwise);
  const bySize: Record<string, number> = {};
  let totalLoose = 0;

  for (const detail of Object.values(stockWithLoose)) {
    if (detail && detail.loosePcs) {
      for (const [sz, count] of Object.entries(detail.loosePcs)) {
        const num = Math.max(0, count || 0);
        if (num > 0) {
          bySize[sz] = (bySize[sz] || 0) + num;
          totalLoose += num;
        }
      }
    }
  }

  const finalTotal = totalLoose > 0 ? totalLoose : Math.max(0, mixPcsFallback || 0);
  const sortedSizes = Object.keys(bySize).sort((a, b) => {
    const nA = parseInt(a, 10);
    const nB = parseInt(b, 10);
    if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
    return a.localeCompare(b);
  });

  const sizesSummary = sortedSizes.length > 0
    ? sortedSizes.map((sz) => `${sz} (${bySize[sz]} pcs)`).join(", ")
    : finalTotal > 0
    ? `${finalTotal} Pcs`
    : "None";

  return {
    totalMixPcs: finalTotal,
    sizesSummary,
    sizesList: sortedSizes,
    bySize,
  };
}

/**
 * Resolves the shade letter (A, B, C...) for a given color.
 */
export function getColorShadeLetter(
  product: { colorMapping?: string | null; colorsAvailable?: string | null } | null | undefined,
  colorName: string,
  fallbackIndex: number = 0
): string {
  if (!colorName) return String.fromCharCode(65 + fallbackIndex);
  const cleanTarget = cleanColorName(colorName).trim().toLowerCase();

  // If colorName is already a single letter (A, B, C...)
  if (/^[a-z]$/i.test(cleanTarget)) {
    return cleanTarget.toUpperCase();
  }

  // Check if colorName starts with a letter like "A: Black" or "A - Black"
  const prefixMatch = cleanTarget.match(/^([a-z])\s*[:\-\.]\s*/i);
  if (prefixMatch) {
    return prefixMatch[1].toUpperCase();
  }

  if (product?.colorMapping) {
    try {
      const map = JSON.parse(product.colorMapping);
      for (const [letter, name] of Object.entries(map)) {
        if (cleanColorName(String(name)).trim().toLowerCase() === cleanTarget) {
          return letter.toUpperCase();
        }
      }
    } catch {}
  }

  // Check index in product colorsAvailable
  if (product?.colorsAvailable) {
    const list = product.colorsAvailable.split(",").map((c) => cleanColorName(c).trim().toLowerCase());
    const idx = list.indexOf(cleanTarget);
    if (idx >= 0) {
      return String.fromCharCode(65 + idx);
    }
  }

  return String.fromCharCode(65 + fallbackIndex);
}

export interface FormattedMixEntry {
  letter: string;
  colorName: string;
  sizes: { size: string; count: number }[];
}

/**
 * Parses mix single sizes from an order item or product into structured format:
 * [ { letter: "A", colorName: "Dark Blue", sizes: [ { size: "34", count: 2 }, { size: "36", count: 1 } ] } ]
 */
export function parseMixSizesForDisplay(
  item: {
    colorMixPcs?: Record<string, Record<string, number>> | string | null;
    mixSizes?: string | null;
    mixPcs?: number | null;
    notes?: string | null;
    totalPcs?: number | null;
    totalSets?: number | null;
    pcsPerSet?: number | null;
  },
  prodData?: { colorMapping?: string | null; colorsAvailable?: string | null } | null
): FormattedMixEntry[] {
  if (!item) return [];

  // Parse colorMixPcs if stored as JSON string
  let cmp: Record<string, Record<string, number>> | null = null;
  if (typeof item.colorMixPcs === "string") {
    try {
      cmp = JSON.parse(item.colorMixPcs);
    } catch {
      cmp = null;
    }
  } else if (item.colorMixPcs && typeof item.colorMixPcs === "object") {
    cmp = item.colorMixPcs;
  }

  // Extract raw mix from mixSizes or notes [Mix Sizes: ...]
  let rawMix = item.mixSizes || "";
  if (!rawMix && item.notes) {
    const match = String(item.notes).match(/\[Mix Sizes:\s*([^\]]+)\]/i);
    if (match && match[1]) {
      rawMix = match[1].trim();
    }
  }

  const sets = Number(item.totalSets) || 0;
  const perSet = Number(item.pcsPerSet) || 5;
  const looseDiff = Math.max(0, (Number(item.totalPcs) || 0) - sets * perSet);
  const hasMixPcsCount = (item.mixPcs !== undefined && item.mixPcs !== null && Number(item.mixPcs) > 0) || looseDiff > 0;

  // If no mix pieces or sizes are associated with this item, return empty
  if (!cmp && (!rawMix || rawMix === "None" || rawMix === "—") && !hasMixPcsCount) {
    return [];
  }

  const result: FormattedMixEntry[] = [];

  // 1. Try colorMixPcs structured object first
  if (cmp && typeof cmp === "object") {
    let colIdx = 0;
    for (const [colName, sizeMap] of Object.entries(cmp)) {
      if (typeof sizeMap !== "object" || !sizeMap) continue;
      const validSizes = Object.entries(sizeMap)
        .map(([sz, cnt]) => ({ size: String(sz).trim(), count: parseInt(String(cnt), 10) || 0 }))
        .filter((s) => s.count > 0)
        .sort((a, b) => {
          const nA = parseInt(a.size, 10);
          const nB = parseInt(b.size, 10);
          if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
          return a.size.localeCompare(b.size);
        });

      if (validSizes.length > 0) {
        const letter = getColorShadeLetter(prodData, colName, colIdx);
        result.push({
          letter,
          colorName: colName,
          sizes: validSizes,
        });
      }
      colIdx++;
    }
  }

  if (result.length > 0) return result;

  // 2. Fallback: Parse from rawMix string
  // Supports "White: 32(1)", "White: 32 - 1", "White: 32", "White - 1", "32(1)", "32 - 1", "32"
  if (rawMix && rawMix !== "None" && typeof rawMix === "string") {
    const colorChunks = rawMix.split(/;|\n/).map((c) => c.trim()).filter(Boolean);
    let colIdx = 0;

    for (const chunk of colorChunks) {
      if (chunk.includes(":")) {
        const colonIdx = chunk.indexOf(":");
        const colName = chunk.substring(0, colonIdx).trim();
        const sizesPart = chunk.substring(colonIdx + 1).trim();

        const validSizes: { size: string; count: number }[] = [];
        // Match "34(2)" or "34-2" or "34 (2 pcs)" or "34:2"
        const sizeRegex = /(\d+|[a-zA-Z]+)\s*(?:\(|\-|\:)\s*(\d+)/g;
        let match;
        while ((match = sizeRegex.exec(sizesPart)) !== null) {
          validSizes.push({
            size: match[1],
            count: parseInt(match[2], 10) || 1,
          });
        }

        // If no hyphen/paren pair found, parse standalone tokens (e.g. "32", "30, 32", "1")
        if (validSizes.length === 0) {
          sizesPart.split(",").forEach((sp) => {
            const clean = sp.trim().replace(/\s*pcs?$/i, "").replace(/[()]/g, "");
            if (!clean) return;
            const num = parseInt(clean, 10);
            if (!isNaN(num) && num >= 24 && num <= 54) {
              validSizes.push({ size: clean, count: 1 });
            } else if (!isNaN(num)) {
              validSizes.push({ size: "Mix", count: num });
            } else {
              validSizes.push({ size: clean, count: 1 });
            }
          });
        }

        if (validSizes.length > 0) {
          const letter = getColorShadeLetter(prodData, colName, colIdx);
          result.push({
            letter,
            colorName: colName,
            sizes: validSizes,
          });
        }
      } else {
        // Flat chunk without colon e.g. "White - 1", "34-2", "34(2)", "34"
        const validSizes: { size: string; count: number }[] = [];
        const dm = chunk.match(/^([a-zA-Z0-9\s]+)\s*[\-:]\s*(\d+)/);
        if (dm) {
          const namePart = dm[1].trim();
          const countPart = parseInt(dm[2], 10) || 1;
          const isSize = /^(S|M|L|XL|XXL|2XL|3XL|\d+)$/i.test(namePart);
          const num = parseInt(namePart, 10);
          if (isSize && (!isNaN(num) ? num >= 24 : true)) {
            validSizes.push({ size: namePart, count: countPart });
            result.push({ letter: "Mix", colorName: "", sizes: validSizes });
          } else {
            // It is a color shade with count e.g. "White - 1"
            result.push({
              letter: getColorShadeLetter(prodData, namePart, colIdx),
              colorName: namePart,
              sizes: [{ size: "Mix", count: countPart }],
            });
          }
        } else {
          const sizeRegex = /(\d+|[a-zA-Z]+)\s*(?:\(|\-)\s*(\d+)/g;
          let match;
          while ((match = sizeRegex.exec(chunk)) !== null) {
            validSizes.push({
              size: match[1],
              count: parseInt(match[2], 10) || 1,
            });
          }
          if (validSizes.length > 0) {
            result.push({ letter: "Mix", colorName: "", sizes: validSizes });
          } else {
            const num = parseInt(chunk, 10);
            if (!isNaN(num) && num >= 24 && num <= 54) {
              result.push({ letter: "Mix", colorName: "", sizes: [{ size: String(num), count: 1 }] });
            }
          }
        }
      }
      colIdx++;
    }
  }

  // 3. Fallback: If result is still empty but item has loose pieces
  if (result.length === 0 && (hasMixPcsCount || looseDiff > 0)) {
    const diff = looseDiff > 0 ? looseDiff : (Number(item.mixPcs) || 1);
    result.push({
      letter: "Mix",
      colorName: "",
      sizes: [{ size: "Mix", count: diff }],
    });
  }

  return result;
}

/**
 * Extracts a list of particular mix size labels from an item, e.g. ["32"] or ["30", "32"].
 * Returns empty array if only generic loose count is known.
 */
export function getParticularMixSizes(
  item: any,
  prodData?: { colorMapping?: string | null; colorsAvailable?: string | null } | null
): string[] {
  const formatted = parseMixSizesForDisplay(item, prodData);
  const sizes: string[] = [];
  for (const entry of formatted) {
    for (const s of entry.sizes) {
      if (s.size && s.size !== "Mix" && !sizes.includes(s.size)) {
        sizes.push(s.size);
      }
    }
  }
  return sizes;
}

