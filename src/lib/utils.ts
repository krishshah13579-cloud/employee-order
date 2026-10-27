/** Format a number as Indian Rupee currency (always rounded to integer whole rupees) */
export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`;
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

/**
 * Formats a product name to include the MRP in brackets: e.g. "IMP - 003 (1770)".
 * If the product name already contains bracketed MRP/number at the end, it avoids duplicate brackets.
 * If mrp is not provided, calculates from retailerPrice or fallbackPrice (retailerPrice * 2).
 */
export function formatProductNameWithMrp(
  productName: string,
  mrp?: number | null,
  fallbackPrice?: number | null
): string {
  const name = String(productName || "Garment Item").trim();
  if (/\(\s*\d+\s*\)$/.test(name)) return name;

  const resolvedMrp =
    (mrp && Number(mrp) > 0 ? Number(mrp) : null) ||
    (fallbackPrice && Number(fallbackPrice) > 0 ? Math.round(Number(fallbackPrice) * 2) : null);

  if (resolvedMrp && resolvedMrp > 0) {
    return `${name} (${Math.round(resolvedMrp)})`;
  }
  return name;
}

/**
 * Extracts and formats mix single piece sizes into clean lines:
 * e.g. ["34 - 2", "36 - 1"] or ["A: 34 - 2", "A: 36 - 1"]
 * Matches user specification: "LIKE 34 - 2 IN NEXT LINE 36 - 1 AND SO ON."
 */
export function extractMixSizeLines(item: any): string[] {
  if (!item) return [];
  const lines: string[] = [];

  // 1. Try colorMixPcs structured object first
  if (item.colorMixPcs && typeof item.colorMixPcs === "object") {
    const entries = Object.entries(item.colorMixPcs);
    const activeEntries = entries.filter(([_, sMap]: any) => {
      return sMap && typeof sMap === "object" && Object.values(sMap).some((v: any) => Number(v) > 0);
    });
    const hasMultipleColors = activeEntries.length > 1;

    activeEntries.forEach(([colName, sMap]: any, idx) => {
      const letter = getColorAlphabetLetter(
        colName,
        item.colorMapping || item.product?.colorMapping,
        item.colorsAvailable || item.product?.colorsAvailable,
        idx
      );
      const sortedSizes = Object.entries(sMap)
        .map(([sz, cnt]: any) => ({ size: String(sz).trim(), count: parseInt(String(cnt), 10) || 0 }))
        .filter((s) => s.count > 0)
        .sort((a, b) => {
          const nA = parseInt(a.size, 10);
          const nB = parseInt(b.size, 10);
          if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
          return a.size.localeCompare(b.size);
        });

      sortedSizes.forEach(({ size, count }) => {
        if (hasMultipleColors) {
          lines.push(`${letter}: ${size} - ${count}`);
        } else {
          lines.push(`${size} - ${count}`);
        }
      });
    });

    if (lines.length > 0) return lines;
  }

  // 2. Try item.mixSizes or item.notes for [Mix Sizes: ...]
  let rawMix = item.mixSizes || "";
  if (!rawMix && item.notes) {
    const match = String(item.notes).match(/\[Mix Sizes:\s*([^\]]+)\]/i);
    if (match && match[1]) {
      rawMix = match[1].trim();
    }
  }

  if (rawMix && rawMix !== "None" && rawMix !== "—") {
    const chunks = rawMix.split(/;|\n/);
    const activeChunks = chunks.map((c: string) => c.trim()).filter(Boolean);
    const hasMultipleColors = activeChunks.length > 1 && activeChunks.some((c: string) => c.includes(":"));

    activeChunks.forEach((chunk: string, cIdx: number) => {
      if (chunk.includes(":")) {
        const colonIdx = chunk.indexOf(":");
        const colPart = chunk.substring(0, colonIdx).trim();
        const sizesPart = chunk.substring(colonIdx + 1).trim();
        const letter = getColorAlphabetLetter(
          colPart,
          item.colorMapping || item.product?.colorMapping,
          item.colorsAvailable || item.product?.colorsAvailable,
          cIdx
        );

        const sizeRegex = /(\d+|[a-zA-Z]+)\s*(?:\(|\-|\:|\s)\s*(\d+)\s*(?:pcs|\))?/gi;
        let m;
        let found = false;
        while ((m = sizeRegex.exec(sizesPart)) !== null) {
          found = true;
          const sz = m[1];
          const cnt = parseInt(m[2], 10) || 1;
          if (hasMultipleColors) {
            lines.push(`${letter}: ${sz} - ${cnt}`);
          } else {
            lines.push(`${sz} - ${cnt}`);
          }
        }
        if (!found) {
          sizesPart.split(",").forEach((sp) => {
            const clean = sp.trim().replace(/\s*pcs$/i, "").replace(/[()]/g, "");
            if (clean) {
              const dashMatch = clean.match(/^(\d+|[a-zA-Z]+)\s*[\-:]\s*(\d+)/);
              if (dashMatch) {
                lines.push(hasMultipleColors ? `${letter}: ${dashMatch[1]} - ${dashMatch[2]}` : `${dashMatch[1]} - ${dashMatch[2]}`);
              } else {
                lines.push(hasMultipleColors ? `${letter}: ${clean}` : clean);
              }
            }
          });
        }
      } else {
        const sizeRegex = /(\d+|[a-zA-Z]+)\s*(?:\(|\-|\:)\s*(\d+)\s*(?:pcs|\))?/gi;
        let m;
        let found = false;
        while ((m = sizeRegex.exec(chunk)) !== null) {
          found = true;
          const sz = m[1];
          const cnt = parseInt(m[2], 10) || 1;
          lines.push(`${sz} - ${cnt}`);
        }
        if (!found) {
          chunk.split(",").forEach((sp) => {
            const clean = sp.trim().replace(/\s*pcs$/i, "").replace(/[()]/g, "");
            if (clean) {
              const dashMatch = clean.match(/^(\d+|[a-zA-Z]+)\s*[\-:]\s*(\d+)/);
              if (dashMatch) {
                lines.push(`${dashMatch[1]} - ${dashMatch[2]}`);
              } else {
                lines.push(clean);
              }
            }
          });
        }
      }
    });

    if (lines.length > 0) return lines;
  }

  return [];
}

/**
 * Extracts all unique particular garment sizes from an order item or product
 * e.g. ["32"], ["30", "32"], ["34", "36"].
 * Returns empty array if only generic loose count is recorded.
 */
export function extractMixParticularSizes(item: any): string[] {
  if (!item) return [];
  const sizes: string[] = [];

  const addSize = (s: string) => {
    const clean = String(s).trim();
    if (!clean) return;
    if (!sizes.includes(clean)) sizes.push(clean);
  };

  // 1. Structured colorMixPcs (object or JSON string)
  let cmp = item.colorMixPcs;
  if (typeof cmp === "string") {
    try {
      cmp = JSON.parse(cmp);
    } catch {
      cmp = null;
    }
  }

  if (cmp && typeof cmp === "object") {
    for (const [_, sizeMap] of Object.entries(cmp)) {
      if (!sizeMap || typeof sizeMap !== "object") continue;
      for (const [sz, cnt] of Object.entries(sizeMap)) {
        if ((parseInt(String(cnt), 10) || 0) > 0) {
          addSize(sz);
        }
      }
    }
    if (sizes.length > 0) return sizes;
  }

  // 2. Parse from item.mixSizes or item.notes
  let rawMix = item.mixSizes || "";
  if (!rawMix && item.notes) {
    const match = String(item.notes).match(/\[Mix Sizes:\s*([^\]]+)\]/i);
    if (match && match[1]) {
      rawMix = match[1].trim();
    }
  }

  if (rawMix && rawMix !== "None" && rawMix !== "—") {
    const chunks = rawMix.split(/;|\n/).map((c: string) => c.trim()).filter(Boolean);
    chunks.forEach((chunk: string) => {
      let sizesPart = chunk;
      if (chunk.includes(":")) {
        sizesPart = chunk.substring(chunk.indexOf(":") + 1).trim();
      }

      // Check patterns like "32(1)", "32-1", "Size 32", "32 (1 pc)"
      const regex = /(\d+|S|M|L|XL|XXL|2XL|3XL)\s*(?:\(|\-|\:|\s)?\s*(\d+)?/gi;
      let m;
      let foundInPart = false;
      while ((m = regex.exec(sizesPart)) !== null) {
        const candidate = m[1].trim();
        const num = parseInt(candidate, 10);
        if ((!isNaN(num) && num >= 24 && num <= 54) || /^(S|M|L|XL|XXL|2XL|3XL)$/i.test(candidate)) {
          foundInPart = true;
          addSize(candidate.toUpperCase());
        }
      }

      if (!foundInPart) {
        // Try comma-separated tokens
        sizesPart.split(",").forEach((sp) => {
          const clean = sp.trim().replace(/\s*pcs?$/i, "").replace(/[()]/g, "");
          const num = parseInt(clean, 10);
          if ((!isNaN(num) && num >= 24 && num <= 54) || /^(S|M|L|XL|XXL|2XL|3XL)$/i.test(clean)) {
            addSize(clean.toUpperCase());
          }
        });
      }
    });
  }

  return sizes;
}

export interface ExpandedInvoiceRow {
  originalItem: any;
  productName: string;
  mrp?: number | null;
  product?: any;
  hsnCode?: string;
  sizeRatio?: string;
  particularSize?: string;
  showRatioBelowName: boolean;
  colorWiseLines: string[];
  totalSets: number | null;
  totalPcs: number;
  unitPrice: number;
  itemSubtotal: number;
  isMixRow: boolean;
}

/**
 * Expands order items into separate rows for full Sets and loose Mix Pieces for the same product,
 * ensuring clean separation as required by wholesale invoice standards.
 */
export function expandOrderItemsForInvoice(items: any[]): ExpandedInvoiceRow[] {
  const result: ExpandedInvoiceRow[] = [];

  for (const it of items) {
    const colorSetsLines = formatColorAlphabetLines(it.colorSets, it.colorMapping, it.colorsAvailable);
    const rawSets = Number(it.totalSets) || 0;
    const pcsPerSet = Number(it.pcsPerSet) || 5;

    const mixLines = extractMixSizeLines(it);
    let mixPcsCount = Number(it.mixPcs) || 0;

    if (mixLines.length > 0) {
      let parsedMixTotal = 0;
      mixLines.forEach((line) => {
        const m = line.match(/-\s*(\d+)/);
        if (m && m[1]) parsedMixTotal += parseInt(m[1], 10) || 0;
      });
      if (parsedMixTotal > 0) {
        mixPcsCount = parsedMixTotal;
      }
    }

    const totalPcs = Number(it.totalPcs) || 0;
    const unitPrice = Number(it.unitPrice) || 0;

    const hasSets = rawSets > 0 || colorSetsLines.length > 0;
    const hasMix = mixLines.length > 0 || mixPcsCount > 0;

    // Resolve particular mix size(s) instead of hardcoding "Mix Sizes"
    const particularSizes = extractMixParticularSizes(it);
    const particularSizeStr = particularSizes.length > 0 ? particularSizes.join(", ") : "";
    const effectiveMixSizeRatio =
      particularSizeStr ||
      (it.sizeRatio && it.sizeRatio !== "Mix Sizes"
        ? it.sizeRatio
        : (it.product?.sizesRatio || "30 to 38"));

    // Case 1: Both Sets AND Mix pieces for the same product -> 2 separate rows!
    if (hasSets && hasMix) {
      const setsCount = rawSets > 0 ? rawSets : Math.max(1, colorSetsLines.length);
      const setsPcs = setsCount * pcsPerSet;
      const effectiveMixPcs = mixPcsCount > 0 ? mixPcsCount : Math.max(0, totalPcs - setsPcs);

      // Row 1: Sets Row
      result.push({
        originalItem: it,
        productName: it.productName,
        mrp: it.mrp || it.product?.mrp,
        product: it.product,
        hsnCode: it.hsnCode,
        sizeRatio: it.sizeRatio || "30 to 38",
        showRatioBelowName: true,
        colorWiseLines: colorSetsLines.length > 0 ? colorSetsLines : ["A: 1 Set"],
        totalSets: setsCount,
        totalPcs: setsPcs,
        unitPrice,
        itemSubtotal: Math.round(setsPcs * unitPrice),
        isMixRow: false,
      });

      // Row 2: Mix Pcs Row
      result.push({
        originalItem: it,
        productName: it.productName,
        mrp: it.mrp || it.product?.mrp,
        product: it.product,
        hsnCode: it.hsnCode,
        sizeRatio: effectiveMixSizeRatio,
        particularSize: particularSizeStr || effectiveMixSizeRatio,
        showRatioBelowName: false, // Don't mention Ratio below product name for mix sizes!
        colorWiseLines: mixLines.length > 0 ? mixLines : (effectiveMixPcs ? [`${effectiveMixPcs} Pcs`] : ["Mix Pcs"]),
        totalSets: null, // Shows as —
        totalPcs: effectiveMixPcs,
        unitPrice,
        itemSubtotal: Math.round(effectiveMixPcs * unitPrice),
        isMixRow: true,
      });
    }
    // Case 2: Only Mix pieces (like rows 3 to 8 in user's image)
    else if (hasMix || (!hasSets && totalPcs > 0)) {
      const effectiveMixPcs = mixPcsCount > 0 ? mixPcsCount : totalPcs;
      result.push({
        originalItem: it,
        productName: it.productName,
        mrp: it.mrp || it.product?.mrp,
        product: it.product,
        hsnCode: it.hsnCode,
        sizeRatio: effectiveMixSizeRatio,
        particularSize: particularSizeStr || effectiveMixSizeRatio,
        showRatioBelowName: false, // Don't mention Ratio below product name for mix sizes!
        colorWiseLines: mixLines.length > 0 ? mixLines : (effectiveMixPcs ? [`${effectiveMixPcs} Pcs`] : ["Mix Pcs"]),
        totalSets: null, // Shows as —
        totalPcs: effectiveMixPcs,
        unitPrice,
        itemSubtotal: Number(it.itemSubtotal) || Math.round(effectiveMixPcs * unitPrice),
        isMixRow: true,
      });
    }
    // Case 3: Only Sets (like rows 1 and 2 in user's image)
    else {
      const setsCount = rawSets > 0 ? rawSets : Math.max(1, colorSetsLines.length);
      const setsPcs = totalPcs > 0 ? totalPcs : setsCount * pcsPerSet;
      result.push({
        originalItem: it,
        productName: it.productName,
        mrp: it.mrp || it.product?.mrp,
        product: it.product,
        hsnCode: it.hsnCode,
        sizeRatio: it.sizeRatio || "30 to 38",
        showRatioBelowName: true,
        colorWiseLines: colorSetsLines.length > 0 ? colorSetsLines : ["A: 1 Set"],
        totalSets: setsCount,
        totalPcs: setsPcs,
        unitPrice,
        itemSubtotal: Number(it.itemSubtotal) || Math.round(setsPcs * unitPrice),
        isMixRow: false,
      });
    }
  }

  return result;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function getOrderStatusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800";
    case "PROCESSING":
    case "DISPATCHED":
      return "bg-indigo-100 text-indigo-800";
    case "SHIPPED":
    case "IN_TRANSIT":
      return "bg-purple-100 text-purple-800";
    case "OUT_FOR_DELIVERY":
      return "bg-teal-100 text-teal-800";
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

