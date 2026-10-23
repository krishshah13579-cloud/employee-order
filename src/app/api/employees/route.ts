import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";

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
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(req: NextRequest) {
  try {
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

    const employees = await prisma.employee.findMany({
      where,
      select: SAFE_EMPLOYEE_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(employees);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const employee = await prisma.employee.create({
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
        isActive: isActive !== undefined ? isActive : true,
      },
      select: SAFE_EMPLOYEE_SELECT,
    });

    await recordAuditLog({
      action: "EMPLOYEE_CREATED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: employee.id,
      details: `Created employee record for "${employee.name}" with hashed PIN`,
      status: "SUCCESS",
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
