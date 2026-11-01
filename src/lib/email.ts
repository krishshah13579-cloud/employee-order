import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

async function getAdminRecipientEmail(): Promise<string> {
  if (process.env.ADMIN_EMAIL) return process.env.ADMIN_EMAIL;
  try {
    const profile = await prisma.adminProfile.findFirst({ select: { email: true } });
    if (profile?.email) return profile.email;
    const admin = await prisma.adminAccount.findFirst({ select: { username: true } });
    if (admin?.username) return admin.username;
  } catch {}
  return process.env.GMAIL_USER || "";
}

/**
 * Utility to send 2FA OTP security emails.
 * Supports:
 * 1. Gmail SMTP (via GMAIL_USER + GMAIL_APP_PASSWORD)
 * 2. Generic SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 3. Resend API (via RESEND_API_KEY)
 * 4. Brevo API (via BREVO_API_KEY)
 */
export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  adminName: string = "Administrator"
): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const resendApiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail =
    process.env.EMAIL_FROM || (gmailUser ? `"IQ TROUSERS Security" <${gmailUser}>` : "IQ TROUSERS Security <onboarding@resend.dev>");

  console.log(`\n======================================================`);
  console.log(`🔐 [2FA SECURITY EMAIL OTP]`);
  console.log(`Recipient : ${toEmail}`);
  console.log(`OTP Code  : ${otpCode}`);
  console.log(`Timestamp : ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  let lastError = "";

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
        <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Admin Security System</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <p style="color: #334155; font-size: 14px; margin: 0 0 12px 0;">Hello <strong>${adminName}</strong>,</p>
        <p style="color: #64748b; font-size: 13px; margin: 0 0 16px 0;">A request was made to unlock and edit the <strong>Admin & Business Details</strong> in your IQ Trousers Control Center. Enter the code below to authorize:</p>
        
        <div style="display: inline-block; background: #0f172a; color: #f59e0b; font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 12px 28px; border-radius: 10px; border: 1px solid #334155;">
          ${otpCode}
        </div>

        <p style="color: #94a3b8; font-size: 11px; margin: 16px 0 0 0;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
      </div>

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Protected by IQ Trousers Two-Factor Security Guard
      </p>
    </div>
  `;

  // 1. Dispatch via Gmail SMTP if GMAIL_USER and GMAIL_APP_PASSWORD are provided
  if (gmailUser && gmailAppPassword) {
    try {
      const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: gmailUser.trim(),
          pass: cleanPass,
        },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS Security" <${gmailUser.trim()}>`,
        to: toEmail,
        subject: `🔐 Your 2FA Security Code: ${otpCode}`,
        html: htmlContent,
      });

      console.log(`✅ 2FA OTP email successfully dispatched via Gmail to ${toEmail}`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to dispatch email via Gmail SMTP (port 465):", err.message);
      // Fallback: try port 587 (TLS) if 465 timed out or was blocked by host
      try {
        const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
        const fallbackTransporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: gmailUser.trim(),
            pass: cleanPass,
          },
          connectionTimeout: 4000,
          greetingTimeout: 4000,
          socketTimeout: 5000,
        });
        await fallbackTransporter.sendMail({
          from: `"IQ TROUSERS Security" <${gmailUser.trim()}>`,
          to: toEmail,
          subject: `🔐 Your 2FA Security Code: ${otpCode}`,
          html: htmlContent,
        });
        console.log(`✅ 2FA OTP email successfully dispatched via Gmail (port 587) to ${toEmail}`);
        return { success: true };
      } catch (fallbackErr: any) {
        console.error("Failed to dispatch email via Gmail SMTP (port 587):", fallbackErr.message);
        lastError = fallbackErr.message || err.message;
      }
    }
  }

  // 2. Dispatch via Resend if RESEND_API_KEY is configured
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `🔐 Your 2FA Security Code: ${otpCode}`,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Resend API response error:", errorData);
        lastError = "Resend API error";
      } else {
        console.log("✅ 2FA OTP email successfully dispatched via Resend to", toEmail);
        return { success: true };
      }
    } catch (err: any) {
      console.error("Failed to dispatch email via Resend:", err);
      lastError = err.message;
    }
  }

  // 3. Dispatch via Brevo if BREVO_API_KEY is configured
  if (brevoApiKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: "IQ TROUSERS Security", email: gmailUser || "security@iqtrousers.com" },
          to: [{ email: toEmail, name: adminName }],
          subject: `🔐 Your 2FA Security Code: ${otpCode}`,
          htmlContent: htmlContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Brevo API response error:", errorData);
        lastError = "Brevo API error";
      } else {
        console.log("✅ 2FA OTP email successfully dispatched via Brevo to", toEmail);
        return { success: true };
      }
    } catch (err: any) {
      console.error("Failed to dispatch email via Brevo:", err);
      lastError = err.message;
    }
  }

  if (!gmailUser && !resendApiKey && !brevoApiKey) {
    console.warn(
      "⚠️ [Email Notice] No email credentials found in environment variables. Add GMAIL_USER & GMAIL_APP_PASSWORD to receive 2FA emails."
    );
    lastError = "Email credentials (GMAIL_USER & GMAIL_APP_PASSWORD) not configured in environment variables.";
  }

  return { success: false, error: lastError };
}

