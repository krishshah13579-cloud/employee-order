import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { sendEmployeeOnboardingEmail, sendEmployeeStep3CredentialsEmail } from "@/lib/email";
import { ensureDbSchema } from "@/lib/ensure-db-schema";

// Safe base fields to expose to frontend (including displayPin for Admin portal security view)
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

export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();

    // Only logged-in Admin can list employees and credentials
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let where: any = {};
    if (search) {
      where = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { mobileNumber: { contains: search } },
          { address: { contains: search } },
        ],
      };
    }

    let employees: any[] = [];
    try {
      employees = await prisma.employee.findMany({
        where,
        select: {
          ...BASE_SAFE_SELECT,
          tasks: {
            select: {
              id: true,
              taskTitle: true,
              isCompleted: true,
              completedAt: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { id: "asc" as const },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (listErr) {
      console.warn("[EMPLOYEES_GET] Falling back to base employee select:", listErr);
      await ensureDbSchema(true);

      employees = await prisma.employee.findMany({
        where,
        select: BASE_SAFE_SELECT,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json(
      employees.map((e) => ({
        ...e,
        canViewOrderForm: (e as any).canViewOrderForm ?? true,
        tasks: e.tasks || [],
      }))
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbSchema();

    // Only logged-in Admin can create new employees
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { name, username, email, mobileNumber, address, proofUrl, designation, isActive, pin } = body;

    if (!name || !mobileNumber || !address) {
      return NextResponse.json(
        { error: "Name, mobile number, and address are required" },
        { status: 400 }
      );
    }

    const rawPin = (pin || "1234").trim();
    const finalUsername = (username || name).trim();

    // Gap-filling logic: Scan existing employee IDs to find the lowest available positive integer starting from 1
    // For example: If EMP-002 was deleted and EMP-001 & EMP-003 exist, reuse EMP-002!
    let nextAvailableId = 1;
    try {
      const existingEmployees = await prisma.employee.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
      });
      const idSet = new Set(existingEmployees.map((e) => e.id));
      while (idSet.has(nextAvailableId)) {
        nextAvailableId++;
      }
    } catch (idErr) {
      console.warn("[EMPLOYEE_POST] Error calculating gap-filling ID:", idErr);
    }

    let employee: any;
    try {
      employee = await prisma.employee.create({
        data: {
          id: nextAvailableId,
          name: name.trim(),
          username: finalUsername,
          email: (email || "").trim() || null,
          pin: hashPassword(rawPin),
          displayPin: rawPin,
          mustChangePin: true,
          onboardingStep: 3,
          mobileNumber: mobileNumber.trim(),
          address: address.trim(),
          proofUrl: proofUrl || null,
          designation: designation || "Sales Representative",
          isTeamLeader: Boolean(body.isTeamLeader),
          canEditOrders: Boolean(body.canEditOrders),
          canUpdateStock: Boolean(body.canUpdateStock),
          canAddPreviousBills: Boolean(body.canAddPreviousBills),
          isActive: isActive !== undefined ? isActive : true,
        },
        select: BASE_SAFE_SELECT,
      });

      // Synchronize postgres sequence to highest id
      try {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('wholesale."Employee"', 'id'), COALESCE((SELECT MAX(id) FROM wholesale."Employee"), 0) + 1, false);`
        );
      } catch {}

      if (body.canViewOrderForm !== undefined) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE wholesale."Employee" SET "canViewOrderForm" = $1 WHERE id = $2`,
            Boolean(body.canViewOrderForm),
            employee.id
          );
        } catch {}
      }
    } catch (createErr) {
      console.warn("[EMPLOYEE_POST] Fallback employee creation without optional fields:", createErr);
      await ensureDbSchema(true);
      employee = await prisma.employee.create({
        data: {
          id: nextAvailableId,
          name: name.trim(),
          username: finalUsername,
          email: (email || "").trim() || null,
          pin: hashPassword(rawPin),
          displayPin: rawPin,
          mustChangePin: true,
          onboardingStep: 3,
          mobileNumber: mobileNumber.trim(),
          address: address.trim(),
          proofUrl: proofUrl || null,
          designation: designation || "Sales Representative",
          isTeamLeader: Boolean(body.isTeamLeader),
          canEditOrders: Boolean(body.canEditOrders),
          canUpdateStock: Boolean(body.canUpdateStock),
          canAddPreviousBills: Boolean(body.canAddPreviousBills),
          isActive: isActive !== undefined ? isActive : true,
        },
        select: BASE_SAFE_SELECT,
      });

      try {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('wholesale."Employee"', 'id'), COALESCE((SELECT MAX(id) FROM wholesale."Employee"), 0) + 1, false);`
        );
      } catch {}
    }

    // Save initial tasks if provided (for Office Employee or any staff)
    if (Array.isArray(body.tasks) && body.tasks.length > 0) {
      try {
        const taskTitles = body.tasks
          .map((t: any) => (typeof t === "string" ? t.trim() : (t.taskTitle || "").trim()))
          .filter(Boolean);
        if (taskTitles.length > 0) {
          await prisma.employeeTask.createMany({
            data: taskTitles.map((title: string) => ({
              employeeId: employee.id,
              taskTitle: title,
            })),
          });
        }
      } catch (taskErr) {
        console.warn("[EMPLOYEE_POST] Initial task creation warning:", taskErr);
      }
    }

    await recordAuditLog({
      action: "EMPLOYEE_CREATED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: employee.id,
      details: `Created employee record for "${employee.name}" with hashed PIN`,
      status: "SUCCESS",
    });

    // Send Step 3 Official Credentials email with permanent PIN setup notice
    if (employee.email) {
      try {
        await sendEmployeeStep3CredentialsEmail({
          to: employee.email,
          name: employee.name,
          username: finalUsername,
          pin: rawPin,
        });
      } catch (mailErr) {
        console.error("Failed to dispatch employee credentials email:", mailErr);
      }
    }

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
