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
          const num = parseInt(String(v), 10);
          if (!isNaN(num)) {
            result[k.trim()] = Math.max(0, num);
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
  orderedColorSets: { color: string; sets: number }[]
): string {
  const stockMap = parseColorwiseSets(setsColorwise);

  for (const orderItem of orderedColorSets) {
    const targetColor = cleanColorName(orderItem.color.trim());
    const setsToDeduct = Math.max(0, orderItem.sets);

    // Find matching key (exact, cleaned, or case-insensitive)
    let matchedKey: string | null = null;
    if (stockMap[targetColor] !== undefined) {
      matchedKey = targetColor;
    } else {
      const lower = targetColor.toLowerCase();
      for (const k of Object.keys(stockMap)) {
        if (cleanColorName(k).toLowerCase() === lower || k.toLowerCase() === lower) {
          matchedKey = k;
          break;
        }
      }
    }

    if (matchedKey && stockMap[matchedKey] !== undefined) {
      stockMap[matchedKey] = Math.max(0, stockMap[matchedKey] - setsToDeduct);
    } else if (stockMap["__default__"] !== undefined) {
      stockMap["__default__"] = Math.max(0, stockMap["__default__"] - setsToDeduct);
    }
  }

  return stringifyColorwiseSets(stockMap);
}

/**
 * Restores sets back to stock when an order is cancelled or modified.
 * Returns the updated setsColorwise string.
 */
export function restoreSetsToStock(
  setsColorwise: string | null | undefined,
  returnedColorSets: { color: string; sets: number }[]
): string {
  const stockMap = parseColorwiseSets(setsColorwise);

  for (const orderItem of returnedColorSets) {
    const targetColor = cleanColorName(orderItem.color.trim());
    const setsToRestore = Math.max(0, orderItem.sets);
    if (setsToRestore === 0) continue;

    let matchedKey: string | null = null;
    if (stockMap[targetColor] !== undefined) {
      matchedKey = targetColor;
    } else {
      const lower = targetColor.toLowerCase();
      for (const k of Object.keys(stockMap)) {
        if (cleanColorName(k).toLowerCase() === lower || k.toLowerCase() === lower) {
          matchedKey = k;
          break;
        }
      }
    }

    if (matchedKey && stockMap[matchedKey] !== undefined) {
      stockMap[matchedKey] += setsToRestore;
    } else {
      stockMap[targetColor] = setsToRestore;
    }
  }

  return stringifyColorwiseSets(stockMap);
}
