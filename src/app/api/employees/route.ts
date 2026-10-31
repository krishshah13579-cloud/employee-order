import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { sendEmployeeOnboardingEmail } from "@/lib/email";
import { ensureDbSchema } from "@/lib/ensure-db-schema";

// Safe fields to expose to frontend (never expose secret pin)
const SAFE_EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  mobileNumber: true,
  address: true,
  proofUrl: true,
  designation: true,
  isTeamLeader: true,
  canEditOrders: true,
  canUpdateStock: true,
  canAddPreviousBills: true,
  canViewOrderForm: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
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
};

export async function GET(req: NextRequest) {
  try {
    await ensureDbSchema();

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

    try {
      const employees = await prisma.employee.findMany({
        where,
        select: SAFE_EMPLOYEE_SELECT,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(employees);
    } catch (listErr) {
      console.warn("[EMPLOYEES_GET] Falling back to base employee select:", listErr);
      await ensureDbSchema(true);

      const fallbackEmployees = await prisma.employee.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
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
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(
        fallbackEmployees.map((e) => ({
          ...e,
          canViewOrderForm: (e as any).canViewOrderForm ?? true,
          tasks: [],
        }))
      );
    }
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
    const { name, email, mobileNumber, address, proofUrl, designation, isActive, pin } = body;

    if (!name || !mobileNumber || !address) {
      return NextResponse.json(
        { error: "Name, mobile number, and address are required" },
        { status: 400 }
      );
    }

    let employee: any;
    try {
      employee = await prisma.employee.create({
        data: {
          name: name.trim(),
          email: (email || "").trim() || null,
          pin: hashPassword((pin || "1234").trim()),
          mobileNumber: mobileNumber.trim(),
          address: address.trim(),
          proofUrl: proofUrl || null,
          designation: designation || "Sales Representative",
          isTeamLeader: Boolean(body.isTeamLeader),
          canEditOrders: Boolean(body.canEditOrders),
          canUpdateStock: Boolean(body.canUpdateStock),
          canAddPreviousBills: Boolean(body.canAddPreviousBills),
          canViewOrderForm: body.canViewOrderForm !== undefined ? Boolean(body.canViewOrderForm) : true,
          isActive: isActive !== undefined ? isActive : true,
        },
        select: SAFE_EMPLOYEE_SELECT,
      });
    } catch (createErr) {
      console.warn("[EMPLOYEE_POST] Fallback employee creation without canViewOrderForm:", createErr);
      await ensureDbSchema(true);
      employee = await prisma.employee.create({
        data: {
          name: name.trim(),
          email: (email || "").trim() || null,
          pin: hashPassword((pin || "1234").trim()),
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
      });
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

    // Send onboarding welcome email if employee has an email address
    const rawPin = (pin || "1234").trim();
    if (employee.email) {
      try {
        await sendEmployeeOnboardingEmail({
          to: employee.email,
          username: employee.name,
          pin: rawPin,
        });
      } catch (mailErr) {
        console.error("Failed to dispatch employee onboarding email:", mailErr);
      }
    }

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
