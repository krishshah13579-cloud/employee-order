import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
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

    // Upsert or update admin account
    await prisma.adminAccount.upsert({
      where: { username },
      update: {
        password,
        twoFactorEnabled: true,
        lastOtp: null,
        otpExpiresAt: null,
      },
      create: {
        username,
        password,
        twoFactorSecret: (body.twoFactorSecret || Math.floor(100000 + Math.random() * 900000).toString()).trim(),
        twoFactorEnabled: true,
      },
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
