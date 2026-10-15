import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
    // 1. Matches configured twoFactorSecret in DB (e.g. 135790)
    // 2. OR matches lastOtp stored in DB within validity
    // 3. OR matches master PIN 135790
    const isSecretMatch = admin.twoFactorSecret && admin.twoFactorSecret === cleanCode;
    const isMasterPin = cleanCode === "135790";
    const isOtpMatch =
      admin.lastOtp &&
      admin.lastOtp === cleanCode &&
      (!admin.otpExpiresAt || new Date() <= admin.otpExpiresAt);

    if (!isSecretMatch && !isOtpMatch && !isMasterPin) {
      return NextResponse.json(
        { error: "Invalid or expired 2FA code. Please check your email or enter your master PIN." },
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

    // Generate Unlock Token valid for 15 minutes
    const tokenPayload = {
      adminId: admin.id,
      action: "unlock_profile_edit",
      timestamp: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    const unlockToken = Buffer.from(JSON.stringify(tokenPayload)).toString("base64");

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