/**
 * Dispatch instant email alert for new wholesale order to admin
 */
export async function sendNewOrderNotification(order: {
  orderNumber: string;
  customerName: string;
  customerGstPan?: string;
  customerPhone?: string;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  placedBy?: string;
}) {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const adminEmail = await getAdminRecipientEmail();
  if (!adminEmail) return;

  console.log(`\n📢 [NEW ORDER NOTIFICATION ALERT]`);
  console.log(`Order Number : ${order.orderNumber}`);
  console.log(`Customer     : ${order.customerName}`);
  console.log(`Amount       : ₹${order.grandTotal.toLocaleString("en-IN")}`);
  console.log(`Sets / Pcs   : ${order.totalSets} Sets (${order.totalPcs} Pcs)`);
  console.log(`Placed By    : ${order.placedBy || "Sales Rep"}`);

  if (gmailUser && gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser.trim(),
          pass: gmailAppPassword.replace(/\s+/g, "").trim(),
        },
      });

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; pb: 16px;">
            <h1 style="color: #0f172a; font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase;">IQ TROUSERS</h1>
            <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">New Wholesale Order Alert</p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 13px;">Order Number:</span>
              <strong style="color: #0f172a; font-size: 14px; font-family: monospace;">${order.orderNumber}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 13px;">Customer Shop:</span>
              <strong style="color: #0f172a; font-size: 14px;">${order.customerName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 13px;">GST / PAN No.:</span>
              <strong style="color: #ea580c; font-size: 13px; font-family: monospace;">${order.customerGstPan || "—"}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 13px;">Quantity:</span>
              <strong style="color: #0f172a; font-size: 14px;">${order.totalSets} Sets (${order.totalPcs} Pieces)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 13px;">Booked By:</span>
              <strong style="color: #0f172a; font-size: 14px;">${order.placedBy || "Sales Rep"}</strong>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between;">
              <span style="color: #0f172a; font-size: 15px; font-weight: 800;">Grand Total (incl. 5% GST):</span>
              <span style="color: #16a34a; font-size: 18px; font-weight: 900; font-family: monospace;">₹${order.grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
            IQ Trousers Wholesale Automation System
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"IQ TROUSERS Orders" <${gmailUser.trim()}>`,
        to: adminEmail,
        subject: `📦 [New Order] #${order.orderNumber} from ${order.customerName} — ₹${order.grandTotal.toLocaleString("en-IN")}`,
        html,
      });
      console.log(`✅ New order notification email successfully sent to ${adminEmail}`);
    } catch (err: any) {
      console.error("Failed to send order email alert:", err.message);
    }
  }
}

/**
 * Dispatch instant email alert for new customer registration to admin
 */
