/** Format a number as Indian Rupee currency */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Format a date string to a readable format */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format a date string to include time */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Combine class names, filtering out falsy values */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Convert a number into Indian currency words (e.g. 9450 -> "Nine Thousand Four Hundred Fifty Only") */
export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Zero Only";

  const num = Math.round(Math.abs(amount));
  const units = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return units[n];
    const t = Math.floor(n / 10);
    const u = n % 10;
    return `${tens[t]}${u > 0 ? " " + units[u] : ""}`;
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const parts: string[] = [];
    if (h > 0) parts.push(`${units[h]} Hundred`);
    if (rem > 0) parts.push(convertTwoDigits(rem));
    return parts.join(" ");
  }

  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const hundreds = num % 1000;

  const result: string[] = [];
  if (crores > 0) result.push(`${convertTwoDigits(crores)} Crore`);
  if (lakhs > 0) result.push(`${convertTwoDigits(lakhs)} Lakh`);
  if (thousands > 0) result.push(`${convertTwoDigits(thousands)} Thousand`);
  if (hundreds > 0) result.push(convertThreeDigits(hundreds));

  return `${result.join(" ")} Only`;
}

/**
 * Returns an array of all image URLs for a product.
 * Robustly handles:
 * - JSON Array of URLs or data URLs: '["data:image/...", "https://..."]'
 * - Single base64 data URL: 'data:image/jpeg;base64,...'
 * - Comma-separated HTTP/HTTPS URLs: 'https://..., https://...'
 */
export function getProductAllImages(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return [];
  const trimmed = imageUrl.trim();
  if (!trimmed) return [];

  // 1. JSON Array format
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean);
      }
    } catch {}
  }

  // 2. Base64 Data URL (starts with data:image/) - do NOT split by comma!
  if (trimmed.startsWith("data:")) {
    return [trimmed];
  }

  // 3. Comma-separated web URLs (e.g. https://... , https://...)
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/"));
  }

  return [trimmed];
}

/**
 * Resolves the primary/cover image URL from a product's imageUrl string.
 * Supports single URL, base64 data URL, JSON array, or comma-separated list of web URLs.
 */
export function getProductCoverImage(
  imageUrl: string | null | undefined,
  fallback: string = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><path d='M160 120 L240 120 L225 280 L205 280 L200 190 L195 280 L175 280 Z' fill='%23cbd5e1' stroke='%2394a3b8' stroke-width='2'/><text x='50%25' y='78%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' font-weight='600' fill='%2364748b'>Garment Photo</text></svg>"
): string {
  const images = getProductAllImages(imageUrl);
  return images.length > 0 ? images[0] : fallback;
}

/**
 * Checks whether a given GST/PAN string represents a registered tax ID.
 * Returns false for empty, null, "N/A", "URP", "UNREGISTERED", or dash values.
 */
export function isGstPanRegistered(gstPan?: string | null): boolean {
  if (!gstPan) return false;
  const val = gstPan.trim().toUpperCase();
  if (!val) return false;
  if (
    val === "N/A" ||
    val === "NA" ||
    val === "N / A" ||
    val === "URP" ||
    val.startsWith("URP") ||
    val === "UNREGISTERED" ||
    val === "NOT REGISTERED" ||
    val === "NOT APPLICABLE" ||
    val === "NONE" ||
    val === "NIL" ||
    val === "NULL" ||
    val === "UNDEFINED" ||
    val === "—" ||
    val === "-"
  ) {
    return false;
  }
  return true;
}

/**
 * Natural numerical sorter for Garment Products.
 * Sorts products sequentially starting from "IMP - 001", "IMP - 002", "IMP - 003", ... up to any number.
 * Extracts integer digits from product names (e.g. "IMP - 001" -> 1, "IMP-010" -> 10, "IMP 105" -> 105).
 */
export function extractProductNumber(name?: string | null): number {
  if (!name) return Number.MAX_SAFE_INTEGER;
  // Match any sequence of digits in name (e.g. IMP - 001, IMP-05, etc.)
  const match = name.match(/\d+/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    if (!isNaN(parsed)) return parsed;
  }
  return Number.MAX_SAFE_INTEGER;
}

