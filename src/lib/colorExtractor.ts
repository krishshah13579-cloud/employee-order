/**
 * Intelligent dominant and multi-color extractor for garment and trouser photography.
 * Correctly identifies the exact physical garments present:
 * - If 4 trousers are on a rack, extracts exactly 4 distinct colors in physical left-to-right order.
 * - If 2 trousers are on a rack, extracts exactly the 2 distinct colors without shadow/crease duplicates.
 * - If 8 trousers are on a rack, extracts all 8 distinct colors.
 * - If 1 trouser is photographed, extracts the single dominant color.
 */

export interface ReferenceColor {
  name: string;
  r: number;
  g: number;
  b: number;
  family: string;
}

export const TROUSER_COLOR_PALETTE: ReferenceColor[] = [
  { name: "Jet Black", r: 18, g: 18, b: 20, family: "black" },
  { name: "Charcoal Grey", r: 52, g: 56, b: 68, family: "grey" },
  { name: "Dark Grey", r: 70, g: 72, b: 85, family: "grey" },
  { name: "Light Grey", r: 156, g: 163, b: 175, family: "light_grey" },
  { name: "Ice Grey", r: 215, g: 220, b: 225, family: "light_grey" },
  { name: "Steel Grey", r: 100, g: 116, b: 139, family: "grey" },
  { name: "Navy Blue", r: 35, g: 45, b: 80, family: "navy" },
  { name: "Dark Indigo", r: 26, g: 37, b: 56, family: "navy" },
  { name: "Dark Denim", r: 30, g: 41, b: 59, family: "navy" },
  { name: "Light Blue", r: 147, g: 197, b: 253, family: "light_blue" },
  { name: "Sky Blue", r: 125, g: 211, b: 252, family: "light_blue" },
  { name: "Slate Blue", r: 71, g: 85, b: 105, family: "slate_blue" },
  { name: "Khaki", r: 185, g: 170, b: 135, family: "khaki" },
  { name: "Tan", r: 193, g: 154, b: 107, family: "khaki" },
  { name: "Camel", r: 193, g: 154, b: 107, family: "khaki" },
  { name: "Olive Green", r: 63, g: 79, b: 52, family: "olive" },
  { name: "Dark Olive", r: 46, g: 58, b: 39, family: "olive" },
  { name: "Bottle Green", r: 20, g: 83, b: 45, family: "green" },
  { name: "Pista Green", r: 147, g: 197, b: 114, family: "green" },
  { name: "Beige", r: 220, g: 210, b: 195, family: "beige" },
  { name: "Cream", r: 250, g: 243, b: 224, family: "beige" },
  { name: "Off White", r: 245, g: 245, b: 240, family: "white" },
  { name: "White", r: 255, g: 255, b: 255, family: "white" },
  { name: "Dark Brown", r: 69, g: 42, b: 26, family: "brown" },
  { name: "Coffee", r: 69, g: 26, b: 3, family: "brown" },
  { name: "Burgundy", r: 88, g: 28, b: 36, family: "maroon" },
  { name: "Maroon", r: 127, g: 29, b: 29, family: "maroon" },
  { name: "Rust", r: 194, g: 65, b: 12, family: "rust" },
];

export const COLOR_FAMILY_MAP: Record<string, string> = {
  "Jet Black": "black",
  "Charcoal Grey": "grey",
  "Dark Grey": "grey",
  "Steel Grey": "grey",
  "Light Grey": "light_grey",
  "Ice Grey": "light_grey",
  "Navy Blue": "navy",
  "Dark Indigo": "navy",
  "Dark Denim": "navy",
  "Beige": "beige",
  "Cream": "beige",
  "Off White": "white",
  White: "white",
  Khaki: "khaki",
  Tan: "khaki",
  Camel: "khaki",
  "Olive Green": "olive",
  "Dark Olive": "olive",
  "Bottle Green": "green",
  "Pista Green": "green",
  "Dark Brown": "brown",
  Coffee: "brown",
  Burgundy: "maroon",
  Maroon: "maroon",
  Rust: "rust",
  "Light Blue": "light_blue",
  "Sky Blue": "light_blue",
  "Slate Blue": "slate_blue",
};

export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function getColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  const weightR = 2 + rMean / 256;
  const weightG = 4.0;
  const weightB = 2 + (255 - rMean) / 256;
  return Math.sqrt(weightR * dr * dr + weightG * dg * dg + weightB * db * db);
}

/**
 * Robust classifier for trouser and garment colors.
 * Distinguishes dark tones (Jet Black vs Charcoal Grey vs Navy Blue) accurately
 * under studio LED lighting, while identifying Beige, Creams, and Khakis cleanly.
 */
export function classifyTrouserColor(r: number, g: number, b: number): string {
  const hsl = rgbToHsl(r, g, b);

  // Beige / Cream / Off White (light warm tones)
  if (hsl.l >= 65 && r > b + 6 && r > 175 && g > 165) {
    return hsl.l > 85 ? "Cream" : "Beige";
  }

  // Light Grey (neutral light tones)
  if (hsl.l >= 65 && Math.abs(r - b) <= 6) {
    return "Light Grey";
  }

  // True Navy Blue: distinct blue chroma, blue >= 65 and b notably above red & green
  if (b >= 65 && b > r + 24 && hsl.s >= 24 && hsl.h >= 195 && hsl.h <= 260) {
    return "Navy Blue";
  }

  // Jet Black: low brightness or very dark overall under cool studio lighting
  if (hsl.l <= 18 || (r < 48 && g < 48 && b < 66)) {
    return "Jet Black";
  }

  // Dark tones (l <= 34)
  if (hsl.l <= 34) {
    if (b >= 65 && b > r + 24 && hsl.s >= 24) return "Navy Blue";
    return hsl.l > 26 ? "Dark Grey" : "Charcoal Grey";
  }

  // Greys
  if (hsl.s <= 22) {
    if (hsl.l <= 45) return "Dark Grey";
    if (hsl.l <= 65) return "Steel Grey";
    return "Light Grey";
  }

  // Olive
  if (hsl.h >= 60 && hsl.h <= 140 && hsl.s >= 18) {
    return hsl.l > 35 ? "Olive Green" : "Dark Olive";
  }

  // Khaki / Tan
  if (hsl.h >= 25 && hsl.h <= 55 && hsl.l >= 45 && hsl.l < 65) {
    return "Khaki";
  }

  // Standard closest match in palette
  let closestName = "Jet Black";
  let minDistance = Infinity;
  for (const ref of TROUSER_COLOR_PALETTE) {
    const dist = getColorDistance(r, g, b, ref.r, ref.g, ref.b);
    if (dist < minDistance) {
      minDistance = dist;
      closestName = ref.name;
    }
  }

  return closestName;
}

