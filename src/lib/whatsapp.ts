/**
 * WhatsApp Messaging Integration for Krish Clothing Co. (GarmentPro)
 * Supports:
 * 1. 1-Click WhatsApp Direct URL (opens WhatsApp Web / App with pre-filled message, customer phone, and PDF invoice link)
 * 2. Meta WhatsApp Cloud API (background server-side direct dispatch with PDF document attachment)
 * 3. UltraMsg API (background dispatch with PDF document attachment)
 * 4. Two Formats: Order Form PDF & Tax Invoice PDF
 * 5. Weekly Customer Outstanding Payment Reminder with FIFO ledger summary
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
  taxInvoiceNumber?: string | null;
  taxInvoiceDate?: string | Date | null;
  notes?: string | null;
}

export interface CustomerOutstandingPayload {
  customerName: string;
  customerPhone?: string | null;
  city?: string | null;
  gstPanNo?: string | null;
  creditDays?: number;
  totalBilled: number;
  totalPaid: number;
  totalReturns: number;
  outstandingBalance: number;
  pendingBillsCount: number;
  billsSummary?: Array<{
    invoiceNo: string;
    invoiceDate: string | Date;
    totalAmount: number;
    balanceAmount: number;
  }>;
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
 * Generate formatted WhatsApp message for Order Form (Format 1: When order is placed / confirmed)
 */
export function generateOrderWhatsAppMessage(
  order: WhatsAppOrderPayload,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://krish-clothing.vercel.app"
): string {
  const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/orders/${order.orderNumber}/pdf?type=order_form`;
  const viewUrl = `${baseUrl.replace(/\/$/, "")}/orders/${order.orderNumber}`;
  const creditDays = order.creditDays !== undefined ? order.creditDays : 45;
  const creditTermText =
    creditDays > 0 ? `Payment every week & completed within ${creditDays} Days` : "Advance Payment (0 Days Credit)";

  let resolvedTransport = order.transportName || "";
  if (!resolvedTransport && order.notes) {
    const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
    if (match && match[1]) resolvedTransport = match[1].trim();
  }

  return (
    `🧵 *KRISH CLOTHING CO.* — Order Form Confirmed\n\n` +
    `Dear *${order.customerName.toUpperCase()}*,\n` +
    `Thank you for your wholesale order with Krish Clothing Co.! Your order has been confirmed.\n\n` +
    `📋 *Order Form Summary:*\n` +
    `• *Order No:* #${order.orderNumber}\n` +
    `• *Date:* ${order.orderDate ? new Date(order.orderDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}\n` +
    `• *Total Quantity:* ${order.totalSets} Sets (${order.totalPcs} Pieces)\n` +
    `• *Subtotal:* ₹${order.subtotal.toLocaleString("en-IN")}\n` +
    `• *GST (5%):* ₹${order.gstAmount.toLocaleString("en-IN")}\n` +
    `• *Grand Total:* ₹${order.grandTotal.toLocaleString("en-IN")}\n` +
    `• *Transport:* ${resolvedTransport || "Direct Parcel / Transport"}\n` +
    `• *Payment Terms:* ${creditTermText}\n\n` +
    `🏦 *Bank Account Details for Payment (RTGS / NEFT):*\n` +
    `• *Bank:* ICICI BANK\n` +
    `• *Account No:* 750705000692\n` +
    `• *IFSC Code:* ICIC0007507\n` +
    `• *Beneficiary:* KRISH CLOTHING CO.\n` +
    `• *Branch:* Maninagar Khokhra, Ahmedabad\n\n` +
    `📄 *Official Order Form PDF Attached*\n\n` +
    `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`
  );
}

/**
 * Generate formatted WhatsApp message for Tax Invoice (Format 2: After order is ready with admin-updated quantities)
 */
