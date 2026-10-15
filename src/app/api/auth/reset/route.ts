import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // STRICT ACCESS CONTROL: Only krishshah13579@gmail.com is permitted
    const username = "krishshah13579@gmail.com";
    const password = (body.password || "Krish@2000").trim();
    const fullName = (body.fullName || "Krish Shah").trim();
    const companyName = (body.companyName || "IQ TROUSERS").trim();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required for reset." },
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
    const adminRecord = await prisma.adminAccount.upsert({
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

    // Also ensure AdminProfile exists or updated
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

    return NextResponse.json({
      success: true,
      message: "Admin credentials successfully reset for krishshah13579@gmail.com!",
      credentials: {
        username: adminRecord.username,
        password: adminRecord.password,
      },
    });
  } catch (error: any) {
    console.error("Admin reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset admin credentials: " + error.message },
      { status: 500 }
    );
  }
}