export async function sendNewCustomerNotification(customer: {
  shopName: string;
  gstPanNo: string;
  phoneNumber: string;
  contactPerson?: string;
  city?: string;
  state?: string;
  address?: string;
}) {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const adminEmail = await getAdminRecipientEmail();
  if (!adminEmail) return;

  console.log(`\n👥 [NEW CUSTOMER NOTIFICATION ALERT]`);
  console.log(`Shop Name : ${customer.shopName}`);
  console.log(`GST/PAN   : ${customer.gstPanNo}`);
  console.log(`Phone     : ${customer.phoneNumber}`);

  if (gmailUser && gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser.trim(),
          pass: gmailAppPassword.replace(/\s+/g, "").trim(),
        },
      });

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; pb: 16px;">
            <h1 style="color: #0f172a; font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase;">IQ TROUSERS</h1>
            <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">New Wholesale Customer Registered</p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
            <div style="margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; display: block;">Firm / Shop Name:</span>
              <strong style="color: #0f172a; font-size: 16px;">${customer.shopName}</strong>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; display: block;">GST No. / PAN No.:</span>
              <strong style="color: #ea580c; font-size: 14px; font-family: monospace;">${customer.gstPanNo}</strong>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; display: block;">Phone Number:</span>
              <strong style="color: #0f172a; font-size: 14px;">${customer.phoneNumber}</strong>
            </div>
            ${customer.contactPerson ? `
            <div style="margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; display: block;">Contact Person:</span>
              <span style="color: #0f172a; font-size: 14px;">${customer.contactPerson}</span>
            </div>` : ""}
            ${customer.city || customer.state ? `
            <div style="margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; display: block;">Location:</span>
              <span style="color: #0f172a; font-size: 14px;">${[customer.city, customer.state].filter(Boolean).join(", ")}</span>
            </div>` : ""}
            ${customer.address ? `
            <div>
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; display: block;">Address:</span>
              <span style="color: #475569; font-size: 13px;">${customer.address}</span>
            </div>` : ""}
          </div>

          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
            IQ Trousers Wholesale Automation System
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"IQ TROUSERS Accounts" <${gmailUser.trim()}>`,
        to: adminEmail,
        subject: `👥 [New Customer] ${customer.shopName} (${customer.gstPanNo}) Registered`,
        html,
      });
      console.log(`✅ New customer notification email successfully sent to ${adminEmail}`);
    } catch (err: any) {
      console.error("Failed to send customer email alert:", err.message);
    }
  }
}

/**
 * Dispatch comprehensive monthly processed orders report to administrator via email
 */
export async function sendMonthlyOrdersReportEmail(reportData: {
  monthName: string;
  year: number;
  totalOrders: number;
  totalRevenue: number;
  totalSets: number;
  totalPcs: number;
  retailerOrdersCount: number;
  wholesalerOrdersCount: number;
  orders: {
    orderNumber: string;
    customerName: string;
    customerGstPan?: string;
    businessType?: string;
    creditDays?: number;
    totalSets: number;
    totalPcs: number;
    grandTotal: number;
    status: string;
    orderDate: string;
  }[];
  generatedAt?: string;
}, recipientEmail?: string) {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const adminEmail = recipientEmail || await getAdminRecipientEmail();
  if (!adminEmail) {
    return { success: false, error: "No admin recipient email configured." };
  }

  console.log(`\n📊 [MONTHLY ORDERS REPORT DISPATCH]`);
  console.log(`Period       : ${reportData.monthName} ${reportData.year}`);
  console.log(`Total Orders : ${reportData.totalOrders}`);
  console.log(`Total Revenue: ₹${reportData.totalRevenue.toLocaleString("en-IN")}`);

  if (gmailUser && gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser.trim(),
          pass: gmailAppPassword.replace(/\s+/g, "").trim(),
        },
      });

      const orderRowsHtml = reportData.orders.slice(0, 50).map((ord) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 12px; font-family: monospace; font-weight: bold; color: #0f172a; font-size: 12px;">${ord.orderNumber}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #1e293b;">
            <strong>${ord.customerName}</strong>
            ${ord.customerGstPan ? `<span style="display:block; font-size: 10px; color: #64748b; font-family: monospace;">${ord.customerGstPan}</span>` : ""}
          </td>
          <td style="padding: 10px 12px; font-size: 11px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-weight: bold; ${ord.businessType === "WHOLESALER" ? "background: #f3e8ff; color: #7e22ce;" : "background: #dbeafe; color: #1d4ed8;"}">
              ${ord.businessType || "RETAILER"}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 11px; text-align: center; color: #475569;">
            ${ord.creditDays ? `<span style="font-weight: bold; color: #d97706;">${ord.creditDays}d</span>` : "Cash/0d"}
          </td>
          <td style="padding: 10px 12px; font-size: 12px; text-align: center; font-family: monospace; color: #334155;">
            ${ord.totalSets}s (${ord.totalPcs}p)
          </td>
          <td style="padding: 10px 12px; font-size: 12px; text-align: right; font-weight: bold; color: #0f172a; font-family: monospace;">
            ₹${ord.grandTotal.toLocaleString("en-IN")}
          </td>
          <td style="padding: 10px 12px; font-size: 11px; text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #ecfdf5; color: #047857;">
              ${ord.status}
            </span>
          </td>
        </tr>
      `).join("");

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 780px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #0f172a;">
            <h1 style="color: #0f172a; font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
            <p style="color: #ea580c; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-top: 4px; letter-spacing: 2px;">Monthly Processed Orders Report — ${reportData.monthName} ${reportData.year}</p>
            <p style="color: #64748b; font-size: 11px; margin-top: 4px;">Generated on: ${reportData.generatedAt || new Date().toLocaleString("en-IN")}</p>
          </div>

          <!-- KPI Cards Grid -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; display: block;">Total Revenue</span>
              <strong style="color: #16a34a; font-size: 18px; font-family: monospace; display: block; margin-top: 4px;">₹${reportData.totalRevenue.toLocaleString("en-IN")}</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; display: block;">Orders Processed</span>
              <strong style="color: #0f172a; font-size: 18px; font-family: monospace; display: block; margin-top: 4px;">${reportData.totalOrders}</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; display: block;">Volume (Sets / Pcs)</span>
              <strong style="color: #0f172a; font-size: 15px; font-family: monospace; display: block; margin-top: 6px;">${reportData.totalSets}s / ${reportData.totalPcs}p</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; display: block;">Channel Mix</span>
              <span style="font-size: 11px; display: block; margin-top: 6px; color: #334155;">
                <strong style="color: #1d4ed8;">${reportData.retailerOrdersCount}</strong> Retailer | <strong style="color: #7e22ce;">${reportData.wholesalerOrdersCount}</strong> Wholesaler
              </span>
            </div>
          </div>

          <!-- Orders Table -->
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
              <thead style="background: #0f172a; color: #ffffff;">
                <tr style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
                  <th style="padding: 10px 12px;">Order #</th>
                  <th style="padding: 10px 12px;">Customer</th>
                  <th style="padding: 10px 12px;">Type</th>
                  <th style="padding: 10px 12px; text-align: center;">Credit</th>
                  <th style="padding: 10px 12px; text-align: center;">Sets (Pcs)</th>
                  <th style="padding: 10px 12px; text-align: right;">Amount (₹)</th>
                  <th style="padding: 10px 12px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${orderRowsHtml || `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8;">No processed orders found for this period.</td></tr>`}
              </tbody>
            </table>
          </div>

          <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 12px; padding: 14px; text-align: center; margin-bottom: 16px;">
            <p style="color: #c2410c; font-size: 12px; margin: 0; font-weight: 600;">
              Total Processed Wholesale Turnover: ₹${reportData.totalRevenue.toLocaleString("en-IN")} (incl. 5% GST) across ${reportData.totalOrders} order(s).
            </p>
          </div>

          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
            IQ TROUSERS Wholesale Automation System • Confidential Internal Report
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"IQ TROUSERS Reports" <${gmailUser.trim()}>`,
        to: adminEmail,
        subject: `📊 [Monthly Report] ${reportData.monthName} ${reportData.year} — ₹${reportData.totalRevenue.toLocaleString("en-IN")} (${reportData.totalOrders} Orders)`,
        html,
      });

      console.log(`✅ Monthly report email successfully dispatched to ${adminEmail}`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to send monthly report email:", err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: "Email credentials not configured in environment." };
}

