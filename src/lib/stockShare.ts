/**
 * Stock Sharing Helper for IQ Trousers Wholesale
 * Shares comprehensive product stock breakdown WITH the product image attached
 * via Web Share API (mobile/desktop WhatsApp, Telegram, etc.) with clipboard/WhatsApp Web fallback.
 */

export interface StockShareData {
  productName: string;
  category?: string;
  price?: number;
  ratio?: string;
  pcsPerSet?: number;
  imageUrl?: string | null;
  colorStock: { color: string; sets: number; pcs?: number }[];
  mixStock?: { size: string; pcs: number }[];
  totalSets: number;
  totalPcs: number;
}

/**
 * Formats a clean WhatsApp-ready stock message
 */
export function formatStockShareText(data: StockShareData): string {
  let text = `🧵 *IQ TROUSERS — Live Stock Availability*\n\n`;
  text += `📦 *Product:* ${data.productName}${data.category ? ` (${data.category})` : ""}\n`;
  if (data.price) {
    text += `💰 *Wholesale Rate:* ₹${data.price} / pc\n`;
  }
  if (data.ratio) {
    text += `📐 *Size Ratio:* ${data.ratio} (${data.pcsPerSet || 5} pcs/set)\n\n`;
  }

  text += `🎨 *Available Sets Colorwise:*\n`;
  let hasSets = false;
  for (const cs of data.colorStock) {
    if (cs.sets > 0) {
      hasSets = true;
      const totalPcs = cs.pcs !== undefined ? cs.pcs : cs.sets * (data.pcsPerSet || 5);
      text += `• *${cs.color}:* ${cs.sets} Sets (${totalPcs} Pcs)\n`;
    }
  }
  if (!hasSets) {
    text += `• Currently Out of Stock for sets\n`;
  }

  if (data.mixStock && data.mixStock.length > 0) {
    const validMix = data.mixStock.filter((m) => m.pcs > 0);
    if (validMix.length > 0) {
      text += `\n⚡ *Mix Sizes Available:*\n`;
      for (const ms of validMix) {
        text += `• Size ${ms.size}: ${ms.pcs} Pc${ms.pcs > 1 ? "s" : ""}\n`;
      }
    }
  }

  text += `\n📊 *Total Available:* ${data.totalSets} Sets (${data.totalPcs} Pcs)\n`;
  text += `\n📍 *Krish Clothing Co. • IQ Trousers*\n📞 Contact: +91 81287 56632`;

  return text;
}

/**
 * Shares product stock with product image attached via Web Share API
 */
export async function shareProductStockWithImage(
  data: StockShareData,
  onToast?: (message: string, type: "success" | "error" | "info") => void
): Promise<void> {
  const text = formatStockShareText(data);

  // 1. Convert product image to a shareable File
  let imageFile: File | null = null;
  if (data.imageUrl && typeof window !== "undefined") {
    try {
      let imageBlob: Blob | null = null;

      if (data.imageUrl.startsWith("data:")) {
        // Base64 Data URL
        const parts = data.imageUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        imageBlob = new Blob([array], { type: mime });
      } else {
        // HTTP or local path
        const absoluteUrl = data.imageUrl.startsWith("http")
          ? data.imageUrl
          : `${window.location.origin}${data.imageUrl.startsWith("/") ? "" : "/"}${data.imageUrl}`;
        const resp = await fetch(absoluteUrl);
        if (resp.ok) {
          imageBlob = await resp.blob();
        }
      }

      if (imageBlob) {
        const mimeType = imageBlob.type || "image/jpeg";
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const filename = `${data.productName.replace(/[^\w-]/g, "_")}_stock.${ext}`;
        imageFile = new File([imageBlob], filename, { type: mimeType });
      }
    } catch (err) {
      console.warn("Could not prepare product image for share:", err);
    }
  }

  // 2. Try native Web Share API with attached image file
  if (
    typeof navigator !== "undefined" &&
    typeof (navigator as any).share === "function"
  ) {
    try {
      const sharePayload: any = {
        title: `${data.productName} Stock - IQ Trousers`,
        text: text,
      };

      if (
        imageFile &&
        (navigator as any).canShare &&
        (navigator as any).canShare({ files: [imageFile] })
      ) {
        sharePayload.files = [imageFile];
      }

      await (navigator as any).share(sharePayload);
      onToast?.("✅ Product image and live stock shared successfully!", "success");
      return;
    } catch (shareErr: any) {
      if (shareErr.name === "AbortError") {
        // User voluntarily dismissed share sheet
        return;
      }
      console.warn("Native share failed, falling back to WhatsApp link:", shareErr);
    }
  }

  // 3. Desktop Fallback: Copy formatted text to clipboard and open WhatsApp
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      onToast?.("📋 Stock summary copied! Opening WhatsApp...", "success");
    }
  } catch {}

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank");
}
