import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const adminCount = await prisma.adminAccount.count();
    return NextResponse.json({
      needsSetup: adminCount === 0,
      adminCount,
    });
  } catch (error: any) {
    console.error("Setup check error:", error);
    return NextResponse.json(
      { error: "Failed to check setup status: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only allow setup if NO admin exists in the database
    const existingCount = await prisma.adminAccount.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Admin account already exists. Please log in directly." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const fullName = (body.fullName || "").trim();
    const username = (body.username || "").trim().toLowerCase();
    const password = (body.password || "").trim();
    const twoFactorSecret = (body.twoFactorSecret || "").trim();
    const companyName = (body.companyName || "IQ TROUSERS").trim();
    const phone = (body.phone || "").trim();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Admin username/email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (!twoFactorSecret || twoFactorSecret.length < 4) {
      return NextResponse.json(
        { error: "Please provide a secure 4 to 6 digit security PIN for 2FA." },
        { status: 400 }
      );
    }

    // Create the AdminAccount and the initial AdminProfile atomically
    const result = await prisma.$transaction(async (tx) => {
      const admin = await tx.adminAccount.create({
        data: {
          username,
          password,
          twoFactorSecret,
          twoFactorEnabled: true,
        },
      });

      const profile = await tx.adminProfile.create({
        data: {
          fullName: fullName || "Administrator",
          email: username,
          companyName: companyName || "IQ TROUSERS",
          phone: phone || "",
        },
      });

      return { admin, profile };
    });

    // Create session token and log in immediately
    const sessionToken = Buffer.from(
      JSON.stringify({
        id: result.admin.id,
        username: result.admin.username,
        authenticatedAt: Date.now(),
      })
    ).toString("base64");

    const response = NextResponse.json({
      success: true,
      message: "Admin account and profile created successfully in database!",
      username: result.admin.username,
    });

    response.cookies.set({
      name: "iq_admin_session",
      value: sessionToken,
      httpOnly: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Initial Admin Setup error:", error);
    return NextResponse.json(
      { error: "Setup failed: " + error.message },
      { status: 500 }
    );
  }
}