export interface SoldOutColorItem {
  productName: string;
  colorName: string;
  colorAlphabet: string;
  orderNumber?: string;
}

/**
 * Dispatch instant email alert when a product color variant sells out.
 * Requirement format: "[PRODUCT NAME] ([COLOR ALPHABET]) IS SOLD OUT"
 */
export async function sendColorSoldOutNotification(items: SoldOutColorItem[]) {
  if (!items || items.length === 0) return;

  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const adminEmail = await getAdminRecipientEmail();
  if (!adminEmail) return;

  for (const item of items) {
    const alertMessage = `${item.productName} (${item.colorAlphabet}) IS SOLD OUT`;
    console.log(`\n🚨 [STOCK ALERT - SOLD OUT]`);
    console.log(`Notice    : ${alertMessage}`);
    console.log(`Color     : ${item.colorName}`);
    console.log(`Order No. : ${item.orderNumber || "Stock Update"}`);

    if (gmailUser && gmailAppPassword) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailUser.trim(),
            pass: gmailAppPassword.replace(/\s+/g, "").trim(),
          },
        });

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #fee2e2; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #fee2e2; padding-bottom: 16px;">
              <h1 style="color: #dc2626; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase;">SOLD OUT NOTIFICATION</h1>
              <p style="color: #991b1b; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Inventory Alert</p>
            </div>

            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; margin-bottom: 20px; text-align: center;">
              <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
              <h2 style="color: #991b1b; font-size: 22px; font-weight: 900; margin: 0 0 10px 0; letter-spacing: 0.5px;">
                ${alertMessage}
              </h2>
              <p style="color: #4b5563; font-size: 14px; margin: 0 0 16px 0;">
                Color Variant: <strong style="color: #111827;">${item.colorName}</strong> (Shade <strong style="color: #ea580c;">${item.colorAlphabet}</strong>) has reached <strong>0 stock</strong>.
              </p>
              ${
                item.orderNumber
                  ? `<div style="display: inline-block; background: #ffffff; border: 1px solid #fca5a5; padding: 8px 16px; border-radius: 8px; font-size: 12px; color: #991b1b; font-weight: 600;">
                      Sold out after Order <strong>#${item.orderNumber}</strong> was placed
                    </div>`
                  : `<div style="display: inline-block; background: #ffffff; border: 1px solid #fca5a5; padding: 8px 16px; border-radius: 8px; font-size: 12px; color: #991b1b; font-weight: 600;">
                      Triggered during stock adjustment
                    </div>`
              }
            </div>

            <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
              IQ Trousers Wholesale Automation System &bull; Automatic Inventory Tracker
            </p>
          </div>
        `;

        await transporter.sendMail({
          from: `"IQ TROUSERS Stock Alert" <${gmailUser.trim()}>`,
          to: adminEmail,
          subject: `🚨 [SOLD OUT] ${alertMessage}`,
          html,
        });
        console.log(`✅ Sold-out notification email successfully dispatched to ${adminEmail} for ${alertMessage}`);
      } catch (err: any) {
        console.error("Failed to send sold out email alert:", err.message);
      }
    }
  }
}

export interface SendEmployeeStep1Params {
  to: string;
  name: string;
  mobileNumber: string;
  address: string;
  designation: string;
  isTeamLeader: boolean;
  canEditOrders: boolean;
  canUpdateStock: boolean;
  canViewOrderForm: boolean;
  isActive: boolean;
}

export interface SendEmployeeStep2Params {
  to: string;
  name: string;
  documentType?: string;
}

export interface SendEmployeeStep3Params {
  to: string;
  name: string;
  username: string;
  pin: string;
}

export interface SendEmployeePinResetParams {
  to: string;
  name: string;
  username?: string;
  newPin: string;
}

/**
 * 1. Step 1 Email: Sent when employee details, designation, and allowed permissions are saved
 */
export async function sendEmployeeStep1Email({
  to,
  name,
  mobileNumber,
  address,
  designation,
  isTeamLeader,
  canEditOrders,
  canUpdateStock,
  canViewOrderForm,
  isActive,
}: SendEmployeeStep1Params): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  const subject = `Welcome to IQ Trousers - Onboarding Process Started (Step 1 Complete)`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
        <h1 style="color: #0f172a; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
        <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Employee Onboarding System &bull; Step 1 of 3</p>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <p style="font-size: 15px; font-weight: 800; color: #1e3a8a; margin: 0 0 6px 0; text-transform: uppercase;">
            YOUR ONBOARDING PROCESS HAS OFFICIALLY STARTED!
          </p>
          <p style="font-size: 13px; color: #3b82f6; margin: 0;">
            Hello <strong>${name}</strong>, your employee profile has been created in the IQ Trousers Enterprise System.
          </p>
        </div>

        <h3 style="color: #0f172a; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px 0;">
          1. Profile Details Recorded
        </h3>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #334155;">
          <p style="margin: 3px 0;"><strong>Full Name:</strong> ${name}</p>
          <p style="margin: 3px 0;"><strong>Registered Mobile:</strong> ${mobileNumber}</p>
          <p style="margin: 3px 0;"><strong>Designation / Role:</strong> <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px; font-weight: 700;">${designation}</span></p>
          <p style="margin: 3px 0;"><strong>Residential Address:</strong> ${address}</p>
        </div>

        <h3 style="color: #0f172a; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px 0;">
          2. Assigned System Permissions & Access Status
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
          <tbody>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #475569;">Active Login & Ordering Status</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${isActive ? '#15803d' : '#b91c1c'};">${isActive ? 'Active' : 'Inactive'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #475569;">Team Leader (T.L.) 24*7 Access</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${isTeamLeader ? '#ea580c' : '#64748b'};">${isTeamLeader ? 'Enabled (24*7)' : 'Standard (9 PM IST)'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #475569;">Order Form Editing Access</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${canEditOrders ? '#2563eb' : '#64748b'};">${canEditOrders ? 'Approved' : 'Disabled'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #475569;">Stock Update Page Access</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${canUpdateStock ? '#059669' : '#64748b'};">${canUpdateStock ? 'Enabled' : 'Disabled'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #475569;">Order Form View Access</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${canViewOrderForm ? '#15803d' : '#b91c1c'};">${canViewOrderForm ? 'Allowed' : 'Revoked'}</td>
            </tr>
          </tbody>
        </table>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #92400e;">
          <strong>Next Step:</strong> Document upload (Aadhar / PAN / ID proof) is currently being processed. You will receive an update once uploaded.
        </div>

        <p style="color: #0f172a; font-size: 13px; margin: 20px 0 0 0;">
          Best Regards,<br>
          <strong>IQ Trousers Administration</strong>
        </p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        IQ Trousers Wholesale Operations &bull; Ahmedabad, Gujarat
      </div>
    </div>
  `;

  if (gmailUser && gmailAppPassword) {
    try {
      const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser.trim(), pass: cleanPass },
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS Onboarding" <${gmailUser.trim()}>`,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`✅ Step 1 Onboarding email successfully sent to ${to} (${name})`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to send Step 1 onboarding email:", err.message);
      return { success: false, error: err.message };
    }
  }

  console.log(`\n📋 [EMPLOYEE STEP 1 EMAIL] To: ${to} | Name: ${name} | Designation: ${designation}\n`);
  return { success: true };
}

