import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth-security";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "2FA Security code is required." },
        { status: 400 }
      );
    }

    const cleanCode = code.toString().trim();
    const admin = await prisma.adminAccount.findFirst();

    if (!admin) {
      return NextResponse.json(
        { error: "Admin account not found in database." },
        { status: 404 }
      );
    }

    // Check code against Database:
    // 1. Matches generated lastOtp stored in DB within validity
    // 2. OR matches configured twoFactorSecret in DB
    const isOtpMatch =
      admin.lastOtp &&
      admin.lastOtp === cleanCode &&
      (!admin.otpExpiresAt || new Date() <= admin.otpExpiresAt);
    const isSecretMatch = admin.twoFactorSecret && admin.twoFactorSecret === cleanCode;

    if (!isOtpMatch && !isSecretMatch) {
      return NextResponse.json(
        { error: "Invalid or expired 2FA code. Please check the 6-digit code sent to your email." },
        { status: 401 }
      );
    }

    // Clear one-time OTP so it cannot be reused
    if (admin.lastOtp) {
      await prisma.adminAccount.update({
        where: { id: admin.id },
        data: { lastOtp: null, otpExpiresAt: null },
      });
    }

    // Generate HMAC-signed Unlock Token valid for 15 minutes
    const tokenPayload = {
      adminId: admin.id,
      action: "unlock_profile_edit",
      timestamp: Date.now(),
    };

    const unlockToken = signToken(tokenPayload, 15 * 60);

    return NextResponse.json({
      success: true,
      unlockToken,
      message: "2FA Authentication successful! Admin Details are now unlocked for editing.",
    });
  } catch (error: any) {
    console.error("Error verifying profile edit OTP:", error);
    return NextResponse.json(
      { error: "Verification failed: " + error.message },
      { status: 500 }
    );
  }
}