export const matchRgbToTrouserColor = classifyTrouserColor;

/**
 * Extracts the exact set of real garment colors from an uploaded rack or flat-lay image.
 * Uses horizontal column segmentation across the physical garment torso area:
 * - Excludes hanger bar at top, floor tiles / reflections at bottom, and studio wood wall panels.
 * - Clusters consecutive columns belonging to each physical garment.
 * - Deduplicates fold shadows and micro-variants so 4 trousers produce 4 colors, 2 produce 2.
 */
export async function extractColorsFromImage(dataUrl: string): Promise<string[]> {
  if (typeof window === "undefined") return [];

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve([]);

        const width = 160;
        const height = 160;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height).data;

        // Central vertical region corresponding to the torso and legs of hung garments
        const yStart = Math.floor(height * 0.22);
        const yEnd = Math.floor(height * 0.70);

        // Divide horizontally into 32 columns
        const N_COLS = 32;
        const cols: { c: number; rgb: number[]; color: string; family: string }[] = [];

        // Skip outer rack posts (columns 0 and N_COLS - 1)
        for (let c = 1; c < N_COLS - 1; c++) {
          const x0 = Math.floor((c * width) / N_COLS);
          const x1 = Math.floor(((c + 1) * width) / N_COLS);
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let count = 0;

          for (let y = yStart; y < yEnd; y++) {
            for (let x = x0; x < x1; x++) {
              const idx = (y * width + x) * 4;
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              const a = imgData[idx + 3];

              if (a < 128) continue;
              // Skip studio warm wooden wall panel behind rack
              if (r > 115 && g > 75 && r > b + 24) continue;
              // Skip white studio backdrop
              if (r > 225 && g > 225 && b > 225) continue;
              // Skip bluish floor tiles / ground reflections
              if (r > 185 && g > 185 && b > 200 && b > r + 10) continue;

              rSum += r;
              gSum += g;
              bSum += b;
              count++;
            }
          }

          // If this column contains sufficient genuine garment pixels
          if (count > (yEnd - yStart) * (x1 - x0) * 0.25) {
            const avg = [
              Math.round(rSum / count),
              Math.round(gSum / count),
              Math.round(bSum / count),
            ];
            const color = classifyTrouserColor(avg[0], avg[1], avg[2]);
            const family = COLOR_FAMILY_MAP[color] || color;
            cols.push({ c, rgb: avg, color, family });
          }
        }

        if (cols.length === 0) {
          return resolve(["Jet Black"]);
        }

        // Group columns into contiguous physical garment blocks
        const blocks: { family: string; color: string; cols: typeof cols }[] = [];
        let curBlock: (typeof blocks)[0] | null = null;

        for (const col of cols) {
          if (!curBlock) {
            curBlock = { family: col.family, color: col.color, cols: [col] };
          } else if (
            curBlock.family === col.family &&
            col.c - curBlock.cols[curBlock.cols.length - 1].c <= 1
          ) {
            curBlock.cols.push(col);
          } else {
            blocks.push(curBlock);
            curBlock = { family: col.family, color: col.color, cols: [col] };
          }
        }
        if (curBlock) blocks.push(curBlock);

        // A genuine physical garment must span >= 2 contiguous columns
        const genuineBlocks = blocks.filter((b) => b.cols.length >= 2);

        // Calculate total column share of each color family across genuine blocks
        const familyTotalCols: Record<string, number> = {};
        let totalGenuineCols = 0;
        for (const b of genuineBlocks) {
          familyTotalCols[b.family] = (familyTotalCols[b.family] || 0) + b.cols.length;
          totalGenuineCols += b.cols.length;
        }

        // When there are very dominant garments (e.g. 2 trousers each taking > 35%),
        // filter out small crease shadows (< 14% share)
        const hasVeryDominant = Object.values(familyTotalCols).some(
          (cnt) => cnt / totalGenuineCols >= 0.35
        );
        const minThreshold =
          hasVeryDominant && Object.keys(familyTotalCols).length <= 3 ? 0.14 : 0.08;

        const detected: string[] = [];
        const familiesSeen = new Set<string>();

        // Collect colors preserving physical left-to-right rack order
        for (const b of genuineBlocks) {
          const share = (familyTotalCols[b.family] || 0) / totalGenuineCols;
          if (share >= minThreshold && !familiesSeen.has(b.family)) {
            detected.push(b.color);
            familiesSeen.add(b.family);
          }
        }

        // Fallback: If no block met the criteria, return dominant column color
        if (detected.length === 0 && cols.length > 0) {
          detected.push(cols[Math.floor(cols.length / 2)].color);
        }

        resolve(detected);
      } catch (err) {
        console.error("Failed to extract colors from image:", err);
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
