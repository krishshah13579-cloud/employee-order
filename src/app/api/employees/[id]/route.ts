import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { sendWebPushNotification } from "@/lib/web-push";
import { ensureDbSchema } from "@/lib/ensure-db-schema";

const BASE_SAFE_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  displayPin: true,
  mustChangePin: true,
  onboardingStep: true,
  mobileNumber: true,
  address: true,
  proofUrl: true,
  designation: true,
  isTeamLeader: true,
  canEditOrders: true,
  canUpdateStock: true,
  canAddPreviousBills: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();

    const { id } = await params;
    const empId = parseInt(id, 10);
    if (isNaN(empId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }

    let employee: any = null;
    try {
      employee = await prisma.employee.findUnique({
        where: { id: empId },
        select: BASE_SAFE_SELECT,
      });
    } catch (queryErr) {
      console.warn("[EMPLOYEE_GET] Safe fallback for employee query:", queryErr);
      await ensureDbSchema(true);
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, name, email, "mobileNumber", address, "proofUrl", designation, "isTeamLeader", "canEditOrders", "canUpdateStock", "canAddPreviousBills", "isActive", "createdAt", "updatedAt" FROM wholesale."Employee" WHERE id = $1`,
          empId
        );
        employee = rows?.[0];
      } catch {}
    }

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    let tasks: any[] = [];
    try {
      tasks = await (prisma as any).employeeTask.findMany({
        where: { employeeId: empId },
        orderBy: { id: "asc" },
      });
    } catch {}

    let canViewOrderForm = true;
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "canViewOrderForm" FROM wholesale."Employee" WHERE id = $1`,
        empId
      );
      if (rows?.[0] && rows[0].canViewOrderForm !== undefined) {
        canViewOrderForm = Boolean(rows[0].canViewOrderForm);
      }
    } catch {}

    return NextResponse.json({
      ...employee,
      canViewOrderForm,
      tasks: tasks || [],
    });
  } catch (error: any) {
    console.error("[EMPLOYEE_GET] Fatal error fetching employee:", error);
    return NextResponse.json({ error: error.message || "Failed to load employee" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();

    // Only Admin can modify employee records
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const empId = parseInt(id, 10);
    if (isNaN(empId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }

    const body = await req.json();

    let employee: any;
    try {
      const putData: any = {
        name: body.name,
        email: body.email !== undefined ? (body.email ? body.email.trim() : null) : undefined,
        mobileNumber: body.mobileNumber,
        address: body.address,
        proofUrl: body.proofUrl,
        designation: body.designation,
        isTeamLeader: body.isTeamLeader !== undefined ? Boolean(body.isTeamLeader) : undefined,
        canEditOrders: body.canEditOrders !== undefined ? Boolean(body.canEditOrders) : undefined,
        canUpdateStock: body.canUpdateStock !== undefined ? Boolean(body.canUpdateStock) : undefined,
        canAddPreviousBills: body.canAddPreviousBills !== undefined ? Boolean(body.canAddPreviousBills) : undefined,
        isActive: body.isActive !== undefined ? body.isActive : true,
      };

      if (body.username !== undefined) {
        putData.username = body.username ? body.username.trim() : null;
      }
      if (body.pin !== undefined && body.pin.trim()) {
        putData.pin = hashPassword(body.pin.trim());
        putData.displayPin = body.pin.trim();
        if (body.mustChangePin !== undefined) {
          putData.mustChangePin = Boolean(body.mustChangePin);
        }
      }

      employee = await prisma.employee.update({
        where: { id: empId },
        data: putData,
        select: BASE_SAFE_SELECT,
      });
    } catch (updateErr) {
      console.warn("[EMPLOYEE_PUT] Retrying update with raw SQL fallback:", updateErr);
      await ensureDbSchema(true);
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE wholesale."Employee" SET name = $1, "mobileNumber" = $2, address = $3, designation = $4, "isActive" = $5, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $6`,
          body.name,
          body.mobileNumber,
          body.address,
          body.designation || "Sales Representative",
          body.isActive !== undefined ? Boolean(body.isActive) : true,
          empId
        );
        employee = {
          id: empId,
          name: body.name,
          mobileNumber: body.mobileNumber,
          address: body.address,
          designation: body.designation,
          isActive: body.isActive !== undefined ? body.isActive : true,
        };
      } catch (rawErr) {
        throw updateErr;
      }
    }

    if (body.canViewOrderForm !== undefined) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE wholesale."Employee" ADD COLUMN IF NOT EXISTS "canViewOrderForm" BOOLEAN DEFAULT true;`
        );
        await prisma.$executeRawUnsafe(
          `UPDATE wholesale."Employee" SET "canViewOrderForm" = $1 WHERE id = $2`,
          Boolean(body.canViewOrderForm),
          empId
        );
      } catch {}
    }

    // Sync tasks if provided
    if (Array.isArray(body.tasks)) {
      try {
        await prisma.employeeTask.deleteMany({
          where: { employeeId: empId },
        });
        const taskEntries = body.tasks
          .map((t: any) => ({
            taskTitle: typeof t === "string" ? t.trim() : (t.taskTitle || "").trim(),
            isCompleted: typeof t === "object" ? Boolean(t.isCompleted) : false,
            completedAt: typeof t === "object" && t.completedAt ? new Date(t.completedAt) : null,
          }))
          .filter((t: any) => Boolean(t.taskTitle));

        if (taskEntries.length > 0) {
          await prisma.employeeTask.createMany({
            data: taskEntries.map((t: any) => ({
              employeeId: empId,
              taskTitle: t.taskTitle,
              isCompleted: t.isCompleted,
              completedAt: t.completedAt,
            })),
          });
        }
      } catch (taskSyncErr) {
        console.warn("[EMPLOYEE_PUT] Task sync warning:", taskSyncErr);
      }
    }

    await recordAuditLog({
      action: "EMPLOYEE_UPDATED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: employee.id,
      details: `Updated employee profile for "${employee.name}"`,
      status: "SUCCESS",
    });

    return NextResponse.json(employee);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();

    // Only Admin can patch employee records
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const empId = parseInt(id, 10);
    if (isNaN(empId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }

    const body = await req.json();

    const updateData: any = {};
    if (body.isTeamLeader !== undefined) {
      updateData.isTeamLeader = Boolean(body.isTeamLeader);
      if (body.designation) {
        updateData.designation = body.designation;
      } else if (body.isTeamLeader) {
        updateData.designation = "Team Leader (T.L.)";
      } else {
        updateData.designation = "Sales Representative";
      }
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }
    if (body.canEditOrders !== undefined) {
      updateData.canEditOrders = Boolean(body.canEditOrders);
    }
    if (body.canUpdateStock !== undefined) {
      updateData.canUpdateStock = Boolean(body.canUpdateStock);
    }
    if (body.canAddPreviousBills !== undefined) {
      updateData.canAddPreviousBills = Boolean(body.canAddPreviousBills);
    }
    if (body.pin !== undefined && body.pin.trim()) {
      updateData.pin = hashPassword(body.pin.trim());
      updateData.displayPin = body.pin.trim();
      if (body.mustChangePin !== undefined) {
        updateData.mustChangePin = Boolean(body.mustChangePin);
      }
    }
    if (body.username !== undefined) {
      updateData.username = body.username ? body.username.trim() : null;
    }

    let employee: any;
    try {
      employee = await prisma.employee.update({
        where: { id: empId },
        data: updateData,
        select: BASE_SAFE_SELECT,
      });
    } catch (patchErr) {
      console.warn("[EMPLOYEE_PATCH] Retrying patch with basic select fallback:", patchErr);
      await ensureDbSchema(true);
      employee = await prisma.employee.update({
        where: { id: empId },
        data: updateData,
        select: { id: true, name: true, isActive: true },
      });
    }

    // If access was granted or revoked, send background Web Push Notification
    if (body.isActive !== undefined) {
      sendWebPushNotification({
        title: body.isActive
          ? "IQ TROUSERS — Account Access Approved"
          : "IQ TROUSERS — Account Access Suspended",
        body: body.isActive
          ? `Welcome ${employee.name}! Your portal account is active.`
          : `Hello ${employee.name}, your portal access has been revoked by administration.`,
        url: body.isActive ? "/" : "/auth/access",
        tag: `emp_active_${employee.id}_${body.isActive ? '1' : '0'}`,
      }).catch(() => {});
    }

    await recordAuditLog({
      action: "EMPLOYEE_PATCHED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: employee.id,
      details: `Patched employee fields (${Object.keys(updateData).join(", ")}) for "${employee.name}"`,
      status: "SUCCESS",
    });

    return NextResponse.json(employee);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();

    // Only Admin can delete employees
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
      select: { id: true, name: true },
    });

    await prisma.employee.delete({
      where: { id: empId },
      select: { id: true },
    });

    await recordAuditLog({
      action: "EMPLOYEE_DELETED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: empId,
      details: `Deleted employee record for "${employee?.name || empId}"`,
      status: "SUCCESS",
    });

    return NextResponse.json({ message: "Employee deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
