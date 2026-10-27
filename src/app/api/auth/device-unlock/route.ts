import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  signDeviceToken,
  isValidMasterKey,
  generateRandomCode,
  DEVICE_AUTH_COOKIE,
  ALT_DEVICE_AUTH_COOKIE,
  DEVICE_COOKIE_MAX_AGE,
} from "@/lib/device-gate";
import { verifyPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const body = await req.json();
    const masterKey = (body.masterKey || "").trim();
    const deviceName = (body.deviceName || "").trim() || "Admin Device";
    const username = (body.username || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    let isAuthorized = false;
    let authRole: "SUPER_ADMIN" = "SUPER_ADMIN";
    let adminName = "Super Admin";

    // 1. Check Master Device Passkey
    if (isValidMasterKey(masterKey)) {
      isAuthorized = true;
    } else if (username && password) {
      // 2. Fallback: Check Admin Account Credentials from Database
      const admin = await prisma.adminAccount.findUnique({
        where: { username },
      });
      if (admin && verifyPassword(password, admin.password)) {
        isAuthorized = true;
        adminName = admin.username;
      }
    }

    if (!isAuthorized) {
      await recordAuditLog({
        action: "DEVICE_UNLOCK_FAILED",
        actorType: "ADMIN",
        actorName: username || "Unknown",
        details: `Invalid master passkey or admin credentials attempted from IP: ${ip}`,
        ipAddress: ip,
        status: "FAILURE",
      });

      return NextResponse.json(
        { error: "Invalid Super Admin Master Passkey or credentials." },
        { status: 401 }
      );
    }

    // Generate unique device ID
    const deviceId = `dev_admin_${generateRandomCode(16)}`;

    // Store in AuthorizedDevice table
    try {
      await prisma.authorizedDevice.create({
        data: {
          deviceId,
          name: deviceName,
          role: authRole,
          employeeName: adminName,
          userAgent,
          ipAddress: ip,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.warn("Failed to insert authorized device record in DB, proceeding with token:", dbErr);
    }

    // Cryptographically sign token for 365 Days
    const deviceToken = await signDeviceToken({
      deviceId,
      role: authRole,
      employeeName: adminName,
    });

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    const response = NextResponse.json({
      success: true,
      message: "Device successfully authorized for 365 days.",
      deviceId,
      redirectUrl: "/admin/login",
    });

    // Set 365-day cookie on both primary and fallback cookie names
    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax" as const,
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    };

    response.cookies.set(DEVICE_AUTH_COOKIE, deviceToken, cookieOptions);
    response.cookies.set(ALT_DEVICE_AUTH_COOKIE, deviceToken, cookieOptions);

    await recordAuditLog({
      action: "DEVICE_UNLOCK_SUCCESS",
      actorType: "ADMIN",
      actorName: adminName,
      details: `New device permanently authorized (${deviceName}) with deviceId ${deviceId}`,
      ipAddress: ip,
      status: "SUCCESS",
    });

    return response;
  } catch (error: any) {
    console.error("Device unlock error:", error);
    return NextResponse.json(
      { error: "Failed to unlock device: " + error.message },
      { status: 500 }
    );
  }
}
