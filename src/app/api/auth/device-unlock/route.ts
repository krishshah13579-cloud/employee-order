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
    let authRole: "SUPER_ADMIN" | "TEAM_LEADER" | "EMPLOYEE" = "SUPER_ADMIN";
    let adminName = "Super Admin";
    let employeeId: number | undefined = undefined;
    let redirectUrl = "/admin/login";

    // 1. Check Master Device Passkey
    if (isValidMasterKey(masterKey)) {
      isAuthorized = true;
      authRole = "SUPER_ADMIN";
      adminName = "Super Admin";
      redirectUrl = "/admin/login";
    } else if (masterKey) {
      // 2. Check if masterKey is an Employee WhatsApp Single-Use Invite Code
      const invite = await prisma.deviceAccessInvite.findUnique({
        where: { inviteCode: masterKey },
      });

      if (invite) {
        if (invite.isUsed) {
          return NextResponse.json(
            { error: "This authorization code has already been used on another device." },
            { status: 410 }
          );
        }
        if (new Date() > invite.expiresAt) {
          return NextResponse.json(
            { error: "This authorization code has expired. Please ask for a new link." },
            { status: 410 }
          );
        }

        // Mark invite as used
        await prisma.deviceAccessInvite.update({
          where: { id: invite.id },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });

        isAuthorized = true;
        authRole = invite.role as any;
        adminName = invite.employeeName || "Employee";
        employeeId = invite.employeeId || undefined;
        redirectUrl = invite.role === "SUPER_ADMIN" ? "/admin/login" : "/login";
      }
    }

    if (!isAuthorized && username && password) {
      // 3. Fallback: Check Admin Account Credentials from Database
      const admin = await prisma.adminAccount.findUnique({
        where: { username },
      });
      if (admin && verifyPassword(password, admin.password)) {
        isAuthorized = true;
        adminName = admin.username;
        authRole = "SUPER_ADMIN";
        redirectUrl = "/admin/login";
      }
    }

    if (!isAuthorized) {
      await recordAuditLog({
        action: "DEVICE_UNLOCK_FAILED",
        actorType: "SYSTEM",
        actorName: username || "Unknown",
        details: `Invalid passkey or activation code attempted from IP: ${ip}`,
        ipAddress: ip,
        status: "FAILURE",
      });

      return NextResponse.json(
        { error: "Invalid Passkey or Authorization Code." },
        { status: 401 }
      );
    }

    // Generate unique device ID
    const deviceId = authRole === "SUPER_ADMIN"
      ? `dev_admin_${generateRandomCode(16)}`
      : `dev_emp_${generateRandomCode(16)}`;

    // Store in AuthorizedDevice table
    try {
      await prisma.authorizedDevice.create({
        data: {
          deviceId,
          name: deviceName,
          role: authRole,
          employeeId,
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
      employeeId,
      employeeName: adminName,
    });

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    const response = NextResponse.json({
      success: true,
      message: `Device successfully authorized for ${adminName} (365 days).`,
      deviceId,
      redirectUrl,
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
