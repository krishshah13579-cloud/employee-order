import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

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

    // STRICT ACCESS CONTROL: Only krishshah13579@gmail.com is authorized.
    // Reject any other email like krishclothingco3@gmail.com immediately.
    if (cleanUser !== "krishshah13579@gmail.com") {
      return NextResponse.json(
        {
          error:
            "Access Denied: Only krishshah13579@gmail.com is authorized to access the Admin Panel.",
        },
        { status: 403 }
      );
    }

    // Automatically purge any unauthorized admin accounts that may have been created
    try {
      await prisma.adminAccount.deleteMany({
        where: {
          username: {
            not: "krishshah13579@gmail.com",
          },
        },
      });
    } catch (e) {
      // Continue even if purge encounters a minor issue
    }

    // Check if master admin exists in database, or initialize it
    let admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUser },
    });

    if (!admin) {
      admin = await prisma.adminAccount.create({
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

    // Verify password
    if (admin.password.trim() !== cleanPass) {
      return NextResponse.json(
        { error: "Invalid password. Please check your credentials." },
        { status: 401 }
      );
    }

    // Generate fresh 6-digit OTP code (Valid for 10 minutes)
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to database
    await prisma.adminAccount.update({
      where: { id: admin.id },
      data: {
        lastOtp: generatedOtp,
        otpExpiresAt: expiry,
      },
    });

    // Send real OTP email to krishshah13579@gmail.com via Gmail SMTP
    await sendOtpEmail("krishshah13579@gmail.com", generatedOtp, "Krish Shah");

    return NextResponse.json({
      requires2FA: true,
      username: admin.username,
      email: "krishshah13579@gmail.com",
      message:
        "Credentials verified! A 6-digit 2FA login code has been sent to your email (krishshah13579@gmail.com).",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed: " + error.message },
      { status: 500 }
    );
  }
}
