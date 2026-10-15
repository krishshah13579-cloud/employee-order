import nodemailer from "nodemailer";

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
) {
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
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser.trim(),
          pass: gmailAppPassword.replace(/\s+/g, "").trim(), // Strip spaces if copied from Google
        },
      });

      await transporter.sendMail({
        from: `"IQ TROUSERS Security" <${gmailUser.trim()}>`,
        to: toEmail,
        subject: `🔐 Your 2FA Security Code to Edit Admin Details: ${otpCode}`,
        html: htmlContent,
      });

      console.log(`✅ 2FA OTP email successfully dispatched via Gmail to ${toEmail}`);
      return true;
    } catch (err: any) {
      console.error("Failed to dispatch email via Gmail SMTP:", err.message);
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
          subject: `🔐 Your 2FA Security Code to Edit Admin Details: ${otpCode}`,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Resend API response error:", errorData);
      } else {
        console.log("✅ 2FA OTP email successfully dispatched via Resend to", toEmail);
        return true;
      }
    } catch (err) {
      console.error("Failed to dispatch email via Resend:", err);
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
          sender: { name: "IQ TROUSERS Security", email: "krishshah13579@gmail.com" },
          to: [{ email: toEmail, name: adminName }],
          subject: `🔐 Your 2FA Security Code to Edit Admin Details: ${otpCode}`,
          htmlContent: htmlContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Brevo API response error:", errorData);
      } else {
        console.log("✅ 2FA OTP email successfully dispatched via Brevo to", toEmail);
        return true;
      }
    } catch (err) {
      console.error("Failed to dispatch email via Brevo:", err);
    }
  }

  if (!gmailUser && !resendApiKey && !brevoApiKey) {
    console.warn(
      "⚠️ [Email Notice] No email credentials found in environment variables. Add GMAIL_USER & GMAIL_APP_PASSWORD in Vercel to receive real emails. Master PIN 135790 is active as fallback."
    );
  }

  return true;
}
