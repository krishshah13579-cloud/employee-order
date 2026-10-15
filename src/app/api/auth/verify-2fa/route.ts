import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username, code } = await req.json();

    if (!username || !code) {
      return NextResponse.json(
        { error: "Username and 2FA code are required." },
        { status: 400 }
      );
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    // STRICT ACCESS CONTROL: Only krishshah13579@gmail.com is authorized
    if (cleanUser !== "krishshah13579@gmail.com") {
      return NextResponse.json(
        {
          error:
            "Access Denied: Only krishshah13579@gmail.com is authorized to access the Admin Panel.",
        },
        { status: 403 }
      );
    }

    const admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUser },
    });

    if (!admin) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // STRICT VALIDATION: Code must match the fresh 6-digit OTP sent to email
    const isOtpMatch =
      admin.lastOtp &&
      admin.lastOtp === cleanCode &&
      (!admin.otpExpiresAt || new Date() <= admin.otpExpiresAt);

    if (!isOtpMatch) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired 2FA code. Please enter the 6-digit code sent to krishshah13579@gmail.com.",
        },
        { status: 401 }
      );
    }

    // Clear one-time OTP so it cannot be reused
    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        lastOtp: null,
        otpExpiresAt: null,
      },
    });

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
      httpOnly: false,
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