/**
 * 2. Step 2 Email: Sent when employee verification document is uploaded
 */
export async function sendEmployeeStep2Email({
  to,
  name,
  documentType = "Identity / Address Proof",
}: SendEmployeeStep2Params): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  const subject = `Document Uploaded - Step 2 Complete | IQ Trousers`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
        <h1 style="color: #0f172a; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
        <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Employee Onboarding System &bull; Step 2 of 3</p>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <p style="font-size: 15px; font-weight: 800; color: #166534; margin: 0 0 6px 0; text-transform: uppercase;">
            VERIFICATION DOCUMENT UPLOADED SUCCESSFULLY!
          </p>
          <p style="font-size: 13px; color: #15803d; margin: 0;">
            Hello <strong>${name}</strong>, your verification document (<strong>${documentType}</strong>) has been uploaded and secured in your employee profile.
          </p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 8px 0;"><strong>Verification Status:</strong> <span style="color: #16a34a; font-weight: 700;">Uploaded & Verified</span></p>
          <p style="margin: 0;">Your document has been safely encrypted and attached to your IQ Trousers employment records.</p>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #1e40af;">
          <strong>Final Step:</strong> Account credentials (Username & Temporary Security PIN) are now being finalized by the Administrator. You will receive your official login email shortly.
        </div>

        <p style="color: #0f172a; font-size: 13px; margin: 20px 0 0 0;">
          Best Regards,<br>
          <strong>IQ Trousers Administration</strong>
        </p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        IQ Trousers Wholesale Operations &bull; Ahmedabad, Gujarat
      </div>
    </div>
  `;

  if (gmailUser && gmailAppPassword) {
    try {
      const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser.trim(), pass: cleanPass },
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS Onboarding" <${gmailUser.trim()}>`,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`✅ Step 2 Onboarding email successfully sent to ${to} (${name})`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to send Step 2 onboarding email:", err.message);
      return { success: false, error: err.message };
    }
  }

  console.log(`\n📋 [EMPLOYEE STEP 2 EMAIL] To: ${to} | Name: ${name} | Document Uploaded\n`);
  return { success: true };
}

