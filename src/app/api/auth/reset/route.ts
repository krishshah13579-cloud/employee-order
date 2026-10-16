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
    const username = "krishshah13579@gmail.com";
    const password = (body.password || "").trim();
    const fullName = (body.fullName || "Krish Shah").trim();
    const companyName = (body.companyName || "IQ TROUSERS").trim();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // Purge any unauthorized admin accounts
    try {
      await prisma.adminAccount.deleteMany({
        where: { username: { not: "krishshah13579@gmail.com" } },
      });
    } catch {}

    // Upsert or update master admin account
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
        twoFactorSecret: "135790",
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
      message: "Admin credentials successfully reset for krishshah13579@gmail.com!",
    });
  } catch (error: any) {
    console.error("Admin reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset admin credentials: " + error.message },
      { status: 500 }
    );
  }
}
