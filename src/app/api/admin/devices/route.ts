import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateRandomCode } from "@/lib/device-gate";
import { dispatchAutomatedWhatsApp } from "@/lib/whatsapp";
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

      // WhatsApp plain text message for direct dispatch
      const rawMessageText =
        `*IQ TROUSERS — Device Authorization Link*\n\n` +
        `Hello ${employeeName},\n` +
        `Here is your official device authorization for the IQ Trousers Portal:\n\n` +
        `👉 ${accessUrl}\n\n` +
        `🔑 *Activation Code:*\n\`${inviteCode}\`\n\n` +
        `⚠️ *How to unlock:*\n` +
        `• Option 1: Tap the link above from your phone.\n` +
        `• Option 2: If you are seeing the "Access Restricted" screen, tap "Super Admin / Activation Unlock" and enter code: \`${inviteCode}\`\n\n` +
        `Valid for 365 days. Do not forward this link.`;

      // 1. Direct Background Dispatch via logged-in WhatsApp Gateway (Baileys / Meta API)
      let directSent = false;
      let dispatchMethod = "NONE";
      let dispatchError = "";

      if (mobileNumber) {
        try {
          const sendResult = await dispatchAutomatedWhatsApp(mobileNumber, rawMessageText);
          directSent = sendResult.success;
          dispatchMethod = sendResult.method;
          if (!sendResult.success) {
            dispatchError = sendResult.error || "Gateway dispatch failed";
          }
        } catch (dispatchErr: any) {
          dispatchError = dispatchErr.message;
        }
      }

      // WhatsApp web link fallback
      const whatsappText = encodeURIComponent(rawMessageText);
      const whatsappShareUrl = mobileNumber
        ? `https://wa.me/${mobileNumber.replace(/[^0-9]/g, "")}?text=${whatsappText}`
        : `https://wa.me/?text=${whatsappText}`;

      await recordAuditLog({
        action: directSent ? "DEVICE_INVITE_SENT_WHATSAPP" : "DEVICE_INVITE_GENERATED",
        actorType: "ADMIN",
        actorName: "Super Admin",
        details: directSent
          ? `Dispatched device invite directly via logged-in WhatsApp to ${employeeName} (${mobileNumber})`
          : `Generated WhatsApp device invite link for ${employeeName} (Expires: ${expiresAt.toISOString()})`,
        ipAddress: ip,
        status: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        invite,
        accessUrl,
        whatsappShareUrl,
        directSent,
        dispatchMethod,
        dispatchError,
        employeeName,
        mobileNumber,
        message: directSent
          ? `Authorization link sent directly to ${employeeName}'s WhatsApp (+91 ${mobileNumber}) from your logged-in WhatsApp business account!`
          : `Device invite link generated for ${employeeName}!`,
      });
    }

    // Direct re-send to WhatsApp
    if (action === "send_invite_direct") {
      const inviteCode = body.inviteCode;
      const employeeName = body.employeeName || "Employee";
      const mobileNumber = body.mobileNumber || "";

      if (!mobileNumber || !inviteCode) {
        return NextResponse.json({ error: "mobileNumber and inviteCode are required" }, { status: 400 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://employee.iqtrousers.in";
      const accessUrl = `${baseUrl.replace(/\/$/, "")}/auth/access?key=${inviteCode}`;
      const rawMessageText =
        `*IQ TROUSERS — Device Authorization Link*\n\n` +
        `Hello ${employeeName},\n` +
        `Here is your official device authorization link for the IQ Trousers Employee Portal:\n\n` +
        `👉 ${accessUrl}\n\n` +
        `⚠️ *Important Note:* Tap this link once from your mobile phone to approve your device for 365 days. Do not forward this link to anyone.`;

      const sendResult = await dispatchAutomatedWhatsApp(mobileNumber, rawMessageText);

      return NextResponse.json({
        success: sendResult.success,
        method: sendResult.method,
        error: sendResult.error,
        message: sendResult.success
          ? `Sent directly to ${employeeName} on WhatsApp (+91 ${mobileNumber})!`
          : `Could not send via logged-in WhatsApp: ${sendResult.error || "Gateway unreachable"}`,
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
