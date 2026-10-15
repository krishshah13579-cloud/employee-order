import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    const updateData: any = {
      shopName: body.firmName || body.shopName,
      gstPanNo: body.gstPanNo,
      address: body.address,
      city: body.city !== undefined ? body.city : undefined,
      state: body.state !== undefined ? body.state : undefined,
      phoneNumber: body.phoneNumber,
      visitingCardUrl: body.visitingCardUrl,
      contactPerson: body.contactPerson,
    };

    if (body.businessType) {
      updateData.businessType = String(body.businessType).trim().toUpperCase();
    }

    if (body.contactPersons) {
      updateData.contactPersons = typeof body.contactPersons === "string" ? body.contactPersons : JSON.stringify(body.contactPersons);
    }

    // Check Super Admin permission for modifying creditDays
    if (body.creditDays !== undefined) {
      const sessionCookie = request.cookies.get("iq_admin_session");
      let isSuperAdmin = false;
      if (sessionCookie?.value) {
        try {
          const decoded = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString("utf-8"));
          if (decoded?.username === "krishshah13579@gmail.com") {
            isSuperAdmin = true;
          }
        } catch {}
      }

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
            { error: "Permission Denied: Only Super Admin (krishshah13579@gmail.com) can modify Customer Credit Days." },
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
