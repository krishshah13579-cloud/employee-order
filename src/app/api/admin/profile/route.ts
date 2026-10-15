import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    let profile = await prisma.adminProfile.findFirst();
    if (!profile) {
      profile = await prisma.adminProfile.create({
        data: {
          fullName: "Krish Shah",
          email: "krishshah13579@gmail.com",
          phone: "+91 98250 13579",
          companyName: "IQ TROUSERS",
          gstNo: "24AAACI1357Q1Z2",
          panNo: "AAACI1357Q",
          address: "Plot 501-504, Textile Tower, Ring Road, Surat, Gujarat - 395002",
          bankName: "HDFC Bank Ltd",
          accountNo: "50200098765432",
          ifscCode: "HDFC0001357",
          notes: "IQ TROUSERS — Premium Quality Mens & Boys Garment Manufacturers",
        },
      });
    }
    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // 2FA Security Guard Check
    const unlockToken = req.headers.get("x-admin-unlock-token") || body.unlockToken;

    if (!unlockToken) {
      return NextResponse.json(
        { error: "Admin Details are locked. 2FA Email Authentication is required to edit details." },
        { status: 403 }
      );
    }

    try {
      const decoded = JSON.parse(Buffer.from(unlockToken, "base64").toString("utf-8"));
      if (
        !decoded ||
        decoded.action !== "unlock_profile_edit" ||
        !decoded.expiresAt ||
        Date.now() > decoded.expiresAt
      ) {
        return NextResponse.json(
          { error: "2FA Unlock session expired. Please verify with 2FA email again." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid 2FA authorization token. Please authenticate with 2FA email." },
        { status: 403 }
      );
    }

    let profile = await prisma.adminProfile.findFirst();

    if (!profile) {
      profile = await prisma.adminProfile.create({
        data: {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          companyName: body.companyName,
          gstNo: body.gstNo,
          panNo: body.panNo,
          address: body.address,
          bankName: body.bankName,
          accountNo: body.accountNo,
          ifscCode: body.ifscCode,
          notes: body.notes,
        },
      });
    } else {
      profile = await prisma.adminProfile.update({
        where: { id: profile.id },
        data: {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          companyName: body.companyName,
          gstNo: body.gstNo,
          panNo: body.panNo,
          address: body.address,
          bankName: body.bankName,
          accountNo: body.accountNo,
          ifscCode: body.ifscCode,
          notes: body.notes,
        },
      });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
