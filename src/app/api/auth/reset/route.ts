import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || "krishshah13579@gmail.com").trim().toLowerCase();
    const password = (body.password || "Krish@2000").trim();
    const twoFactorSecret = (body.twoFactorSecret || "135790").trim();
    const fullName = (body.fullName || "Krish Shah").trim();
    const companyName = (body.companyName || "IQ TROUSERS").trim();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required for reset." },
        { status: 400 }
      );
    }

    // Upsert or update existing admin account
    const existingAdmins = await prisma.adminAccount.findMany();

    let adminRecord;
    if (existingAdmins.length > 0) {
      // Update the first admin account
      adminRecord = await prisma.adminAccount.update({
        where: { id: existingAdmins[0].id },
        data: {
          username,
          password,
          twoFactorSecret,
          twoFactorEnabled: true,
          lastOtp: null,
          otpExpiresAt: null,
        },
      });
    } else {
      // Create fresh admin account
      adminRecord = await prisma.adminAccount.create({
        data: {
          username,
          password,
          twoFactorSecret,
          twoFactorEnabled: true,
        },
      });
    }

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
      message: "Admin credentials successfully reset and active in database!",
      credentials: {
        username: adminRecord.username,
        password: adminRecord.password,
        twoFactorPin: adminRecord.twoFactorSecret,
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
