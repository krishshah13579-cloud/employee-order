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
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const body = await req.json();
    const inviteKey = (body.key || "").trim();
    const masterKey = (body.masterKey || "").trim();
    const deviceName = (body.deviceName || "").trim() || "Mobile Device";

    // Scenario A: Super Admin Master Key
    if (masterKey && isValidMasterKey(masterKey)) {
      const deviceId = `dev_master_${generateRandomCode(16)}`;

      await prisma.authorizedDevice.create({
        data: {
          deviceId,
          name: deviceName || "Super Admin Terminal",
          role: "SUPER_ADMIN",
          employeeName: "Super Admin",
          userAgent,
          ipAddress: ip,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });

      const token = await signDeviceToken({
        deviceId,
        role: "SUPER_ADMIN",
        employeeName: "Super Admin",
      });

      const isHttps =
        req.headers.get("x-forwarded-proto") === "https" ||
        req.nextUrl.protocol === "https:";

      const response = NextResponse.json({
        success: true,
        role: "SUPER_ADMIN",
        redirectUrl: "/admin/login",
        message: "Super Admin terminal verified and authorized for 365 days.",
      });

      const cookieOptions = {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax" as const,
        path: "/",
        maxAge: DEVICE_COOKIE_MAX_AGE,
      };

      response.cookies.set(DEVICE_AUTH_COOKIE, token, cookieOptions);
      response.cookies.set(ALT_DEVICE_AUTH_COOKIE, token, cookieOptions);

      await recordAuditLog({
        action: "DEVICE_MASTER_UNLOCKED",
        actorType: "ADMIN",
        actorName: "Super Admin",
        details: `Master passkey unlocked terminal (${deviceId}) from IP: ${ip}`,
        ipAddress: ip,
        status: "SUCCESS",
      });

      return response;
    }

    // Scenario B: Employee One-Time Invite Token
    if (!inviteKey) {
      return NextResponse.json(
        { error: "Authorization key is required." },
        { status: 400 }
      );
    }

    const invite = await prisma.deviceAccessInvite.findUnique({
      where: { inviteCode: inviteKey },
    });

    if (!invite) {
      await recordAuditLog({
        action: "DEVICE_INVITE_INVALID",
        actorType: "SYSTEM",
        actorName: "Unknown",
        details: `Non-existent device invite key attempted: ${inviteKey}`,
        ipAddress: ip,
        status: "FAILURE",
      });

      return NextResponse.json(
        { error: "Invalid or expired authorization link. Please request a new link from your company administrator." },
        { status: 404 }
      );
    }

    if (invite.isUsed) {
      return NextResponse.json(
        {
          error: "This authorization link has already been used on another device. For security, authorization links can only be activated once. Please request a new link from your administrator.",
        },
        { status: 410 }
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        {
          error: "This authorization link has expired. Please ask the administrator to send a fresh link.",
        },
        { status: 410 }
      );
    }

    // Mark invite as used & record device
    const deviceId = `dev_emp_${generateRandomCode(16)}`;

    await prisma.$transaction([
      prisma.deviceAccessInvite.update({
        where: { id: invite.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          usedDeviceId: deviceId,
        },
      }),
      prisma.authorizedDevice.create({
        data: {
          deviceId,
          name: `${invite.employeeName || "Employee"} Phone (${deviceName})`,
          role: invite.role as any,
          employeeId: invite.employeeId,
          employeeName: invite.employeeName,
          userAgent,
          ipAddress: ip,
          isActive: true,
          lastUsedAt: new Date(),
        },
      }),
    ]);

    const token = await signDeviceToken({
      deviceId,
      role: invite.role as any,
      employeeId: invite.employeeId || undefined,
      employeeName: invite.employeeName || undefined,
    });

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    const response = NextResponse.json({
      success: true,
      role: invite.role,
      employeeName: invite.employeeName,
      redirectUrl: "/login",
      message: `Device successfully authorized for ${invite.employeeName || "Employee"}! Redirecting to login...`,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax" as const,
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    };

    response.cookies.set(DEVICE_AUTH_COOKIE, token, cookieOptions);
    response.cookies.set(ALT_DEVICE_AUTH_COOKIE, token, cookieOptions);

    await recordAuditLog({
      action: "DEVICE_INVITE_ACTIVATED",
      actorType: "EMPLOYEE",
      actorName: invite.employeeName || "Employee",
      entityType: "AuthorizedDevice",
      details: `Employee activated device (${deviceId}) using single-use WhatsApp link`,
      ipAddress: ip,
      status: "SUCCESS",
    });

    return response;
  } catch (error: any) {
    console.error("Device verify error:", error);
    return NextResponse.json(
      { error: "Device authorization failed: " + error.message },
      { status: 500 }
    );
  }
}
