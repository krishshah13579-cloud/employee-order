/**
 * Helper to extract dominant colors from an uploaded image file / data URL
 * Uses canvas pixel sampling and matches with garment & trouser color presets.
 */

interface ReferenceColor {
  name: string;
  r: number;
  g: number;
  b: number;
}

const TROUSER_COLOR_PALETTE: ReferenceColor[] = [
  { name: "Ice Grey", r: 215, g: 220, b: 225 },
  { name: "Jet Black", r: 18, g: 18, b: 20 },
  { name: "Navy Blue", r: 22, g: 35, b: 65 },
  { name: "Charcoal Grey", r: 55, g: 65, b: 75 },
  { name: "Light Grey", r: 160, g: 170, b: 180 },
  { name: "Khaki", r: 195, g: 180, b: 140 },
  { name: "Olive Green", r: 65, g: 80, b: 55 },
  { name: "Beige", r: 230, g: 220, b: 200 },
  { name: "Dark Brown", r: 70, g: 45, b: 30 },
  { name: "Tan", r: 195, g: 155, b: 110 },
  { name: "Off White", r: 245, g: 245, b: 240 },
  { name: "Slate Blue", r: 70, g: 85, b: 105 },
  { name: "Burgundy", r: 90, g: 30, b: 40 },
  { name: "Dark Indigo", r: 30, g: 30, b: 75 },
  { name: "Light Blue", r: 150, g: 200, b: 250 },
  { name: "Dark Grey", r: 60, g: 65, b: 75 },
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Maroon", r: 128, g: 0, b: 0 },
  { name: "Cream", r: 255, g: 253, b: 208 },
  { name: "Bottle Green", r: 18, g: 53, b: 36 },
  { name: "Camel", r: 193, g: 154, b: 107 },
  { name: "Steel Grey", r: 113, g: 121, b: 126 },
];

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

        // Downscale to 80x80 for fast pixel sampling
        const width = 80;
        const height = 80;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height).data;
        const colorBuckets: Record<string, { r: number; g: number; b: number; count: number }> = {};

        // Sample every 4th pixel (step of 16 in RGBA array)
        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip transparent or near-white background pixels (e.g. standard studio white backgrounds)
          if (a < 128) continue;
          if (r > 248 && g > 248 && b > 248) continue;

          // Quantize color to 32-value intervals
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
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

        // Sort by pixel frequency
        const sorted = Object.values(colorBuckets)
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        const matchedNames = new Set<string>();

        for (const cluster of sorted) {
          let closestName = "";
          let minDistance = Infinity;

          for (const ref of TROUSER_COLOR_PALETTE) {
            // Euclidean distance in RGB color space
            const dist = Math.sqrt(
              Math.pow(cluster.r - ref.r, 2) +
                Math.pow(cluster.g - ref.g, 2) +
                Math.pow(cluster.b - ref.b, 2)
            );
            if (dist < minDistance) {
              minDistance = dist;
              closestName = ref.name;
            }
          }

          if (closestName && !matchedNames.has(closestName)) {
            matchedNames.add(closestName);
          }
        }

        resolve(Array.from(matchedNames));
      } catch (err) {
        console.error("Failed to extract colors from image:", err);
        resolve([]);
      }
    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
