import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateRandomCode } from "@/lib/device-gate";
import { recordAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch all registered devices ordered by last used
    const devices = await prisma.authorizedDevice.findMany({
      orderBy: { lastUsedAt: "desc" },
    });

    // 2. Fetch active/recent invites
    const invites = await prisma.deviceAccessInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 3. Fetch active employees for dropdown
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        mobileNumber: true,
        designation: true,
        isTeamLeader: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      devices,
      invites,
      employees,
    });
  } catch (error: any) {
    console.error("Fetch devices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch authorized devices: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const body = await req.json();
    const action = body.action;

    // A. Generate Single-Use WhatsApp Invite Link
    if (action === "generate_invite") {
      const employeeId = body.employeeId ? parseInt(body.employeeId) : null;
      let employeeName = body.employeeName || "Employee";
      let mobileNumber = body.mobileNumber || "";

      if (employeeId) {
        const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (emp) {
          employeeName = emp.name;
          mobileNumber = emp.mobileNumber;
        }
      }

      // Generate 24-character cryptographic code
      const inviteCode = generateRandomCode(24);
      // Valid for 7 days
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await prisma.deviceAccessInvite.create({
        data: {
          inviteCode,
          employeeId,
          employeeName,
          role: body.role || "EMPLOYEE",
          expiresAt,
          createdBy: body.createdBy || "Super Admin",
        },
      });

      // Construct official URL (prefer production domain employee.iqtrousers.in)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://employee.iqtrousers.in";
      const cleanBase = baseUrl.replace(/\/$/, "");
      const accessUrl = `${cleanBase}/auth/access?key=${inviteCode}`;

      // WhatsApp preformatted message
      const whatsappText = encodeURIComponent(
        `*IQ TROUSERS — Device Authorization Link*\n\n` +
        `Hello ${employeeName},\n` +
        `Here is your official device authorization link for the IQ Trousers Employee Portal:\n\n` +
        `👉 ${accessUrl}\n\n` +
        `⚠️ *Important Note:* Tap this link once from your mobile phone to approve your device for 365 days. Do not forward this link to anyone.`
      );

      const whatsappShareUrl = mobileNumber
        ? `https://wa.me/${mobileNumber.replace(/[^0-9]/g, "")}?text=${whatsappText}`
        : `https://wa.me/?text=${whatsappText}`;

      await recordAuditLog({
        action: "DEVICE_INVITE_GENERATED",
        actorType: "ADMIN",
        actorName: "Super Admin",
        details: `Generated WhatsApp device invite link for ${employeeName} (Expires: ${expiresAt.toISOString()})`,
        ipAddress: ip,
        status: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        invite,
        accessUrl,
        whatsappShareUrl,
        message: `Device invite link generated for ${employeeName}!`,
      });
    }

    // B. Revoke an Authorized Device
    if (action === "revoke_device") {
      const deviceId = body.deviceId;
      if (!deviceId) {
        return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
      }

      await prisma.authorizedDevice.update({
        where: { deviceId },
        data: { isActive: false },
      });

      await recordAuditLog({
        action: "DEVICE_REVOKED",
        actorType: "ADMIN",
        actorName: "Super Admin",
        details: `Revoked authorization for deviceId: ${deviceId}`,
        ipAddress: ip,
        status: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: "Device access has been revoked successfully.",
      });
    }

    // C. Re-authorize a previously revoked Device
    if (action === "reactivate_device") {
      const deviceId = body.deviceId;
      if (!deviceId) {
        return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
      }

      await prisma.authorizedDevice.update({
        where: { deviceId },
        data: { isActive: true },
      });

      return NextResponse.json({
        success: true,
        message: "Device access re-activated.",
      });
    }

    // D. Delete an unused Invite
    if (action === "delete_invite") {
      const inviteId = parseInt(body.inviteId);
      if (!inviteId) {
        return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
      }

      await prisma.deviceAccessInvite.delete({
        where: { id: inviteId },
      });

      return NextResponse.json({
        success: true,
        message: "Invite deleted successfully.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Device management action error:", error);
    return NextResponse.json(
      { error: "Action failed: " + error.message },
      { status: 500 }
    );
  }
}
