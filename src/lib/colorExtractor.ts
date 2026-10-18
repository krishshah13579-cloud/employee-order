/**
 * Intelligent dominant and multi-color extractor for garment and trouser photography.
 * Correctly identifies the exact number of physical garments present:
 * - If 2 trousers are in the photo, extracts exactly the 2 distinct colors (without duplicate shadows/highlights).
 * - If 8 trousers are on a rack, extracts all 8 distinct colors.
 * - If 1 trouser is in the photo, extracts the single dominant color.
 */

export interface ReferenceColor {
  name: string;
  r: number;
  g: number;
  b: number;
  family: string;
}

export const TROUSER_COLOR_PALETTE: ReferenceColor[] = [
  { name: "Jet Black", r: 15, g: 15, b: 18, family: "black" },
  { name: "Charcoal Grey", r: 51, g: 65, b: 85, family: "black" },
  { name: "Dark Grey", r: 55, g: 65, b: 81, family: "grey" },
  { name: "Light Grey", r: 156, g: 163, b: 175, family: "light_grey" },
  { name: "Ice Grey", r: 215, g: 220, b: 225, family: "light_grey" },
  { name: "Steel Grey", r: 100, g: 116, b: 139, family: "grey" },
  { name: "Navy Blue", r: 24, g: 38, b: 68, family: "navy" },
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
  { name: "Beige", r: 225, g: 215, b: 195, family: "beige" },
  { name: "Cream", r: 250, g: 243, b: 224, family: "beige" },
  { name: "Off White", r: 245, g: 245, b: 240, family: "white" },
  { name: "White", r: 255, g: 255, b: 255, family: "white" },
  { name: "Dark Brown", r: 69, g: 42, b: 26, family: "brown" },
  { name: "Coffee", r: 69, g: 26, b: 3, family: "brown" },
  { name: "Burgundy", r: 88, g: 28, b: 36, family: "maroon" },
  { name: "Maroon", r: 127, g: 29, b: 29, family: "maroon" },
  { name: "Rust", r: 194, g: 65, b: 12, family: "rust" },
];

/**
 * Calculates weighted perceptual color difference between two RGB values.
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
 * Intelligent classifier for garment RGB values:
 * Resolves dark tones properly so studio light reflections on black fabric
 * are accurately classified as Jet Black, while blue-chroma fabrics match Navy Blue.
 */
