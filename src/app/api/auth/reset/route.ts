import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    // Security check: Emergency reset is restricted and requires the recovery secret key
    const recoveryKey = req.headers.get("x-admin-recovery-key") || "";
    const expectedKey =
      process.env.ADMIN_RECOVERY_KEY ||
      process.env.SESSION_SECRET ||
      process.env.ADMIN_2FA_SECRET;

    if (!expectedKey || recoveryKey !== expectedKey) {
      return NextResponse.json(
        { error: "Forbidden: Invalid or missing administrator recovery authorization key." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    let username = (body.username || "").trim().toLowerCase();
    const password = (body.password || "").trim();
    const fullName = (body.fullName || "Administrator").trim();
    const companyName = (body.companyName || "IQ TROUSERS").trim();

    if (!username) {
      const existingAdmin = await prisma.adminAccount.findFirst();
      if (existingAdmin) {
        username = existingAdmin.username;
      } else {
        return NextResponse.json(
          { error: "Username is required." },
          { status: 400 }
        );
      }
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    // Upsert or update admin account with cryptographically hashed password
    await prisma.adminAccount.upsert({
      where: { username },
      update: {
        password: hashedPassword,
        twoFactorEnabled: true,
        lastOtp: null,
        otpExpiresAt: null,
      },
      create: {
        username,
        password: hashedPassword,
        twoFactorSecret: (body.twoFactorSecret || Math.floor(100000 + Math.random() * 900000).toString()).trim(),
        twoFactorEnabled: true,
      },
    });

    await recordAuditLog({
      action: "AUTH_CREDENTIALS_RESET",
      actorType: "ADMIN",
      actorName: username,
      entityType: "AdminAccount",
      details: "Administrator password securely reset with cryptographic scrypt hash",
      ipAddress: ip,
      status: "SUCCESS",
    });

    const existingProfile = await prisma.adminProfile.findFirst();
    if (existingProfile) {
      await prisma.adminProfile.update({
        where: { id: existingProfile.id },
        data: {
          fullName,
          email: username,
          companyName,
        },
      });
    } else {
      await prisma.adminProfile.create({
        data: {
          fullName,
          email: username,
          companyName,
        },
      });
    }

    // Do NOT return the password in response
    return NextResponse.json({
      success: true,
      message: `Admin credentials successfully reset for ${username}!`,
    });
  } catch (error: any) {
    console.error("Admin reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset admin credentials: " + error.message },
      { status: 500 }
    );
  }
}
