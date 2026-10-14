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
 * Gets the number of available sets for a specific color of a product.
 * Returns 0 if none available or out of stock.
 */
export function getAvailableSetsForColor(
  setsColorwise: string | null | undefined,
  color: string
): number {
  if (!setsColorwise) return 0;
  const parsed = parseColorwiseSets(setsColorwise);

  // Exact match
  if (parsed[color] !== undefined) {
    return parsed[color];
  }

  // Case-insensitive match
  const lower = color.trim().toLowerCase();
  for (const [k, v] of Object.entries(parsed)) {
    if (k.toLowerCase() === lower) {
      return v;
    }
  }

  // Fallback if single number was provided for whole product
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
 * Converts Record<string, number> into a clean JSON string for storage in SQLite.
 */
export function stringifyColorwiseSets(stockMap: Record<string, number>): string {
  const cleanMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(stockMap)) {
    const trimmed = k.trim();
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
    const targetColor = orderItem.color.trim();
    const setsToDeduct = Math.max(0, orderItem.sets);

    // Find matching key (exact or case-insensitive)
    let matchedKey: string | null = null;
    if (stockMap[targetColor] !== undefined) {
      matchedKey = targetColor;
    } else {
      const lower = targetColor.toLowerCase();
      for (const k of Object.keys(stockMap)) {
        if (k.toLowerCase() === lower) {
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
