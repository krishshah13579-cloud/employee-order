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

    // Find admin account from database
    const admin = await prisma.adminAccount.findUnique({
      where: { username: cleanUser },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid administrator email or password." },
        { status: 401 }
      );
    }

    // Verify password against stored password in database
    if (admin.password.trim() !== cleanPass) {
      return NextResponse.json(
        { error: "Invalid administrator email or password." },
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

    // Lookup Admin Profile for greeting name and contact info
    const profile = await prisma.adminProfile.findFirst();
    const recipientEmail = admin.username;
    const recipientName = profile?.fullName || "Administrator";

    // Send real OTP email to the admin email stored in database
    await sendOtpEmail(recipientEmail, generatedOtp, recipientName);

    // Mask email for UI display
    const [userPart, domain] = recipientEmail.split("@");
    const maskedUser =
      userPart && userPart.length > 2
        ? `${userPart[0]}****${userPart[userPart.length - 1]}`
        : userPart;
    const maskedEmail = domain ? `${maskedUser}@${domain}` : recipientEmail;

    return NextResponse.json({
      requires2FA: true,
      username: admin.username,
      email: maskedEmail,
      message: `Credentials verified! A 6-digit 2FA login code has been sent to your email (${maskedEmail}).`,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed: " + error.message },
      { status: 500 }
    );
  }
}
