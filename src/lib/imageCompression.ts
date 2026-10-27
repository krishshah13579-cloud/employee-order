/**
 * High-Fidelity Client-Side Image Processor
 * Preserves crisp fabric textures, stitching, and color accuracy while generating
 * optimized WebP/JPEG data URLs for ultra-fast loading without pixelation.
 */

export async function compressImageFile(
  file: File,
  maxWidth = 3840,
  maxHeight = 3840,
  quality = 0.90
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image, read directly as data URL
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio scaling up to 1600px (Full HD/2K crisp clarity)
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Enable high-quality bicubic image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // White background for any transparent regions
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern WebP for 3x sharper fabric texture at smaller file sizes
        try {
          const webpDataUrl = canvas.toDataURL("image/webp", quality);
          if (webpDataUrl.startsWith("data:image/webp")) {
            return resolve(webpDataUrl);
          }
        } catch {}

        // High-fidelity JPEG fallback
        const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(jpegDataUrl);
      };

      img.onerror = () => {
        // Fallback to original data URL if HTMLImageElement decoding fails
        resolve(e.target?.result as string);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
