import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyToken, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { ensureDbSchema } from "@/lib/ensure-db-schema";

export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("garmentpro_emp_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const session = verifyToken<{ id: number; name: string }>(sessionCookie.value);
    if (!session?.id) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }

    const body = await req.json();
    const newPin = (body.newPin || "").trim();

    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json(
        { error: "Permanent PIN must be exactly 4 numeric digits." },
        { status: 400 }
      );
    }

    const hashed = hashPassword(newPin);

    await prisma.employee.update({
      where: { id: session.id },
      data: {
        pin: hashed,
        displayPin: newPin,
        mustChangePin: false,
      },
    });

    try {
      await prisma.$executeRawUnsafe(
        `UPDATE wholesale."Employee" SET pin = $1, "displayPin" = $2, "mustChangePin" = false WHERE id = $3`,
        hashed,
        newPin,
        session.id
      );
    } catch {}

    await recordAuditLog({
      action: "EMPLOYEE_PIN_CHANGED",
      actorType: "EMPLOYEE",
      actorName: session.name,
      entityType: "Employee",
      entityId: session.id,
      details: "Employee successfully set their permanent 4-digit PIN",
      status: "SUCCESS",
    });

    return NextResponse.json({
      success: true,
      message: "Permanent 4-digit PIN successfully configured!",
    });
  } catch (error: any) {
    console.error("[CHANGE_PIN_POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update permanent PIN" },
      { status: 500 }
    );
  }
}