/**
 * 3. Step 3 Email: Official Credentials Email with Username, Temporary 4-Digit PIN & Permanent PIN instructions
 */
export async function sendEmployeeStep3CredentialsEmail({
  to,
  name,
  username,
  pin,
}: SendEmployeeStep3Params): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const appUrl = process.env.NEXTAUTH_URL || "https://employee.iqtrousers.in";

  const subject = `Your Employee Login Credentials - IQ Trousers Wholesale Portal`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
        <h1 style="color: #0f172a; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
        <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Employee Wholesale Portal &bull; Step 3 Complete</p>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <p style="font-size: 15px; font-weight: 800; color: #166534; margin: 0 0 6px 0; text-transform: uppercase;">
            YOUR ONBOARDING IS COMPLETE!
          </p>
          <p style="font-size: 13px; color: #15803d; margin: 0;">
            Hello <strong>${name}</strong>, your employee portal access is now live. Use the credentials below to sign in:
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${appUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(234,88,12,0.3);">
            Open Employee Wholesale Portal &rarr;
          </a>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin: 0 0 12px 0;">Official Login Credentials</p>
          <div style="margin-bottom: 10px;">
            <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 3px;">Username / Login ID:</span>
            <span style="font-family: monospace; font-size: 16px; font-weight: 700; background: #e2e8f0; padding: 4px 10px; border-radius: 6px; color: #0f172a;">${username}</span>
          </div>
          <div>
            <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 3px;">Temporary 4-Digit Security PIN:</span>
            <span style="font-family: monospace; font-size: 20px; font-weight: 900; letter-spacing: 4px; background: #0f172a; color: #f59e0b; padding: 6px 14px; border-radius: 6px; display: inline-block;">${pin}</span>
          </div>
        </div>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px; margin: 20px 0; font-size: 12px; color: #991b1b; line-height: 1.5;">
          <strong>IMPORTANT SECURITY NOTICE:</strong><br>
          Upon your first login using this temporary PIN, the portal will automatically prompt you to <strong>set your secret permanent 4-digit PIN</strong>. Please choose a PIN that only you know.
        </div>

        <p style="color: #0f172a; font-size: 13px; margin: 20px 0 0 0;">
          Best Regards,<br>
          <strong>Krish Sandip Shah</strong><br>
          <span style="color: #64748b; font-size: 12px;">IQ Trousers Enterprise Operations</span>
        </p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        Direct Portal Link: <a href="${appUrl}" style="color: #ea580c;">${appUrl}</a>
      </div>
    </div>
  `;

  if (gmailUser && gmailAppPassword) {
    try {
      const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser.trim(), pass: cleanPass },
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS Access" <${gmailUser.trim()}>`,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`✅ Step 3 Credentials email successfully sent to ${to} (${username})`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to send Step 3 credentials email:", err.message);
      return { success: false, error: err.message };
    }
  }

  console.log(`\n📋 [EMPLOYEE CREDENTIALS EMAIL] To: ${to} | Username: ${username} | Temporary PIN: ${pin}\n`);
  return { success: true };
}