export function generateTaxInvoiceWhatsAppMessage(
  order: WhatsAppOrderPayload,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://krish-clothing.vercel.app"
): string {
  const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/orders/${order.orderNumber}/pdf?type=tax_invoice`;
  const viewUrl = `${baseUrl.replace(/\/$/, "")}/orders/${order.orderNumber}`;
  const invNo = order.taxInvoiceNumber || order.orderNumber;
  const invDate = order.taxInvoiceDate || order.orderDate;
  const creditDays = order.creditDays !== undefined ? order.creditDays : 45;
  const creditTermText =
    creditDays > 0 ? `Payment every week & completed within ${creditDays} Days` : "Advance Payment";

  let resolvedTransport = order.transportName || "";
  if (!resolvedTransport && order.notes) {
    const match = order.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
    if (match && match[1]) resolvedTransport = match[1].trim();
  }

  return (
    `📦 *KRISH CLOTHING CO.* — Tax Invoice (Order Ready for Dispatch)\n\n` +
    `Dear *${order.customerName.toUpperCase()}*,\n` +
    `Your wholesale order is ready for dispatch! Please find your official Tax Invoice with final quantities and billing below.\n\n` +
    `📋 *Tax Invoice Details:*\n` +
    `• *Tax Invoice No:* #${invNo}\n` +
    `• *Order Reference:* #${order.orderNumber}\n` +
    `• *Invoice Date:* ${invDate ? new Date(invDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}\n` +
    `• *Dispatched Quantity:* ${order.totalSets} Sets (${order.totalPcs} Pieces)\n` +
    `• *Taxable Value:* ₹${order.subtotal.toLocaleString("en-IN")}\n` +
    `• *GST (5%):* ₹${order.gstAmount.toLocaleString("en-IN")}\n` +
    `• *Final Bill Amount:* ₹${order.grandTotal.toLocaleString("en-IN")}\n` +
    `• *Transport:* ${resolvedTransport || "Direct Parcel / Transport"}\n` +
    `• *Payment Terms:* ${creditTermText}\n\n` +
    `🏦 *Bank Account Details for Payment (RTGS / NEFT / IMPS):*\n` +
    `• *Bank:* ICICI BANK\n` +
    `• *Account No:* 750705000692\n` +
    `• *IFSC Code:* ICIC0007507\n` +
    `• *Beneficiary:* KRISH CLOTHING CO.\n` +
    `• *Branch:* Maninagar Khokhra, Ahmedabad\n\n` +
    `📄 *Official Tax Invoice PDF Attached*\n\n` +
    `Kindly arrange payment as per weekly credit terms. Thank you for your business!\n` +
    `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`
  );
}

/**
 * Generate formatted WhatsApp message for weekly customer outstanding reminder
 */
export function generateCustomerOutstandingWhatsAppMessage(
  payload: CustomerOutstandingPayload,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://krish-clothing.vercel.app"
): string {
  let billsSection = "";
  if (payload.billsSummary && payload.billsSummary.length > 0) {
    billsSection =
      `📋 *Pending Bills (FIFO Allocation):*\n` +
      payload.billsSummary
        .slice(0, 5)
        .map(
          (b) =>
            `• *${b.invoiceNo}* (${new Date(b.invoiceDate).toLocaleDateString("en-IN")}): Total ₹${b.totalAmount.toLocaleString("en-IN")} | Bal: *₹${b.balanceAmount.toLocaleString("en-IN")}*`
        )
        .join("\n") +
      (payload.billsSummary.length > 5 ? `\n• _+ ${payload.billsSummary.length - 5} more bills..._` : "") +
      `\n\n`;
  }

  return (
    `🔔 *KRISH CLOTHING CO.* — Weekly Payment Reminder\n\n` +
    `Dear *${payload.customerName.toUpperCase()}*,\n` +
    `This is a gentle weekly reminder regarding your outstanding payment balance with Krish Clothing Co.\n\n` +
    `📊 *Statement of Account:*\n` +
    `• *Firm Name:* ${payload.customerName.toUpperCase()}\n` +
    `• *City:* ${payload.city || "Ahmedabad"}\n` +
    `• *Total Billed:* ₹${payload.totalBilled.toLocaleString("en-IN")}\n` +
    `• *Total Paid / Received:* ₹${payload.totalPaid.toLocaleString("en-IN")}\n` +
    (payload.totalReturns > 0 ? `• *Sales Returns Credited:* ₹${payload.totalReturns.toLocaleString("en-IN")}\n` : "") +
    `• *NET OUTSTANDING BALANCE:* *₹${payload.outstandingBalance.toLocaleString("en-IN")}*\n` +
    `• *Unpaid Invoices:* ${payload.pendingBillsCount}\n\n` +
    billsSection +
    `🏦 *Bank Account Details for Payment (RTGS / NEFT / IMPS):*\n` +
    `• *Bank Name:* ICICI BANK\n` +
    `• *Account No:* 750705000692\n` +
    `• *IFSC Code:* ICIC0007507\n` +
    `• *Beneficiary:* KRISH CLOTHING CO.\n` +
    `• *Branch:* Maninagar Khokhra, Ahmedabad\n\n` +
    `Kindly arrange payment at your earliest convenience. If already transferred, please reply with the UTR number or payment screenshot.\n\n` +
    `Thank you for your cooperation!\n` +
    `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`
  );
}

/**
 * Generate formatted WhatsApp message for single order weekly payment reminder
 */
