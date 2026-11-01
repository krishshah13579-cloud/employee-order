import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { sendEmployeePinResetEmail } from "@/lib/email";
import { ensureDbSchema } from "@/lib/ensure-db-schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();

    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const empId = parseInt(id, 10);
    if (isNaN(empId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Generate random 4-digit PIN (1000 - 9999)
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedPin = hashPassword(randomPin);

    // Update PIN, displayPin, and require PIN change on next login
    await prisma.employee.update({
      where: { id: empId },
      data: {
        pin: hashedPin,
        displayPin: randomPin,
        mustChangePin: true,
      },
    });

    // Also execute raw SQL fallback to ensure schema synchronization
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE wholesale."Employee" SET pin = $1, "displayPin" = $2, "mustChangePin" = true WHERE id = $3`,
        hashedPin,
        randomPin,
        empId
      );
    } catch {}

    await recordAuditLog({
      action: "EMPLOYEE_PIN_RESET",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: empId,
      details: `Generated new random temporary PIN for employee "${employee.name}"`,
      status: "SUCCESS",
    });

    let emailSent = false;
    let emailError = "";
    if (employee.email) {
      try {
        const mailRes = await sendEmployeePinResetEmail({
          to: employee.email,
          name: employee.name,
          username: (employee as any).username || employee.name,
          newPin: randomPin,
        });
        emailSent = mailRes.success;
        if (!mailRes.success) emailError = mailRes.error || "Failed to dispatch email";
      } catch (err: any) {
        emailError = err.message;
      }
    }

    return NextResponse.json({
      success: true,
      message: `New random PIN generated: ${randomPin}${emailSent ? " and sent to " + employee.email : (employee.email ? " (Email failed: " + emailError + ")" : " (No email registered)")}`,
      newPin: randomPin,
      emailSent,
    });
  } catch (error: any) {
    console.error("[EMPLOYEE_RESET_PIN] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to reset PIN" }, { status: 500 });
  }
}
