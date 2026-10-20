import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { employeeId, customerIds, action } = body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { error: "customerIds array is required and must not be empty." },
        { status: 400 }
      );
    }

    const validCustomerIds = customerIds
      .map((id: any) => parseInt(id, 10))
      .filter((id: number) => !isNaN(id));

    if (action === "unallocate") {
      // Clear allocation for given customers
      await prisma.customer.updateMany({
        where: { id: { in: validCustomerIds } },
        data: {
          allocatedEmployeeId: null,
          allocatedEmployeeName: null,
        },
      });

      await recordAuditLog({
        action: "CUSTOMER_UNALLOCATED",
        actorType: "ADMIN",
        actorName: auth.user?.username || "Admin",
        entityType: "Customer",
        details: `Removed employee allocation for ${validCustomerIds.length} customer(s)`,
        status: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: `Successfully unallocated ${validCustomerIds.length} customer(s).`,
      });
    }

    // Allocate to specific employee
    const targetEmpId = parseInt(employeeId, 10);
    if (isNaN(targetEmpId)) {
      return NextResponse.json(
        { error: "Valid employeeId is required for allocation." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: targetEmpId },
      select: { id: true, name: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Target employee not found." }, { status: 404 });
    }

    await prisma.customer.updateMany({
      where: { id: { in: validCustomerIds } },
      data: {
        allocatedEmployeeId: employee.id,
        allocatedEmployeeName: employee.name,
      },
    });

    await recordAuditLog({
      action: "CUSTOMER_ALLOCATED",
      actorType: "ADMIN",
      actorName: auth.user?.username || "Admin",
      entityType: "Employee",
      entityId: employee.id,
      details: `Allocated ${validCustomerIds.length} customer(s) to employee "${employee.name}"`,
      status: "SUCCESS",
    });

    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${validCustomerIds.length} customer(s) to ${employee.name}.`,
    });
  } catch (error: any) {
    console.error("Error allocating customers:", error);
    return NextResponse.json(
      { error: "Failed to allocate customers: " + error.message },
      { status: 500 }
    );
  }
}