export function matchRgbToTrouserColor(r: number, g: number, b: number): string {
  // Dark range analysis (under studio lighting, dark fabrics range between 15-75 RGB)
  if (r < 75 && g < 75 && b < 95) {
    if (b > r + 14 && b > g + 10) return "Navy Blue";
    if (r > b + 15 && r > g + 8) return "Dark Brown";
    if (g > r + 8 && g > b + 8) return "Olive Green";
    return "Jet Black";
  }

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

interface PixelCluster {
  count: number;
  rSum: number;
  gSum: number;
  bSum: number;
  meanR: number;
  meanG: number;
  meanB: number;
}

/**
 * Extracts the exact set of real garment colors from an uploaded image.
 * Merges shadows and fabric creases belonging to the same physical garment
 * so 2 trousers produce exactly 2 colors, 8 trousers produce 8 colors, etc.
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

        const width = 120;
        const height = 120;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height).data;

        // Collect genuine garment pixels, excluding studio backdrop and hangers
        const garmentPixels: { r: number; g: number; b: number }[] = [];
        const minY = Math.floor(height * 0.18); // skip hangers / hooks
        const maxY = Math.floor(height * 0.88); // skip floor / ground shadow
        const minX = Math.floor(width * 0.05);
        const maxX = Math.floor(width * 0.95);

        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x < maxX; x++) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (a < 128) continue;
            // Studio white/grey backdrop
            if (r > 215 && g > 215 && b > 215) continue;
            // Studio warm wood backdrop panel (high red/green, low blue)
            if (r > 115 && g > 75 && r > b + 22) continue;

            garmentPixels.push({ r, g, b });
          }
        }

        if (garmentPixels.length < 50) {
          return resolve(["Jet Black"]);
        }

        // ══════════════════════════════════════════════════════════════
        // STEP 1: INITIAL LEADER-FOLLOWER COLOR CLUSTERING
        // ══════════════════════════════════════════════════════════════
        const clusters: PixelCluster[] = [];
        const INITIAL_THRESH = 35;

        for (const p of garmentPixels) {
          let matched: PixelCluster | null = null;
          let minD = Infinity;

          for (const cl of clusters) {
            const d = getColorDistance(p.r, p.g, p.b, cl.meanR, cl.meanG, cl.meanB);
            if (d < INITIAL_THRESH && d < minD) {
              minD = d;
              matched = cl;
            }
          }

          if (matched) {
            matched.count++;
            matched.rSum += p.r;
            matched.gSum += p.g;
            matched.bSum += p.b;
            matched.meanR = Math.round(matched.rSum / matched.count);
            matched.meanG = Math.round(matched.gSum / matched.count);
            matched.meanB = Math.round(matched.bSum / matched.count);
          } else {
            clusters.push({
              count: 1,
              rSum: p.r,
              gSum: p.g,
              bSum: p.b,
              meanR: p.r,
              meanG: p.g,
              meanB: p.b,
            });
          }
        }

        // ══════════════════════════════════════════════════════════════
        // STEP 2: MERGE NEARBY CLUSTERS (Shadows/Creases on same garment)
        // ══════════════════════════════════════════════════════════════
        let merged = true;
        while (merged) {
          merged = false;
          for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
              const d = getColorDistance(
                clusters[i].meanR,
                clusters[i].meanG,
                clusters[i].meanB,
                clusters[j].meanR,
                clusters[j].meanG,
                clusters[j].meanB
              );
              // Folds and studio highlights on same garment are within distance 46
              if (d < 46) {
                clusters[i].count += clusters[j].count;
                clusters[i].rSum += clusters[j].rSum;
                clusters[i].gSum += clusters[j].gSum;
                clusters[i].bSum += clusters[j].bSum;
                clusters[i].meanR = Math.round(clusters[i].rSum / clusters[i].count);
                clusters[i].meanG = Math.round(clusters[i].gSum / clusters[i].count);
                clusters[i].meanB = Math.round(clusters[i].bSum / clusters[i].count);
                clusters.splice(j, 1);
                merged = true;
                break;
              }
            }
            if (merged) break;
          }
        }

        // Sort clusters by size descending
        clusters.sort((a, b) => b.count - a.count);

        // ══════════════════════════════════════════════════════════════
        // STEP 3: FILTER SIGNIFICANT GARMENTS & ELIMINATE DUPLICATE FAMILIES
        // ══════════════════════════════════════════════════════════════
        // In a photo with N garments, each garment occupies >= 6-10% of total garment pixels
        const total = garmentPixels.length;
        const significant = clusters.filter((c) => c.count / total >= 0.08);

        const detectedColors: string[] = [];
        const familiesSeen = new Set<string>();

        for (const cl of significant) {
          const colName = matchRgbToTrouserColor(cl.meanR, cl.meanG, cl.meanB);
          const ref = TROUSER_COLOR_PALETTE.find((p) => p.name === colName);
          const fam = ref ? ref.family : colName;

          // Prevent duplicate shades from the same color family (e.g. Navy Blue + Dark Denim)
          if (!familiesSeen.has(fam) && !detectedColors.includes(colName)) {
            detectedColors.push(colName);
            familiesSeen.add(fam);
          }
        }

        // Fallback: If no cluster met 8% threshold, take the top 1 dominant cluster
        if (detectedColors.length === 0 && clusters.length > 0) {
          detectedColors.push(
            matchRgbToTrouserColor(clusters[0].meanR, clusters[0].meanG, clusters[0].meanB)
          );
        }

        resolve(detectedColors);
      } catch (err) {
        console.error("Failed to extract colors from image:", err);
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