/**
 * 4. PIN Reset Email: Sent when Admin triggers a PIN reset from the dedicated Reset PIN tab
 */
export async function sendEmployeePinResetEmail({
  to,
  name,
  username,
  newPin,
}: SendEmployeePinResetParams): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const appUrl = process.env.NEXTAUTH_URL || "https://employee.iqtrousers.in";

  const subject = `Your Security PIN Has Been Reset - IQ Trousers Wholesale Portal`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
        <h1 style="color: #0f172a; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
        <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Security PIN Reset Alert</p>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <p style="font-size: 15px; font-weight: 800; color: #92400e; margin: 0 0 6px 0; text-transform: uppercase;">
            SECURITY PIN RESET BY ADMINISTRATOR
          </p>
          <p style="font-size: 13px; color: #78350f; margin: 0;">
            Hello <strong>${name}</strong>, your IQ Trousers employee login PIN has been freshly generated.
          </p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin: 0 0 10px 0;">New Temporary 4-Digit PIN</p>
          <div style="display: inline-block; font-family: monospace; font-size: 28px; font-weight: 900; letter-spacing: 6px; background: #0f172a; color: #f59e0b; padding: 10px 24px; border-radius: 8px;">
            ${newPin}
          </div>
          ${username ? `<p style="color: #64748b; font-size: 12px; margin-top: 12px;">Login Username: <strong>${username}</strong></p>` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${appUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(234,88,12,0.3);">
            Log In Now &rarr;
          </a>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; margin: 16px 0; font-size: 12px; color: #1e40af; line-height: 1.5;">
          <strong>Note:</strong> When you log in with this temporary PIN, you will be required to configure your permanent personal 4-digit PIN before proceeding to orders.
        </div>

        <p style="color: #0f172a; font-size: 13px; margin: 20px 0 0 0;">
          Best Regards,<br>
          <strong>IQ Trousers Administration</strong>
        </p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        IQ Trousers Wholesale Operations &bull; Ahmedabad, Gujarat
      </div>
    </div>
  `;

  if (gmailUser && gmailAppPassword) {
    try {
      const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser.trim(), pass: cleanPass },
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS Security" <${gmailUser.trim()}>`,
        to,
        subject,
        html: htmlContent,
      });

      console.log(`✅ PIN Reset email successfully sent to ${to} (${name})`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to send PIN Reset email:", err.message);
      return { success: false, error: err.message };
    }
  }

  console.log(`\n📋 [PIN RESET EMAIL] To: ${to} | Name: ${name} | New PIN: ${newPin}\n`);
  return { success: true };
}

