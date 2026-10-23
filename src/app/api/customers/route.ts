import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendNewCustomerNotification } from "@/lib/email";
import { cookies } from "next/headers";
import { getAdminSession, getEmployeeSession, verifyToken, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const allocatedToQuery = searchParams.get("allocatedTo") || searchParams.get("employeeId");

    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);
    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);

    const where: any = {};
    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { shopName: { contains: term } },
        { gstPanNo: { contains: term } },
        { phoneNumber: { contains: term } },
        { contactPerson: { contains: term } },
        { address: { contains: term } },
        { city: { contains: term } },
        { state: { contains: term } },
      ];
    }

    // Role-based Customer Isolation:
    // "IF THERE IS ANY NEW EMPLOYEE AND NO CUSTOMERS ARE ALLOCATED DO NOT SHOW ANY CUSTOMERS PRESENT IN THE CUSTOMERS TAB."
    // "DONT SHOW OTHER EMPLOYEES DATA IN THAT EMPLOYEES PORTAL. FOR EG. KRISH SHAH USER DATA IS SHOWN IN YASH RAVAL (NOT ALLOWED)."
    // "JUST TEAM LEADER CAN HAVE A LOOK I.E. KRISH SHAH NO OTHER T.L. CAN CHECK ANY OTHER EMPLOYEES DATA."
    if (!admin && !isTLKrishShah) {
      if (employee) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { allocatedEmployeeId: employee.id },
              { allocatedEmployeeName: { equals: employee.name, mode: "insensitive" } },
            ],
          },
        ];
      } else {
        // Unknown or missing employee session
        return NextResponse.json([]);
      }
    } else if (allocatedToQuery && allocatedToQuery.trim() !== "") {
      const queryEmpId = parseInt(allocatedToQuery.trim(), 10);
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            ...(isNaN(queryEmpId) ? [] : [{ allocatedEmployeeId: queryEmpId }]),
            { allocatedEmployeeName: { equals: allocatedToQuery.trim(), mode: "insensitive" } },
          ],
        },
      ];
    }

    const fullCard = searchParams.get("full_card") === "1";

    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        shopName: true,
        gstPanNo: true,
        businessType: true,
        creditDays: true,
        specialDiscount: true,
        address: true,
        city: true,
        state: true,
        phoneNumber: true,
        contactPerson: true,
        contactPersons: true,
        allocatedEmployeeId: true,
        allocatedEmployeeName: true,
        createdAt: true,
        updatedAt: true,
        visitingCardUrl: fullCard,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: {
        shopName: "asc",
      },
    });

    return NextResponse.json(customers);
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const finalShopName = (body.firmName || body.shopName || body.name || body.company || "").trim();
    const finalPhone = (body.phoneNumber || body.phone || "").trim();
    const finalAddress = (body.address || "").trim();
    const finalCity = (body.city || "").trim();
    const finalState = (body.state || "").trim();
    const finalContact = (body.contactPerson || body.name || "").trim();
    let gstPanNo = (body.gstPanNo || "").trim().toUpperCase();
    const contactPersons = body.contactPersons ? JSON.stringify(body.contactPersons) : null;
    const visitingCardUrl = body.visitingCardUrl || null;

    if (!finalShopName || !finalPhone) {
      return NextResponse.json(
        { error: "Firm Name / Shop Name and Phone Number are mandatory" },
        { status: 400 }
      );
    }

    let rawBusinessType = (body.businessType || "").trim().toUpperCase();
    if (rawBusinessType === "RETAILER (WITHOUT GST)") rawBusinessType = "RETAILER WITHOUT GST";
    const validTypes = [
      "RETAILER",
      "RETAILER WITHOUT GST",
      "RETAILER (WITHOUT GST)",
      "WHOLESALER",
      "WHOLESALER WITHOUT GST",
      "WHOLESALE WITHOUT GST",
      "RETAILER WITH SPECIAL DISCOUNT",
    ];
    if (!rawBusinessType || !validTypes.includes(rawBusinessType)) {
      return NextResponse.json(
        { error: "Business Type is mandatory. Please select Retailer, Retailer (Without GST), Wholesaler, Wholesaler Without GST, or Retailer with Special Discount." },
        { status: 400 }
      );
    }

    const isNoGst =
      rawBusinessType === "WHOLESALER WITHOUT GST" ||
      rawBusinessType === "WHOLESALE WITHOUT GST" ||
      rawBusinessType === "RETAILER WITHOUT GST" ||
      rawBusinessType === "RETAILER (WITHOUT GST)" ||
      rawBusinessType.includes("WITHOUT GST") ||
      rawBusinessType.includes("NO GST");

    // GST/PAN is strictly mandatory EXCEPT for Without GST customers (Wholesaler or Retailer)
    if (isNoGst) {
      if (!gstPanNo || gstPanNo === "N/A") {
        gstPanNo = "URP"; // Unregistered Person / Non-GST
      }
    } else {
      if (!gstPanNo || gstPanNo === "N/A") {
        return NextResponse.json(
          { error: "GST No. / PAN No. is strictly mandatory" },
          { status: 400 }
        );
      }
    }

    const requestedSpecialDiscount = Math.max(0, parseFloat(body.specialDiscount) || 0);

    // Permission checks: Without GST and Special Discount can ONLY be created by Team Leader (T.L.) or Admin
    if (isNoGst) {
      const allowed = await canUserAssignSpecialDiscount(request);
      if (!allowed) {
        return NextResponse.json(
          { error: "Permission Denied: Only Team Leader (T.L.) or Admin can create customers Without GST." },
          { status: 403 }
        );
      }
    }

    if (requestedSpecialDiscount > 0 || rawBusinessType === "RETAILER WITH SPECIAL DISCOUNT") {
      const allowed = await canUserAssignSpecialDiscount(request);
      if (!allowed) {
        return NextResponse.json(
          { error: "Permission Denied: Only Team Leaders (T.L.) and Admins can assign Special Discount." },
          { status: 403 }
        );
      }
    }

    const businessType = rawBusinessType;
    const creditDays = parseInt(body.creditDays, 10) || 0;
    const specialDiscount = requestedSpecialDiscount;

    const customer = await prisma.customer.create({
      data: {
        shopName: finalShopName,
        gstPanNo: gstPanNo,
        businessType: businessType,
        creditDays: creditDays,
        specialDiscount: specialDiscount,
        address: finalAddress || "Direct Delivery",
        city: finalCity || null,
        state: finalState || null,
        phoneNumber: finalPhone,
        visitingCardUrl: visitingCardUrl,
        contactPerson: finalContact || null,
        contactPersons: contactPersons,
      },
    });

    // Send immediate email notification alert to admin (non-blocking)
    sendNewCustomerNotification({
      shopName: customer.shopName,
      gstPanNo: customer.gstPanNo,
      phoneNumber: customer.phoneNumber,
      contactPerson: customer.contactPerson || undefined,
      city: customer.city || undefined,
      state: customer.state || undefined,
      address: customer.address || undefined,
    }).catch((err) => console.error("Customer email notification background error:", err));

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer: " + error.message },
      { status: 500 }
    );
  }
}