export function generatePaymentReminderWhatsAppMessage(
  order: WhatsAppOrderPayload,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://krish-clothing.vercel.app"
): string {
  const invoiceUrl = `${baseUrl.replace(/\/$/, "")}/orders/${order.orderNumber}`;
  const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/orders/${order.orderNumber}/pdf?type=tax_invoice`;
  const orderDateObj = order.orderDate ? new Date(order.orderDate) : new Date();
  const creditDays = order.creditDays !== undefined ? order.creditDays : 45;

  return (
    `🔔 *KRISH CLOTHING CO.* — Weekly Payment Reminder\n\n` +
    `Dear *${order.customerName.toUpperCase()}*,\n` +
    `This is a gentle weekly reminder regarding your outstanding bill:\n\n` +
    `📋 *Bill Details:*\n` +
    `• *Invoice / Order No:* #${order.taxInvoiceNumber || order.orderNumber}\n` +
    `• *Date:* ${orderDateObj.toLocaleDateString("en-IN")}\n` +
    `• *Amount Due:* *₹${order.grandTotal.toLocaleString("en-IN")}*\n` +
    `• *Payment Terms:* Payment every week & completed within ${creditDays} Days\n\n` +
    `🏦 *Bank Account Details for RTGS / NEFT / IMPS:*\n` +
    `• *Bank:* ICICI BANK\n` +
    `• *Account No:* 750705000692\n` +
    `• *IFSC Code:* ICIC0007507\n` +
    `• *Beneficiary:* KRISH CLOTHING CO.\n` +
    `• *Branch:* Maninagar Khokhra, Ahmedabad\n\n` +
    `📄 *Statement / Invoice PDF Attached*\n\n` +
    `Kindly arrange the payment at your earliest convenience.\n` +
    `_Krish Clothing Co., Ahmedabad (M: 8128756632)_`
  );
}

/**
 * Generate WhatsApp Web direct link (bypasses api.whatsapp.com landing page)
 */
export function createWhatsAppDirectLink(phone: string, text: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Generate WhatsApp Native App deep link (opens native WhatsApp or WhatsApp Business application directly)
 */
export function createWhatsAppNativeLink(phone: string, text: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `whatsapp://send?text=${encodedText}`;
}

/**
 * Dispatch message via Meta Cloud API or UltraMsg with optional PDF document attachment
 */
export async function dispatchAutomatedWhatsApp(
  phone: string,
  message: string,
  documentOptions?: {
    pdfUrl: string;
    filename: string;
  }
): Promise<{ success: boolean; method: string; error?: string }> {
  const cleanPhone = formatWhatsAppPhone(phone);
  if (!cleanPhone) {
    return { success: false, method: "NONE", error: "Missing phone number" };
  }

  // 1. Direct Linked WhatsApp Gateway (UltraMsg) - Sends directly from WhatsApp Business number 8128756632
  const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID;
  const ultraToken = process.env.ULTRAMSG_TOKEN;
  if (ultraInstance && ultraToken) {
    try {
      if (documentOptions?.pdfUrl) {
        const res = await fetch(`https://api.ultramsg.com/${ultraInstance}/messages/document`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: ultraToken,
            to: cleanPhone,
            filename: documentOptions.filename,
            document: documentOptions.pdfUrl,
            caption: message,
          }),
        });
        if (res.ok) {
          console.log(`✅ WhatsApp document sent via UltraMsg from 8128756632 to ${cleanPhone}`);
          return { success: true, method: "ULTRAMSG_DOCUMENT" };
        } else {
          const errText = await res.text();
          console.error("UltraMsg document dispatch error:", errText);
        }
      } else {
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
          console.log(`✅ WhatsApp message sent via UltraMsg from 8128756632 to ${cleanPhone}`);
          return { success: true, method: "ULTRAMSG" };
        } else {
          const errText = await res.text();
          console.error("UltraMsg chat dispatch error:", errText);
        }
      }
    } catch (err: any) {
      console.error("UltraMsg dispatch exception:", err.message);
    }
  }

  // 2. Meta WhatsApp Cloud API (Fallback if configured with valid token)
  const metaToken = process.env.WHATSAPP_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (metaToken && metaPhoneId) {
    try {
      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
      };

      if (documentOptions?.pdfUrl) {
        payload.type = "document";
        payload.document = {
          link: documentOptions.pdfUrl,
          filename: documentOptions.filename,
          caption: message,
        };
      } else {
        payload.type = "text";
        payload.text = { preview_url: true, body: message };
      }

      const res = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

  return {
    success: false,
    method: "DIRECT_LINK_FALLBACK",
    error: "No WhatsApp Cloud API credentials configured or API call failed. Using 1-Click WhatsApp Direct Link.",
  };
}
