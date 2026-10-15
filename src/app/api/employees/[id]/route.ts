import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
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
    const { id } = await params;
    const body = await req.json();

    const employee = await prisma.employee.update({
      where: { id: parseInt(id) },
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
    const { id } = await params;
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
      where: { id: parseInt(id) },
      data: updateData,
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
    const { id } = await params;
    await prisma.employee.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ message: "Employee deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
