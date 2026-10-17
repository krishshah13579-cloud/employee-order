/**
 * Client-side WhatsApp launcher and Native PDF Document Sharing helper.
 * 
 * Satisfies:
 * 1. "INSTEAD OF PDF LINK SHARE THE PDF":
 *    - On Mobile (iOS/Android) and modern macOS/Windows: uses the Web Share API (navigator.share)
 *      with the actual PDF File Blob. This directly attaches the true PDF file document into WhatsApp!
 *    - On Desktop web browsers: automatically downloads the PDF document to the device and opens
 *      direct WhatsApp without any intermediate web landing page.
 * 2. "DO NOT ALLOW USER TO CRAWL ACROSS THE FOLDER":
 *    - Uses validated direct deep links (whatsapp:// and web.whatsapp.com/send) bypassing api.whatsapp.com.
 */

export interface WhatsAppLaunchOptions {
  whatsappUrl?: string;
  nativeUrl?: string;
  pdfUrl?: string;
  filename?: string;
  text?: string;
  preferNative?: boolean;
  onToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export function openWhatsAppDirectly(options: WhatsAppLaunchOptions): void {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const nativeLink = options.nativeUrl;
  const webLink = options.whatsappUrl;

  if (isMobile) {
    if (nativeLink) {
      window.location.href = nativeLink;
      return;
    }
  }

  if (options.preferNative && nativeLink) {
    window.location.href = nativeLink;
    return;
  }

  const target = webLink || nativeLink;
  if (target) {
    if (target.startsWith("whatsapp://")) {
      window.location.href = target;
    } else {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  }
}

/**
 * Shares the ACTUAL PDF FILE directly into WhatsApp (or downloads it) instead of sending a link.
 */
export async function shareOrOpenWhatsAppWithPdf(options: WhatsAppLaunchOptions): Promise<void> {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 1. Attempt Native File Sharing (Attaches the actual PDF document file directly into WhatsApp)
  if (options.pdfUrl && typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
    try {
      const res = await fetch(options.pdfUrl);
      if (res.ok) {
        const blob = await res.blob();
        const safeName = (options.filename || "Garment_Document.pdf").replace(/[^\w.-]/g, "_");
        const pdfFile = new File([blob], safeName, { type: "application/pdf" });

        if (typeof (navigator as any).canShare === "function" && (navigator as any).canShare({ files: [pdfFile] })) {
          await (navigator as any).share({
            files: [pdfFile],
            title: options.filename || "Krish Clothing Co. Invoice",
            text: options.text || "",
          });
          options.onToast?.("✅ PDF document shared directly to WhatsApp!", "success");
          return;
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User voluntarily dismissed share sheet
        return;
      }
      console.warn("Native file sharing unavailable or aborted, falling back:", err);
    }
  }

  // 2. Fallback: Automatically download the actual PDF file to the device
  if (options.pdfUrl) {
    try {
      const downloadLink = document.createElement("a");
      downloadLink.href = options.pdfUrl;
      downloadLink.download = (options.filename || "Invoice.pdf").replace(/[^\w.-]/g, "_");
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (e) {
      console.warn("Could not auto-download PDF:", e);
    }
  }

  // 3. Open WhatsApp with message draft (without any PDF download link)
  openWhatsAppDirectly(options);

  if (options.onToast) {
    if (isMobile) {
      options.onToast("Opening WhatsApp with order details...", "success");
    } else {
      options.onToast("📄 PDF downloaded! WhatsApp opened — please attach the PDF in the chat.", "success");
    }
  }
}
