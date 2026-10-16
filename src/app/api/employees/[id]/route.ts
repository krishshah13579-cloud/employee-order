import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

const SAFE_EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  mobileNumber: true,
  address: true,
  proofUrl: true,
  designation: true,
  isTeamLeader: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const empId = parseInt(id, 10);
    if (isNaN(empId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: SAFE_EMPLOYEE_SELECT,
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json(employee);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const employee = await prisma.employee.update({
      where: { id: empId },
      data: {
        name: body.name,
        email: body.email !== undefined ? (body.email ? body.email.trim() : null) : undefined,
        pin: body.pin !== undefined ? body.pin.trim() : undefined,
        mobileNumber: body.mobileNumber,
        address: body.address,
        proofUrl: body.proofUrl,
        designation: body.designation,
        isTeamLeader: body.isTeamLeader !== undefined ? Boolean(body.isTeamLeader) : undefined,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
      select: SAFE_EMPLOYEE_SELECT,
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
    if (body.pin !== undefined) {
      updateData.pin = body.pin.trim();
    }

    const employee = await prisma.employee.update({
      where: { id: empId },
      data: updateData,
      select: SAFE_EMPLOYEE_SELECT,
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

    await prisma.employee.delete({
      where: { id: empId },
    });
    return NextResponse.json({ message: "Employee deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