export interface SendEmployeeOnboardingParams {
  to: string;
  username: string;
  pin: string;
}

/**
 * Dispatches onboarding welcome email to newly created employees with access link and credentials
 */
export async function sendEmployeeOnboardingEmail({
  to,
  username,
  pin,
}: SendEmployeeOnboardingParams): Promise<{ success: boolean; error?: string }> {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const appUrl = process.env.NEXTAUTH_URL || "https://employee.iqtrousers.in";

  const subject = `Your Onboarding is Done - IQ Trousers Order Form Access`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
        <h1 style="color: #0f172a; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">IQ TROUSERS</h1>
        <p style="color: #ea580c; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 4px; letter-spacing: 1.5px;">Employee Onboarding Portal</p>
      </div>

      <div style="margin-bottom: 24px;">
        <p style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.6; text-transform: uppercase; margin: 0 0 16px 0;">
          YOUR ONBOARDING PROCESS IS DONE. USE THIS BELOW LINK TO OPEN THE ORDER FORM WEB APPLICATION.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${appUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(234,88,12,0.3);">
            Open Order Form Web Application &rarr;
          </a>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin: 0 0 10px 0;">Your Employee Login Credentials</p>
          <p style="color: #0f172a; font-size: 15px; margin: 4px 0;"><strong>Username:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${username}</span></p>
          <p style="color: #0f172a; font-size: 15px; margin: 8px 0 0 0;"><strong>PIN:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${pin}</span></p>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Best of luck with your journey ahead.
        </p>

        <p style="color: #0f172a; font-size: 14px; line-height: 1.6; margin: 0;">
          Best Regards,<br>
          <strong>Krish Sandip Shah</strong>
        </p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
        IQ Trousers Wholesale Operations &bull; Ahmedabad, Gujarat<br>
        Direct Web Application URL: <a href="${appUrl}" style="color: #ea580c;">${appUrl}</a>
      </div>
    </div>
  `;

  const textContent = `YOUR ONBOARDING PROCESS IS DONE. USE THIS BELOW LINK TO OPEN THE ORDER FORM WEB APPLICATION.

Order Form Web Application: ${appUrl}

Your Username is ${username} and PIN is ${pin}. Best of luck with your journey ahead.

Best Regards,
Krish Sandip Shah`;

  if (gmailUser && gmailAppPassword) {
    try {
      const cleanPass = gmailAppPassword.replace(/\s+/g, "").trim();
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser.trim(),
          pass: cleanPass,
        },
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS" <${gmailUser.trim()}>`,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`✅ Onboarding email successfully sent to ${to} (${username})`);
      return { success: true };
    } catch (err: any) {
      console.error("Failed to send employee onboarding email via Gmail:", err.message);
      return { success: false, error: err.message };
    }
  }

  console.log(`\n======================================================`);
  console.log(`📋 [EMPLOYEE ONBOARDING DISPATCH]`);
  console.log(`To: ${to}`);
  console.log(`Username: ${username} | PIN: ${pin}`);
  console.log(`Link: ${appUrl}`);
  console.log(`======================================================\n`);

  return { success: true };
}