export function sortProductsByImpSequence<T extends { name?: string | null }>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const numA = extractProductNumber(a.name);
    const numB = extractProductNumber(b.name);

    if (numA !== numB) {
      return numA - numB;
    }

    // Secondary fallback: natural string comparison
    const nameA = a.name || "";
    const nameB = b.name || "";
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Resolves the wholesale alphabet code (A, B, C, D...) for a color name.
 * 1. If color is already a single letter (e.g. "A", "B"), returns it.
 * 2. If color starts with a letter like "A: Ice Grey" or "A - Ice Grey", extracts "A".
 * 3. If colorMapping JSON is provided (e.g. {"A": "Ice Grey", "B": "Jet Black"}), looks up the letter.
 * 4. If colorsAvailable comma-separated string is provided, looks up index in the list.
 * 5. Otherwise falls back to String.fromCharCode(65 + fallbackIndex) ('A', 'B', 'C'...).
 */
export function getColorAlphabetLetter(
  colorName: string,
  colorMapping?: string | null | Record<string, string>,
  colorsAvailable?: string | null,
  fallbackIndex: number = 0
): string {
  if (!colorName) return String.fromCharCode(65 + (fallbackIndex % 26));

  const trimmed = colorName.trim();

  // 1. If already a single uppercase/lowercase letter
  if (/^[A-Za-z]$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // 2. If prefixed with alphabet like "A: Blue", "A - Blue", "(A) Blue", "A. Blue"
  const prefixMatch = trimmed.match(/^(\(?([A-Za-z])\)?)[\s:\-–—\.]+/);
  if (prefixMatch && prefixMatch[2]) {
    return prefixMatch[2].toUpperCase();
  }

  const cleanColor = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const lowerColor = trimmed.toLowerCase();
  const cleanTarget = cleanColor(trimmed);

  // 3. Check colorMapping
  if (colorMapping) {
    try {
      const map: Record<string, string> =
        typeof colorMapping === "string" ? JSON.parse(colorMapping) : colorMapping;
      if (map && typeof map === "object") {
        for (const [letter, mappedColor] of Object.entries(map)) {
          if (typeof mappedColor === "string") {
            const mappedTrimmed = mappedColor.trim().toLowerCase();
            if (mappedTrimmed === lowerColor || cleanColor(mappedTrimmed) === cleanTarget) {
              return letter.toUpperCase();
            }
          }
        }
      }
    } catch {}
  }

  // 4. Check colorsAvailable comma-separated string
  if (colorsAvailable) {
    const list = colorsAvailable.split(",").map((c) => c.trim().toLowerCase());
    const matchIdx = list.findIndex((c) => c === lowerColor || cleanColor(c) === cleanTarget);
    if (matchIdx >= 0) {
      return String.fromCharCode(65 + (matchIdx % 26));
    }
  }

  // 5. Fallback index
  return String.fromCharCode(65 + (fallbackIndex % 26));
}

/**
 * Returns formatted lines showing wholesale alphabet and sets count for each color:
 * e.g. ["A: 2 Sets", "B: 3 Sets"]
 * Each color entry is on its own line.
 */
export function formatColorAlphabetLines(
  colorSets: any,
  colorMapping?: string | null | Record<string, string>,
  colorsAvailable?: string | null
): string[] {
  let parsed: { color: string; sets: number }[] = [];
  try {
    if (Array.isArray(colorSets)) {
      parsed = colorSets;
    } else if (typeof colorSets === "string") {
      parsed = JSON.parse(colorSets || "[]");
    }
  } catch {
    parsed = [];
  }

  const active = parsed.filter((c) => Number(c.sets) > 0);
  if (active.length === 0) return [];

  return active.map((c, idx) => {
    const letter = getColorAlphabetLetter(c.color, colorMapping, colorsAvailable, idx);
    const sets = Number(c.sets) || 0;
    return `${letter}: ${sets} ${sets === 1 ? "Set" : "Sets"}`;
  });
}
