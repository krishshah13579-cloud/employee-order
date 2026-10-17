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
  defaultRatio: string = "30 to 38"
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
  defaultRatio: string = "30 to 38"
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
  const clean = ratio.trim().toLowerCase();
  if (clean === "30 to 38" || clean === "30x38") return ["30", "32", "34", "36", "38"];
  if (clean === "32 to 38" || clean === "32x38") return ["32", "34", "36", "38"];
  if (clean === "28 to 36" || clean === "28x36") return ["28", "30", "32", "34", "36"];
  if (clean === "28 to 38" || clean === "28x38") return ["28", "30", "32", "34", "36", "38"];
  if (clean === "30 to 40" || clean === "30x40") return ["30", "32", "34", "36", "38", "40"];
  if (clean === "32 to 40" || clean === "32x40") return ["32", "34", "36", "38", "40"];
  if (clean === "28 to 40" || clean === "28x40") return ["28", "30", "32", "34", "36", "38", "40"];
  if (clean === "32 to 42" || clean === "32x42") return ["32", "34", "36", "38", "40", "42"];
  if (clean === "s to xxl") return ["S", "M", "L", "XL", "XXL"];
  if (clean === "m to 3xl") return ["M", "L", "XL", "XXL", "3XL"];

  // Generic numeric range "X to Y" or "XxY"
  const match = clean.match(/^(\d+)\s*(?:to|x|-)\s*(\d+)$/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      const sizes: string[] = [];
      for (let s = start; s <= end; s += 2) {
        sizes.push(String(s));
      }
      return sizes;
    }
  }
  return [ratio];
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
  fallbackPcsPerSet: number = 5
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

  // Allocate across available ratio packs
  for (const [ratioKey, availableCount] of Object.entries(ratios)) {
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
    const pieces = remaining * fallbackPcsPerSet;
    totalPcs += pieces;
    allocations.push({
      ratio: "Standard",
      sets: remaining,
      pcsPerSet: fallbackPcsPerSet,
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
  orderedColorSets: { color: string; sets: number; ratio?: string }[]
): string {
  const detailed = parseDetailedColorRatioSets(setsColorwise);

  for (const orderItem of orderedColorSets) {
    const targetColor = cleanColorName(orderItem.color.trim());
    let remainingToDeduct = Math.max(0, orderItem.sets);

    let matchedColor = Object.keys(detailed).find(
      (c) => c.toLowerCase() === targetColor.toLowerCase()
    );

    if (matchedColor && detailed[matchedColor]) {
      const ratios = detailed[matchedColor];
      if (orderItem.ratio && ratios[orderItem.ratio] !== undefined) {
        const canDeduct = Math.min(remainingToDeduct, ratios[orderItem.ratio]);
        ratios[orderItem.ratio] -= canDeduct;
        remainingToDeduct -= canDeduct;
      }
      for (const [r, count] of Object.entries(ratios)) {
        if (remainingToDeduct <= 0) break;
        const canDeduct = Math.min(remainingToDeduct, count);
        ratios[r] -= canDeduct;
        remainingToDeduct -= canDeduct;
      }
    }
  }

  return JSON.stringify(detailed);
}

/**
 * Restores sets back to stock when an order is cancelled or modified.
 * Returns the updated setsColorwise string.
 */
export function restoreSetsToStock(
  setsColorwise: string | null | undefined,
  returnedColorSets: { color: string; sets: number; ratio?: string }[]
): string {
  const detailed = parseDetailedColorRatioSets(setsColorwise);

  for (const orderItem of returnedColorSets) {
    const targetColor = cleanColorName(orderItem.color.trim());
    const setsToRestore = Math.max(0, orderItem.sets);
    if (setsToRestore === 0) continue;

    let matchedColor = Object.keys(detailed).find(
      (c) => c.toLowerCase() === targetColor.toLowerCase()
    );

    if (!matchedColor) {
      matchedColor = targetColor;
      detailed[matchedColor] = {};
    }

    const defaultRatioKey = orderItem.ratio || Object.keys(detailed[matchedColor])[0] || "30 to 38";
    detailed[matchedColor][defaultRatioKey] = (detailed[matchedColor][defaultRatioKey] || 0) + setsToRestore;
  }

  return JSON.stringify(detailed);
}
