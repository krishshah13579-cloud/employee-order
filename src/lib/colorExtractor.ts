/**
 * Helper to extract dominant colors from an uploaded garment image.
 * Uses canvas pixel sampling with advanced background suppression to avoid
 * detecting photo backdrops, studio walls, and floor shadows as garment colors.
 */

interface ReferenceColor {
  name: string;
  r: number;
  g: number;
  b: number;
}

const TROUSER_COLOR_PALETTE: ReferenceColor[] = [
  { name: "Jet Black", r: 18, g: 18, b: 20 },
  { name: "Navy Blue", r: 22, g: 35, b: 65 },
  { name: "Dark Indigo", r: 30, g: 30, b: 75 },
  { name: "Charcoal Grey", r: 55, g: 65, b: 75 },
  { name: "Dark Grey", r: 60, g: 65, b: 75 },
  { name: "Steel Grey", r: 113, g: 121, b: 126 },
  { name: "Ice Grey", r: 215, g: 220, b: 225 },
  { name: "Light Grey", r: 160, g: 170, b: 180 },
  { name: "Olive Green", r: 65, g: 80, b: 55 },
  { name: "Bottle Green", r: 18, g: 53, b: 36 },
  { name: "Khaki", r: 195, g: 180, b: 140 },
  { name: "Beige", r: 230, g: 220, b: 200 },
  { name: "Dark Brown", r: 70, g: 45, b: 30 },
  { name: "Tan", r: 195, g: 155, b: 110 },
  { name: "Camel", r: 193, g: 154, b: 107 },
  { name: "Burgundy", r: 90, g: 30, b: 40 },
  { name: "Maroon", r: 128, g: 0, b: 0 },
  { name: "Slate Blue", r: 70, g: 85, b: 105 },
  { name: "Light Blue", r: 150, g: 200, b: 250 },
  { name: "Off White", r: 245, g: 245, b: 240 },
  { name: "Cream", r: 255, g: 253, b: 208 },
  { name: "White", r: 255, g: 255, b: 255 },
];

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
  );
}

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

        // Sample at 80x80 for fast processing
        const width = 80;
        const height = 80;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height).data;

        // 1. Detect background colors by sampling the perimeter/border pixels (outer 10% frame)
        const borderPixels: { r: number; g: number; b: number }[] = [];
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const isBorder = x < 6 || x >= width - 6 || y < 6 || y >= height - 6;
            if (isBorder) {
              const idx = (y * width + x) * 4;
              const a = imgData[idx + 3];
              if (a >= 128) {
                borderPixels.push({
                  r: imgData[idx],
                  g: imgData[idx + 1],
                  b: imgData[idx + 2],
                });
              }
            }
          }
        }

        // Compute average background color from border samples
        let bgR = 255, bgG = 255, bgB = 255;
        if (borderPixels.length > 0) {
          const sum = borderPixels.reduce(
            (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
            { r: 0, g: 0, b: 0 }
          );
          bgR = sum.r / borderPixels.length;
          bgG = sum.g / borderPixels.length;
          bgB = sum.b / borderPixels.length;
        }

        const colorBuckets: Record<string, { r: number; g: number; b: number; count: number }> = {};
        let foregroundPixelCount = 0;

        // 2. Sample interior garment pixels (step of 4 in coordinates)
        for (let y = 4; y < height - 4; y += 2) {
          for (let x = 4; x < width - 4; x += 2) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (a < 128) continue;

            // Reject if pixel is close to detected border background
            const distToBg = colorDistance(r, g, b, bgR, bgG, bgB);
            if (distToBg < 42) continue;

            // Reject standard studio near-white/light gray neutral backdrops
            const isNeutralBackdrop =
              r > 200 &&
              g > 200 &&
              b > 200 &&
              Math.abs(r - g) < 18 &&
              Math.abs(r - b) < 18 &&
              Math.abs(g - b) < 18;
            if (isNeutralBackdrop) continue;

            foregroundPixelCount++;

            // Quantize into 24-step color bins
            const qr = Math.round(r / 24) * 24;
            const qg = Math.round(g / 24) * 24;
            const qb = Math.round(b / 24) * 24;
            const key = `${qr},${qg},${qb}`;

            if (!colorBuckets[key]) {
              colorBuckets[key] = { r, g, b, count: 1 };
            } else {
              colorBuckets[key].count++;
              colorBuckets[key].r = (colorBuckets[key].r + r) / 2;
              colorBuckets[key].g = (colorBuckets[key].g + g) / 2;
              colorBuckets[key].b = (colorBuckets[key].b + b) / 2;
            }
          }
        }

        if (foregroundPixelCount === 0) return resolve([]);

        // Filter clusters that have at least 10% of total foreground pixels
        const minClusterPixels = Math.max(8, foregroundPixelCount * 0.10);

        const sorted = Object.values(colorBuckets)
          .filter((c) => c.count >= minClusterPixels)
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);

        const matchedNames: string[] = [];

        for (const cluster of sorted) {
          let closestName = "";
          let minDistance = Infinity;

          for (const ref of TROUSER_COLOR_PALETTE) {
            const dist = colorDistance(cluster.r, cluster.g, cluster.b, ref.r, ref.g, ref.b);
            if (dist < minDistance) {
              minDistance = dist;
              closestName = ref.name;
            }
          }

          if (closestName && !matchedNames.includes(closestName)) {
            // Exclude backdrop neutrals unless clearly dominant dark/colored
            if (closestName === "White" || closestName === "Off White") continue;
            matchedNames.push(closestName);
          }
        }

        resolve(matchedNames.slice(0, 3));
      } catch (err) {
        console.error("Failed to extract colors from image:", err);
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
