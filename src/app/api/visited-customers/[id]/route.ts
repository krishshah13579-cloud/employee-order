import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { sanitizePositiveInt } from "@/lib/navigation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const recordId = sanitizePositiveInt(id);
    if (!recordId) {
      return NextResponse.json({ error: "Invalid ID parameter" }, { status: 400 });
    }

    const record = await prisma.visitedCustomer.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return NextResponse.json({ error: "Visited customer record not found" }, { status: 404 });
    }

    // Role-based IDOR isolation
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah && employee) {
      const isOwner =
        record.employeeId === employee.id ||
        (record.employeeName && record.employeeName.toLowerCase() === employee.name.toLowerCase());
      if (!isOwner) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to view this visited customer." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(record);
  } catch (error: any) {
    console.error("Error fetching visited customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch visited customer: " + error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const recordId = sanitizePositiveInt(id);
    if (!recordId) {
      return NextResponse.json({ error: "Invalid ID parameter" }, { status: 400 });
    }

    const existing = await prisma.visitedCustomer.findUnique({
      where: { id: recordId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Visited customer not found" }, { status: 404 });
    }

    // Role-based IDOR isolation
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah && employee) {
      const isOwner =
        existing.employeeId === employee.id ||
        (existing.employeeName && existing.employeeName.toLowerCase() === employee.name.toLowerCase());
      if (!isOwner) {
        return NextResponse.json(
          { error: "Forbidden: You cannot modify another employee's visited customer." },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const updateData: any = {};

    // 1. If City is updated, ensure it is strictly CAPITAL ONLY
    if (body.city !== undefined) {
      const cleanCity = String(body.city).trim().toUpperCase();
      if (!cleanCity) {
        return NextResponse.json(
          { error: "City name cannot be blank and must be in CAPITAL ONLY." },
          { status: 400 }
        );
      }
      updateData.city = cleanCity;
    }

    if (body.shopName !== undefined) updateData.shopName = String(body.shopName).trim().slice(0, 150);
    if (body.phone !== undefined) updateData.phone = String(body.phone).trim().slice(0, 30);
    if (body.contactPerson !== undefined) updateData.contactPerson = String(body.contactPerson).trim().slice(0, 100);
    if (body.notes !== undefined) updateData.notes = String(body.notes).trim().slice(0, 1000);
    if (body.visitingCardUrl !== undefined) updateData.visitingCardUrl = String(body.visitingCardUrl).trim();
    if (body.status !== undefined) {
      if (["Visited", "Follow Up", "Converted"].includes(body.status)) {
        updateData.status = body.status;
      }
    }

    const updated = await prisma.visitedCustomer.update({
      where: { id: recordId },
      data: updateData,
    });

    const actorName = admin ? (admin.username || "Admin") : (employee?.name || "Employee");
    await recordAuditLog({
      action: "VISITED_CUSTOMER_UPDATED",
      actorType: admin ? "ADMIN" : "EMPLOYEE",
      actorName,
      entityType: "VisitedCustomer",
      entityId: recordId,
      details: updateData,
      status: "SUCCESS",
    });

    return NextResponse.json({
      message: "Visited customer updated successfully",
      visitedCustomer: updated,
    });
  } catch (error: any) {
    console.error("Error updating visited customer:", error);
    return NextResponse.json(
      { error: "Failed to update visited customer: " + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const recordId = sanitizePositiveInt(id);
    if (!recordId) {
      return NextResponse.json({ error: "Invalid ID parameter" }, { status: 400 });
    }

    const existing = await prisma.visitedCustomer.findUnique({
      where: { id: recordId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Visited customer not found" }, { status: 404 });
    }

    // Role-based IDOR isolation
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);
    if (!admin && !isTLKrishShah && employee) {
      const isOwner =
        existing.employeeId === employee.id ||
        (existing.employeeName && existing.employeeName.toLowerCase() === employee.name.toLowerCase());
      if (!isOwner) {
        return NextResponse.json(
          { error: "Forbidden: You cannot delete another employee's visited customer." },
          { status: 403 }
        );
      }
    }

    await prisma.visitedCustomer.delete({
      where: { id: recordId },
    });

    const actorName = admin ? (admin.username || "Admin") : (employee?.name || "Employee");
    await recordAuditLog({
      action: "VISITED_CUSTOMER_DELETED",
      actorType: admin ? "ADMIN" : "EMPLOYEE",
      actorName,
      entityType: "VisitedCustomer",
      entityId: recordId,
      details: { id: recordId, city: existing.city, shopName: existing.shopName },
      status: "SUCCESS",
    });

    return NextResponse.json({ message: "Visited customer deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting visited customer:", error);
    return NextResponse.json(
      { error: "Failed to delete visited customer: " + error.message },
      { status: 500 }
    );
  }
}
