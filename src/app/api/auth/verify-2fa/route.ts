import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username, code } = await req.json();

    if (!username || !code) {
      return NextResponse.json(
        { error: "Username and 2FA code are required" },
        { status: 400 }
      );
    }

    const cleanCode = code.toString().trim();

    const admin = await prisma.adminAccount.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (!admin) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
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
        { error: "Invalid or expired 2FA code. Please check and try again." },
        { status: 401 }
      );
    }

    // Generate Session Token
    const sessionToken = Buffer.from(
      JSON.stringify({
        id: admin.id,
        username: admin.username,
        authenticatedAt: Date.now(),
      })
    ).toString("base64");

    const response = NextResponse.json({
      success: true,
      username: admin.username,
      message: "2FA Verification successful! Welcome to IQ TROUSERS Admin.",
    });

    // Set HTTP cookie for session
    response.cookies.set({
      name: "iq_admin_session",
      value: sessionToken,
      httpOnly: false, // Accessible to client-side auth state checks
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("2FA Verification error:", error);
    return NextResponse.json(
      { error: "2FA verification failed: " + error.message },
      { status: 500 }
    );
  }
}
