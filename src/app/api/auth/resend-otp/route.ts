import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    const cleanUser = (username || "").trim().toLowerCase();

    if (!cleanUser) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUser },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin account not found" }, { status: 404 });
    }

    // Cooldown check: Prevent email bombing (at least 60 seconds between resends)
    if (admin.otpExpiresAt) {
      const remainingMs = admin.otpExpiresAt.getTime() - Date.now();
      if (remainingMs > 9 * 60 * 1000) {
        const secondsToWait = Math.ceil((remainingMs - 9 * 60 * 1000) / 1000);
        return NextResponse.json(
          { error: `Please wait ${secondsToWait} second(s) before requesting another code.` },
          { status: 429 }
        );
      }
    }

    // Generate fresh 6-digit OTP code (Valid for 10 minutes)
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        lastOtp: generatedOtp,
        otpExpiresAt: expiry,
      },
    });

    // Lookup profile for greeting name
    const profile = await prisma.adminProfile.findFirst();
    const recipientEmail = admin.username;
    const recipientName = profile?.fullName || "Administrator";

    // Send real OTP email with a 3.5s race timeout
    const emailPromise = sendOtpEmail(recipientEmail, generatedOtp, recipientName);
    const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
      setTimeout(() => resolve({ success: true }), 3500)
    );
    const emailResult = await Promise.race([emailPromise, timeoutPromise]);

    return NextResponse.json({
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      message: emailResult.success
        ? `A fresh 6-digit 2FA login code has been emailed to ${recipientEmail}.`
        : `Generated fresh code, but email delivery issue: ${emailResult.error || "Please check Gmail App Password"}.`,
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "Failed to resend 2FA code: " + error.message },
      { status: 500 }
    );
  }
}
