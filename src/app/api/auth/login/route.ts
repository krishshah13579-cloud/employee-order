import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check if database currently has zero admin accounts
    const adminCount = await prisma.adminAccount.count();
    if (adminCount === 0) {
      // Auto-initialize default Master Admin account
      await prisma.adminAccount.create({
        data: {
          username: "krishshah13579@gmail.com",
          password: "Krish@2000",
          twoFactorSecret: "135790",
          twoFactorEnabled: true,
        },
      });

      const profileCount = await prisma.adminProfile.count();
      if (profileCount === 0) {
        await prisma.adminProfile.create({
          data: {
            fullName: "Krish Shah",
            email: "krishshah13579@gmail.com",
            companyName: "IQ TROUSERS",
          },
        });
      }
    }

    // Try finding the admin by exact username
    let admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUser },
    });

    // If master credentials are entered (krishshah13579@gmail.com + Krish@2000),
    // ensure it is accepted and synchronized
    if (cleanUser === "krishshah13579@gmail.com" && cleanPass === "Krish@2000") {
      if (!admin) {
        // Upsert master admin
        admin = await prisma.adminAccount.upsert({
          where: { username: cleanUser },
          update: {
            password: cleanPass,
            twoFactorSecret: "135790",
            twoFactorEnabled: true,
          },
          create: {
            username: cleanUser,
            password: cleanPass,
            twoFactorSecret: "135790",
            twoFactorEnabled: true,
          },
        });
      }
    }

    // If still not found by username, check if there's only 1 admin account in DB
    if (!admin) {
      const allAdmins = await prisma.adminAccount.findMany();
      if (allAdmins.length === 1 && (allAdmins[0].password === cleanPass || allAdmins[0].password.trim() === cleanPass)) {
        admin = allAdmins[0];
      }
    }

    if (!admin || admin.password.trim() !== cleanPass) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Generate fresh 6-digit 2FA code and store in Database
    // Also accepts the configured twoFactorSecret (e.g. 135790)
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        lastOtp: generatedOtp,
        otpExpiresAt: expiry,
      },
    });

    return NextResponse.json({
      requires2FA: true,
      username: admin.username,
      message: "Credentials verified. Please enter your 6-digit 2FA Security Code.",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed: " + error.message },
      { status: 500 }
    );
  }
}
