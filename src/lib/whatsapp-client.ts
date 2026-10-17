/**
 * Client-side WhatsApp launcher helper.
 * Eliminates intermediate redirects (api.whatsapp.com) by:
 * - On Mobile: Using the native "whatsapp://" protocol to directly open the WhatsApp / WhatsApp Business app.
 * - On Desktop: Directly opening WhatsApp Web (web.whatsapp.com) or native desktop app without landing pages.
 */

export interface WhatsAppLaunchOptions {
  whatsappUrl?: string;
  nativeUrl?: string;
  preferNative?: boolean;
}

export function openWhatsAppDirectly(options: WhatsAppLaunchOptions): void {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const nativeLink = options.nativeUrl;
  const webLink = options.whatsappUrl;

  if (isMobile) {
    if (nativeLink) {
      // Direct deep link into native WhatsApp / WhatsApp Business app
      window.location.href = nativeLink;
      return;
    }
  }

  // On Desktop
  if (options.preferNative && nativeLink) {
    // Attempt native app if user prefers desktop app
    window.location.href = nativeLink;
    return;
  }

  // Direct into WhatsApp Web chat without landing page
  const target = webLink || nativeLink;
  if (target) {
    if (target.startsWith("whatsapp://")) {
      window.location.href = target;
    } else {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  }
}
