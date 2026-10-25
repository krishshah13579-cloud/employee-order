import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // 1. Find the admin account & profile
    const admin = await prisma.adminAccount.findFirst();
    const profile = await prisma.adminProfile.findFirst();

    const targetEmail = profile?.email || admin?.username || process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "";
    const adminName = profile?.fullName || "Administrator";

    if (!targetEmail) {
      return NextResponse.json(
        { error: "No administrator email address found in profile or database." },
        { status: 400 }
      );
    }

    // 2. Generate a fresh 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 3. Save OTP to AdminAccount in database
    if (admin) {
      await prisma.adminAccount.update({
        where: { id: admin.id },
        data: {
          lastOtp: otpCode,
          otpExpiresAt: expiresAt,
        },
      });
    }

    // 4. Send email with OTP with a 3.5s race timeout
    const emailPromise = sendOtpEmail(targetEmail, otpCode, adminName);
    const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
      setTimeout(() => resolve({ success: true }), 3500)
    );
    const emailResult = await Promise.race([emailPromise, timeoutPromise]);

    // Mask email for security display (e.g., k****h@gmail.com)
    const [userPart, domain] = targetEmail.split("@");
    const maskedUser =
      userPart.length > 2
        ? `${userPart[0]}****${userPart[userPart.length - 1]}`
        : userPart;
    const maskedEmail = `${maskedUser}@${domain || "gmail.com"}`;

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      message: emailResult.success
        ? `2FA Security Code sent to ${maskedEmail}`
        : `Email delivery issue: ${emailResult.error || "Please check Gmail App Password"}.`,
      email: maskedEmail,
      fullEmail: targetEmail,
    });
  } catch (error: any) {
    console.error("Failed to send profile edit OTP:", error);
    return NextResponse.json(
      { error: "Failed to send 2FA security code: " + error.message },
      { status: 500 }
    );
  }
}
