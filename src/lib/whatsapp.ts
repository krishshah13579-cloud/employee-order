/**
 * WhatsApp Messaging Integration for Krish Clothing Co. (GarmentPro)
 * Supports:
 * 1. 1-Click WhatsApp Direct URL (opens WhatsApp Web / App with pre-filled message, customer phone, and PDF invoice link)
 * 2. Meta WhatsApp Cloud API (background server-side direct dispatch if WHATSAPP_TOKEN & WHATSAPP_PHONE_NUMBER_ID are provided)
 * 3. UltraMsg API (background dispatch if ULTRAMSG_INSTANCE_ID & ULTRAMSG_TOKEN are provided)
 * 4. Weekly Payment Reminder generation and dispatch
 */

export interface WhatsAppOrderPayload {
  orderNumber: string;
  orderDate?: string | Date;
  customerName: string;
  customerPhone?: string | null;
  customerGstPan?: string | null;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  creditDays?: number;
  transportName?: string | null;
  status?: string;
  placedBy?: string | null;
}

/** Sanitize Indian phone number to international format (e.g., 9426934229 -> 919426934229) */
export function formatWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  // If 10 digits Indian mobile, prepend 91
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.slice(1);
  } else if (cleaned.length === 12 && cleaned.startsWith("91")) {
    // already 91...
  }
  return cleaned;
}

/**
 * Generate formatted WhatsApp message for new order confirmation / tax invoice
 */
export function generateOrderWhatsAppMessage(
  order: WhatsAppOrderPayload,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://employee-order.vercel.app"
): string {
  const invoiceUrl = `${baseUrl.replace(/\/$/, "")}/orders/${order.orderNumber}`;
  const creditDays = order.creditDays !== undefined ? order.creditDays : 45;
  const creditTermText =
    creditDays > 0 ? `Payment within ${creditDays} Days` : "Advance Payment (0 Days Credit)";

  let resolvedTransport = order.transportName || "";
  if (!resolvedTransport && (order as any).notes) {
    const match = (order as any).notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
    if (match && match[1]) resolvedTransport = match[1].trim();
  }

  return (
    `🧵 *KRISH CLOTHING CO.* — Order Placed Successfully\n\n` +
    `Dear *${order.customerName}*,\n` +
    `Thank you for your wholesale order with Krish Clothing Co.! Your order has been registered and is being processed.\n\n` +
    `📋 *Order & Invoice Summary:*\n` +
    `• *Invoice No:* #${order.orderNumber}\n` +
    `• *Date:* ${order.orderDate ? new Date(order.orderDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}\n` +
    `• *Quantity:* ${order.totalSets} Sets (${order.totalPcs} Pieces)\n` +
    `• *Taxable Amount:* ₹${order.subtotal.toLocaleString("en-IN")}\n` +
    `• *GST (5%):* ₹${order.gstAmount.toLocaleString("en-IN")}\n` +
    `• *Grand Total:* ₹${order.grandTotal.toLocaleString("en-IN")}\n` +
    `• *Transport:* ${resolvedTransport || "Direct Parcel / Transport"}\n` +
    `• *Credit Terms:* ${creditTermText}\n\n` +
    `🏦 *Bank Account Details for RTGS / NEFT:*\n` +
    `• *Bank:* ICICI BANK\n` +
    `• *Account No:* 750705000692\n` +
    `• *IFSC Code:* ICIC0007507\n` +
    `• *Beneficiary:* KRISH CLOTHING CO.\n` +
    `• *Branch:* Maninagar Khokhra, Ahmedabad\n\n` +
    `📄 *View / Download Tax Invoice (A4 PDF):*\n` +
    `${invoiceUrl}\n\n` +
    `For any changes or dispatch queries, please reply to this WhatsApp message.\n` +
    `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`
  );
}

/**
 * Generate formatted WhatsApp message for weekly payment reminder
 */
