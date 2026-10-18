/**
 * Intelligent dominant and multi-color extractor for garment and trouser photography.
 * Handles both:
 * 1. Multi-garment photos (e.g. rack of 8 trousers hanging side-by-side or stacked).
 * 2. Single-garment photos (extracting primary garment color).
 */

export interface ReferenceColor {
  name: string;
  r: number;
  g: number;
  b: number;
}

export const TROUSER_COLOR_PALETTE: ReferenceColor[] = [
  { name: "Jet Black", r: 15, g: 15, b: 18 },
  { name: "Navy Blue", r: 24, g: 38, b: 68 },
  { name: "Dark Indigo", r: 26, g: 37, b: 56 },
  { name: "Slate Blue", r: 71, g: 85, b: 105 },
  { name: "Charcoal Grey", r: 51, g: 65, b: 85 },
  { name: "Dark Grey", r: 55, g: 65, b: 81 },
  { name: "Light Grey", r: 156, g: 163, b: 175 },
  { name: "Ice Grey", r: 215, g: 220, b: 225 },
  { name: "Steel Grey", r: 100, g: 116, b: 139 },
  { name: "Khaki", r: 185, g: 170, b: 135 },
  { name: "Olive Green", r: 63, g: 79, b: 52 },
  { name: "Dark Olive", r: 46, g: 58, b: 39 },
  { name: "Beige", r: 225, g: 215, b: 195 },
  { name: "Cream", r: 250, g: 243, b: 224 },
  { name: "Off White", r: 245, g: 245, b: 240 },
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Dark Brown", r: 69, g: 42, b: 26 },
  { name: "Tan", r: 193, g: 154, b: 107 },
  { name: "Camel", r: 193, g: 154, b: 107 },
  { name: "Coffee", r: 69, g: 26, b: 3 },
  { name: "Burgundy", r: 88, g: 28, b: 36 },
  { name: "Maroon", r: 127, g: 29, b: 29 },
  { name: "Light Blue", r: 147, g: 197, b: 253 },
  { name: "Sky Blue", r: 125, g: 211, b: 252 },
  { name: "Dark Denim", r: 30, g: 41, b: 59 },
  { name: "Bottle Green", r: 20, g: 83, b: 45 },
  { name: "Pista Green", r: 147, g: 197, b: 114 },
  { name: "Rust", r: 194, g: 65, b: 12 },
];

/**
 * Calculates weighted perceptual color difference between two RGB values.
 * Gives higher weight to green and red channels matching human visual sensitivity.
 */
function getColorDistance(
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
 * Finds the closest matched name in TROUSER_COLOR_PALETTE for a given RGB.
 */
export function matchRgbToTrouserColor(r: number, g: number, b: number): string {
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

/**
 * Extracts all distinct garment colors from an image.
 * If 8 trousers are hung side-by-side or stacked, this scans across the garment
 * columns as well as global clusters to discover all distinct colors.
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

        // Scaled to 160x160 for high accuracy and instant sub-20ms execution
        const width = 160;
        const height = 160;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height).data;

        const isGarmentPixel = (r: number, g: number, b: number, a: number): boolean => {
          if (a < 128) return false;
          // Skip pure / near-white studio backdrop
          if (r > 242 && g > 242 && b > 242) return false;
          // Skip pure desaturated white ceiling / floor highlights
          if (r > 235 && g > 235 && b > 235 && Math.abs(r - g) < 8 && Math.abs(g - b) < 8) return false;
          return true;
        };

        // ══════════════════════════════════════════════════════════════
        // METHOD 1: VERTICAL COLUMN STRIP SCANNING
        // (Detects trousers hanging side-by-side from left to right)
        // ══════════════════════════════════════════════════════════════
        const detectedFromSlices: string[] = [];
        const numSlices = 8; // Scan 8 vertical columns for up to 8 hanging garments
        const sliceWidth = Math.floor((width * 0.90) / numSlices);
        const startX = Math.floor(width * 0.05);
        // Exclude top 18% (hangers/hooks) and bottom 10% (shadows/floor)
        const minY = Math.floor(height * 0.20);
        const maxY = Math.floor(height * 0.85);

        for (let s = 0; s < numSlices; s++) {
          const colX1 = startX + s * sliceWidth;
          const colX2 = colX1 + sliceWidth;
          const sliceBuckets: Record<string, { r: number; g: number; b: number; count: number }> = {};

          for (let y = minY; y < maxY; y += 2) {
            for (let x = colX1; x < colX2; x += 2) {
              const idx = (y * width + x) * 4;
              const r = imgData[idx];
              const g = imgData[idx + 1];
              const b = imgData[idx + 2];
              const a = imgData[idx + 3];

              if (!isGarmentPixel(r, g, b, a)) continue;

              const qr = Math.round(r / 24) * 24;
              const qg = Math.round(g / 24) * 24;
              const qb = Math.round(b / 24) * 24;
              const key = `${qr},${qg},${qb}`;

              if (!sliceBuckets[key]) {
                sliceBuckets[key] = { r, g, b, count: 1 };
              } else {
                sliceBuckets[key].count++;
                sliceBuckets[key].r = (sliceBuckets[key].r + r) / 2;
                sliceBuckets[key].g = (sliceBuckets[key].g + g) / 2;
                sliceBuckets[key].b = (sliceBuckets[key].b + b) / 2;
              }
            }
          }

          const topCluster = Object.values(sliceBuckets).sort((a, b) => b.count - a.count)[0];
          if (topCluster && topCluster.count >= 4) {
            const matchedName = matchRgbToTrouserColor(topCluster.r, topCluster.g, topCluster.b);
            detectedFromSlices.push(matchedName);
          }
        }

        // ══════════════════════════════════════════════════════════════
        // METHOD 2: GLOBAL COLOR CLUSTER TALLY
        // (Ensures any significant color present anywhere in the image is captured)
        // ══════════════════════════════════════════════════════════════
        const globalColorCounts: Record<string, number> = {};
        let totalGarmentPixels = 0;

        for (let y = minY; y < maxY; y += 2) {
          for (let x = Math.floor(width * 0.04); x < Math.floor(width * 0.96); x += 2) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (!isGarmentPixel(r, g, b, a)) continue;

            totalGarmentPixels++;
            const matched = matchRgbToTrouserColor(r, g, b);
            globalColorCounts[matched] = (globalColorCounts[matched] || 0) + 1;
          }
        }

        const sortedGlobalColors = Object.entries(globalColorCounts)
          .filter(([_, count]) => totalGarmentPixels > 0 && count / totalGarmentPixels >= 0.035) // at least 3.5% presence
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);

        // ══════════════════════════════════════════════════════════════
        // MERGE & DEDUPLICATE COLORS
        // ══════════════════════════════════════════════════════════════
        const finalColors: string[] = [];

        // 1. First add distinct slice colors in left-to-right order
        for (const col of detectedFromSlices) {
          if (!finalColors.includes(col)) {
            finalColors.push(col);
          }
        }

        // 2. Add any additional prominent global colors
        for (const col of sortedGlobalColors) {
          if (!finalColors.includes(col)) {
            finalColors.push(col);
          }
        }

        // If fewer than 2 colors detected from slices/clusters, fallback to top global
        if (finalColors.length === 0 && sortedGlobalColors.length > 0) {
          finalColors.push(...sortedGlobalColors.slice(0, 8));
        }

        // Return up to 8 distinct colors
        const result = finalColors.slice(0, 8);
        resolve(result);
      } catch (err) {
        console.error("Failed to extract colors from image:", err);
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
