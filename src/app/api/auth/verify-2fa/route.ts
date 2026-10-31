import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkOtpRateLimit, recordFailedOtpAttempt, resetOtpAttempts, signToken } from "@/lib/auth-security";
import {
  signDeviceToken,
  DEVICE_AUTH_COOKIE,
  ALT_DEVICE_AUTH_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
} from "@/lib/device-gate";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const { username, code } = await req.json();

    if (!username || !code) {
      return NextResponse.json(
        { error: "Username and 2FA code are required." },
        { status: 400 }
      );
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    // Rate Limit / Brute-force protection
    const rateCheck = checkOtpRateLimit(cleanUser);
    if (!rateCheck.allowed) {
      await recordAuditLog({
        action: "AUTH_2FA_LOCKED",
        actorType: "ADMIN",
        actorName: cleanUser,
        entityType: "AdminAccount",
        details: rateCheck.error,
        ipAddress: ip,
        status: "BLOCKED",
      });
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUser },
    });

    if (!admin) {
      return NextResponse.json({ error: "Administrator account not found." }, { status: 404 });
    }

    const isTestAccount = cleanUser === "testuser@iqtrousers.com";

    // STRICT VALIDATION: Code must match the fresh 6-digit OTP sent to email (or static 123456 for test user)
    const isOtpMatch =
      (isTestAccount && cleanCode === "123456") ||
      (Boolean(admin.lastOtp) &&
        admin.lastOtp === cleanCode &&
        (!admin.otpExpiresAt || new Date() <= admin.otpExpiresAt));

    if (!isOtpMatch) {
      recordFailedOtpAttempt(cleanUser);
      await recordAuditLog({
        action: "AUTH_2FA_FAILED",
        actorType: "ADMIN",
        actorName: cleanUser,
        entityType: "AdminAccount",
        entityId: admin.id,
        details: "Invalid or expired 2FA code entered",
        ipAddress: ip,
        status: "FAILURE",
      });
      return NextResponse.json(
        {
          error: "Invalid or expired 2FA code. Please enter the 6-digit code sent to your email.",
        },
        { status: 401 }
      );
    }

    // Reset failed attempts on success
    resetOtpAttempts(cleanUser);

    // Clear one-time OTP so it cannot be reused
    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        lastOtp: null,
        otpExpiresAt: null,
      },
    });

    await recordAuditLog({
      action: "AUTH_2FA_SUCCESS",
      actorType: "ADMIN",
      actorName: cleanUser,
      entityType: "AdminAccount",
      entityId: admin.id,
      details: "2FA successfully verified; authenticated session token issued",
      ipAddress: ip,
      status: "SUCCESS",
    });

    // Generate Cryptographically Signed Session Token (HMAC-SHA256)
    const sessionToken = signToken({
      id: admin.id,
      username: admin.username,
      authenticatedAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      username: admin.username,
      message: "2FA Verification successful! Welcome to IQ TROUSERS Admin.",
    });

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    // Set secure HTTP-only cookie for session (matches transport security)
    response.cookies.set({
      name: "iq_admin_session",
      value: sessionToken,
      httpOnly: true,
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    // Automatically authorize this admin terminal for 365 Days
    try {
      const deviceToken = await signDeviceToken({
        deviceId: `dev_admin_${admin.id}_${Date.now()}`,
        role: "SUPER_ADMIN",
        employeeName: admin.username,
      });
      const devOpts = {
        httpOnly: true,
        secure: isHttps,
        path: "/",
        maxAge: DEVICE_COOKIE_MAX_AGE,
        sameSite: "lax" as const,
      };
      response.cookies.set(DEVICE_AUTH_COOKIE, deviceToken, devOpts);
      response.cookies.set(ALT_DEVICE_AUTH_COOKIE, deviceToken, devOpts);
    } catch (devErr) {
      console.warn("Failed to set admin device gate cookie:", devErr);
    }

    return response;
  } catch (error: any) {
    console.error("2FA Verification error:", error);
    return NextResponse.json(
      { error: "2FA verification failed: " + error.message },
      { status: 500 }
    );
  }
}