export function generatePaymentReminderWhatsAppMessage(
  order: WhatsAppOrderPayload,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://employee-order.vercel.app"
): string {
  const invoiceUrl = `${baseUrl.replace(/\/$/, "")}/orders/${order.orderNumber}`;
  const orderDateObj = order.orderDate ? new Date(order.orderDate) : new Date();
  const creditDays = order.creditDays !== undefined ? order.creditDays : 45;

  // Calculate Due Date
  const dueDate = new Date(orderDateObj);
  dueDate.setDate(dueDate.getDate() + creditDays);
  const now = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let dueStatusText = "";
  if (diffDays < 0) {
    dueStatusText = `⚠️ *OVERDUE by ${Math.abs(diffDays)} Days*`;
  } else if (diffDays === 0) {
    dueStatusText = `⏰ *DUE TODAY*`;
  } else {
    dueStatusText = `📅 Due in ${diffDays} Days (${dueDate.toLocaleDateString("en-IN")})`;
  }

  return (
    `🔔 *KRISH CLOTHING CO.* — Weekly Payment Reminder\n\n` +
    `Dear *${order.customerName}*,\n` +
    `This is a gentle weekly reminder regarding your outstanding invoice for wholesale garments:\n\n` +
    `📋 *Invoice Reference:*\n` +
    `• *Invoice / Order No:* #${order.orderNumber}\n` +
    `• *Invoice Date:* ${orderDateObj.toLocaleDateString("en-IN")}\n` +
    `• *Bill Amount:* ₹${order.grandTotal.toLocaleString("en-IN")}\n` +
    `• *Credit Terms:* ${creditDays > 0 ? `${creditDays} Days` : "Advance"}\n` +
    `• *Payment Status:* ${dueStatusText}\n\n` +
    `🏦 *Payment Bank Account Details (RTGS / NEFT / IMPS):*\n` +
    `• *Bank Name:* ICICI BANK\n` +
    `• *Account No:* 750705000692\n` +
    `• *IFSC Code:* ICIC0007507\n` +
    `• *Name:* KRISH CLOTHING CO.\n\n` +
    `📄 *View A4 Tax Invoice:* ${invoiceUrl}\n\n` +
    `Kindly arrange the payment at your earliest convenience. If already transferred, please share the UTR / payment receipt screenshot here.\n\n` +
    `Thank you for your valued business!\n` +
    `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`
  );
}

/**
 * Generate WhatsApp Web/App clickable deep link
 */
export function createWhatsAppDirectLink(phone: string, text: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Dispatch message via Meta Cloud API or UltraMsg if configured
 */
export async function dispatchAutomatedWhatsApp(
  phone: string,
  message: string
): Promise<{ success: boolean; method: string; error?: string }> {
  const cleanPhone = formatWhatsAppPhone(phone);
  const metaToken =
    process.env.WHATSAPP_TOKEN ||
    "EAAevAelNnwkBSs3GQ7wHyRj52ClOHlzgXNR7ycZCZAVUZBjKyrGUdD9ZCGZB32EWSZCi4bnBrImGrrmtWWwMvqZBckRgsWm3ATMBv6ZAZCkeneS5cDgw5ADqxaRU9l1PscZBgDi9MoAqW8abgdPZBTzeUAOCILKNHNqEhxBRwwC7kr9OfNdRCFw7LXIi7EnoipO3ZC6TVQZDZD";
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1435860432936279";

  // 1. Meta WhatsApp Cloud API
  if (metaToken && metaPhoneId && cleanPhone) {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { preview_url: true, body: message },
        }),
      });

      if (res.ok) {
        console.log(`✅ WhatsApp message sent via Meta Cloud API to ${cleanPhone}`);
        return { success: true, method: "META_CLOUD_API" };
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Meta WhatsApp Cloud API error:", errorData);
      }
    } catch (err: any) {
      console.error("Meta WhatsApp dispatch exception:", err.message);
    }
  }

  // 2. UltraMsg API fallback
  const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID;
  const ultraToken = process.env.ULTRAMSG_TOKEN;
  if (ultraInstance && ultraToken && cleanPhone) {
    try {
      const res = await fetch(`https://api.ultramsg.com/${ultraInstance}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: ultraToken,
          to: cleanPhone,
          body: message,
        }),
      });
      if (res.ok) {
        console.log(`✅ WhatsApp message sent via UltraMsg to ${cleanPhone}`);
        return { success: true, method: "ULTRAMSG" };
      }
    } catch (err: any) {
      console.error("UltraMsg dispatch exception:", err.message);
    }
  }

  return {
    success: false,
    method: "DIRECT_LINK_FALLBACK",
    error: "No WhatsApp Cloud API credentials configured. Use 1-Click WhatsApp Direct Link.",
  };
}
