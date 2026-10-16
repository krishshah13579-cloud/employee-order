import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    const cleanUser = (username || "").trim().toLowerCase();

    // STRICT ACCESS CONTROL
    if (cleanUser !== "krishshah13579@gmail.com") {
      return NextResponse.json(
        { error: "Access Denied: Only krishshah13579@gmail.com is authorized." },
        { status: 403 }
      );
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

    // Send real OTP email to krishshah13579@gmail.com via Gmail SMTP
    await sendOtpEmail("krishshah13579@gmail.com", generatedOtp, "Krish Shah");

    return NextResponse.json({
      success: true,
      message: "A fresh 6-digit 2FA login code has been emailed to krishshah13579@gmail.com.",
    });
  } catch (error: any) {
    console.error("Resend OTP error:", error);
    return NextResponse.json(
      { error: "Failed to resend 2FA code: " + error.message },
      { status: 500 }
    );
  }
}
