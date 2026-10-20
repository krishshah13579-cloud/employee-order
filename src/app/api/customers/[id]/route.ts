import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, requireAdmin, verifyToken } from "@/lib/auth-security";
import { cookies } from "next/headers";
import { isEmployeeTeamLeader } from "@/lib/time";

async function canUserAssignSpecialDiscount(request: NextRequest): Promise<boolean> {
  // Check Admin
  const admin = await getAdminSession(request);
  if (admin) return true;

  // Check Team Leader (T.L.)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("garmentpro_emp_session");
  if (!sessionCookie?.value) return false;

  const session = verifyToken<{ id: number; name: string }>(sessionCookie.value);
  if (!session?.id) return false;

  const employee = await prisma.employee.findUnique({
    where: { id: session.id },
    select: { id: true, designation: true, isTeamLeader: true, isActive: true },
  });

  if (!employee || !employee.isActive) return false;
  return isEmployeeTeamLeader(employee);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);

    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch customer: " + error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    const body = await request.json();

    const updateData: any = {};
    if (body.firmName || body.shopName) updateData.shopName = (body.firmName || body.shopName).trim();
    if (body.gstPanNo !== undefined) updateData.gstPanNo = String(body.gstPanNo).trim().toUpperCase();
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.visitingCardUrl !== undefined) updateData.visitingCardUrl = body.visitingCardUrl;
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson;

    if (body.businessType) {
      const admin = await getAdminSession(request);
      if (!admin) {
        return NextResponse.json(
          { error: "Permission Denied: Only Admin/Super Admin is allowed to change the Type of Business of an existing customer." },
          { status: 403 }
        );
      }
      const bType = String(body.businessType).trim().toUpperCase();
      updateData.businessType = bType;
      if (bType !== "RETAILER WITH SPECIAL DISCOUNT") {
        updateData.specialDiscount = 0;
      }
    }

    if (body.specialDiscount !== undefined) {
      updateData.specialDiscount = Math.max(0, parseFloat(body.specialDiscount) || 0);
    }

    if (body.contactPersons) {
      updateData.contactPersons = typeof body.contactPersons === "string" ? body.contactPersons : JSON.stringify(body.contactPersons);
    }

    if (body.allocatedEmployeeId !== undefined) {
      updateData.allocatedEmployeeId = body.allocatedEmployeeId ? parseInt(body.allocatedEmployeeId, 10) : null;
    }
    if (body.allocatedEmployeeName !== undefined) {
      updateData.allocatedEmployeeName = body.allocatedEmployeeName ? String(body.allocatedEmployeeName).trim() : null;
    }

    // Check Super Admin permission for modifying creditDays
    if (body.creditDays !== undefined) {
      const admin = await getAdminSession(request);
      const isSuperAdmin = admin?.isSuperAdmin || false;

      if (isSuperAdmin) {
        updateData.creditDays = parseInt(body.creditDays, 10) || 0;
      } else {
        const existing = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { creditDays: true },
        });
        const requestedVal = parseInt(body.creditDays, 10) || 0;
        if (existing && existing.creditDays !== requestedVal) {
          return NextResponse.json(
            { error: "Permission Denied: Only Super Admin can modify Customer Credit Days." },
            { status: 403 }
          );
        }
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update customer: " + error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);

    // Check if customer has orders
    const orderCount = await prisma.order.count({
      where: { customerId },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete customer with ${orderCount} existing order(s)` },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete customer: " + error.message }, { status: 500 });
  }
}
