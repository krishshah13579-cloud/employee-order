/**
 * Utility to send 2FA OTP security emails.
 * Supports Resend API (if RESEND_API_KEY is present) or logs safely to server.
 */
export async function sendOtpEmail(toEmail: string, otpCode: string, adminName: string = "Administrator") {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "IQ TROUSERS Security <onboarding@resend.dev>";

  console.log(`\n======================================================`);
  console.log(`🔐 [2FA SECURITY EMAIL OTP]`);
  console.log(`Recipient: ${toEmail}`);
  console.log(`OTP Code : ${otpCode}`);
  console.log(`Time     : ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `🔐 Your 2FA Security Code to Edit Admin Details: ${otpCode}`,
          html: `
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
          `,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Resend API response error:", errorData);
      } else {
        console.log("✅ 2FA OTP email successfully dispatched via Resend to", toEmail);
      }
    } catch (err) {
      console.error("Failed to dispatch email via Resend:", err);
    }
  }

  return true;
}
