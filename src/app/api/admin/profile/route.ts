import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, verifyToken } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    let profile = await prisma.adminProfile.findFirst();
    if (!profile) {
      const adminAcc = await prisma.adminAccount.findFirst();
      const defaultEmail = auth.user?.username || adminAcc?.username || process.env.GMAIL_USER || "";
      profile = await prisma.adminProfile.create({
        data: {
          fullName: "Administrator",
          email: defaultEmail,
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
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();

    // 2FA Security Guard Check
    const unlockToken = req.headers.get("x-admin-unlock-token") || body.unlockToken;

    if (!unlockToken) {
      return NextResponse.json(
        { error: "Admin Details are locked. 2FA Email Authentication is required to edit details." },
        { status: 403 }
      );
    }

    const decoded = verifyToken<{ action: string }>(unlockToken);
    if (!decoded || decoded.action !== "unlock_profile_edit") {
      return NextResponse.json(
        { error: "Invalid or expired 2FA authorization token. Please authenticate with 2FA email again." },
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

    await recordAuditLog({
      action: "ADMIN_PROFILE_UPDATED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "AdminProfile",
      entityId: profile.id,
      details: `Updated company details for "${profile.companyName}" via 2FA unlock token`,
      status: "SUCCESS",
    });

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
