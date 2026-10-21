import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, getEmployeeSession, isSpecialTeamLeaderKrishShah } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";
import { sanitizePositiveInt } from "@/lib/navigation";

/**
 * GET /api/visited-customers
 * Query Params:
 *  - city: Filter by city (case-insensitive, compared in UPPERCASE)
 *  - employeeId: Filter by employee ID
 *  - search: Search text in city, shopName, phone, contactPerson, notes, employeeName
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to view visited customers." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cityFilter = searchParams.get("city")?.trim().toUpperCase();
    const employeeIdParam = searchParams.get("employeeId");
    const search = searchParams.get("search")?.trim();

    const isTLKrishShah = isSpecialTeamLeaderKrishShah(employee);

    // Build Prisma query condition
    const where: any = {};

    // 1. Portfolio / IDOR Isolation
    // If not Admin and not Team Leader Krish Shah, regular employee can only see their own visited customers
    if (!admin && !isTLKrishShah && employee) {
      where.OR = [
        { employeeId: employee.id },
        { employeeName: { equals: employee.name, mode: "insensitive" } },
      ];
    } else if (employeeIdParam) {
      const sanitizedEmpId = sanitizePositiveInt(employeeIdParam);
      if (sanitizedEmpId) {
        where.employeeId = sanitizedEmpId;
      }
    }

    // 2. City Filter (Input in CAPITAL ONLY)
    if (cityFilter && cityFilter !== "ALL" && cityFilter !== "") {
      where.city = { equals: cityFilter, mode: "insensitive" };
    }

    // 3. Search Filter
    if (search && search !== "") {
      const searchConditions = [
        { city: { contains: search, mode: "insensitive" } },
        { shopName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { employeeName: { contains: search, mode: "insensitive" } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Fetch visited customers ordered by newest first
    const visitedCustomers = await prisma.visitedCustomer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Fetch distinct cities list for the filter dropdown
    // For admins, get all cities; for employees, get their portfolio cities
    const cityScopeWhere: any = {};
    if (!admin && !isTLKrishShah && employee) {
      cityScopeWhere.OR = [
        { employeeId: employee.id },
        { employeeName: { equals: employee.name, mode: "insensitive" } },
      ];
    }

    const allRecordsForCities = await prisma.visitedCustomer.findMany({
      where: cityScopeWhere,
      select: { city: true },
    });

    // Aggregate cities with counts in strict UPPERCASE
    const cityCountMap: Record<string, number> = {};
    for (const record of allRecordsForCities) {
      const upperCity = (record.city || "").trim().toUpperCase();
      if (upperCity) {
        cityCountMap[upperCity] = (cityCountMap[upperCity] || 0) + 1;
      }
    }

    const cities = Object.keys(cityCountMap)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        count: cityCountMap[name],
      }));

    return NextResponse.json({
      visitedCustomers,
      cities,
      total: visitedCustomers.length,
    });
  } catch (error: any) {
    console.error("Error fetching visited customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch visited customers: " + error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/visited-customers
 * Body:
 *  - visitingCardUrl: string (Required)
 *  - city: string (Required, TAKEN IN CAPITAL ONLY)
 *  - shopName?: string
 *  - phone?: string
 *  - contactPerson?: string
 *  - notes?: string
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    const employee = await getEmployeeSession(request);

    if (!admin && !employee) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in to submit a visited customer." },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 1. Validate Visiting Card URL
    const visitingCardUrl = body.visitingCardUrl ? String(body.visitingCardUrl).trim() : "";
    if (!visitingCardUrl) {
      return NextResponse.json(
        { error: "Visiting card upload is required." },
        { status: 400 }
      );
    }

    // 2. Validate City Name (TAKE INPUT IN CAPITAL ONLY)
    const rawCity = body.city !== undefined && body.city !== null ? String(body.city) : "";
    const cleanCity = rawCity.trim().toUpperCase();

    if (!cleanCity) {
      return NextResponse.json(
        { error: "City name is required and must be entered in CAPITAL ONLY." },
        { status: 400 }
      );
    }

    // Sanitize optional fields
    const shopName = body.shopName ? String(body.shopName).trim().slice(0, 150) : null;
    const phone = body.phone ? String(body.phone).trim().slice(0, 30) : null;
    const contactPerson = body.contactPerson ? String(body.contactPerson).trim().slice(0, 100) : null;
    const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;
    const status = body.status && ["Visited", "Follow Up", "Converted"].includes(body.status)
      ? body.status
      : "Visited";

    // Session-bound Employee Info to prevent spoofing
    const employeeId = employee ? employee.id : null;
    const employeeName = employee ? employee.name : (admin ? (admin.username || "Admin") : "IQ Executive");

    const newRecord = await prisma.visitedCustomer.create({
      data: {
        visitingCardUrl,
        city: cleanCity, // Guaranteed CAPITAL ONLY
        shopName,
        phone,
        contactPerson,
        notes,
        employeeId,
        employeeName,
        status,
      },
    });

    // Security & Compliance Audit Log
    await recordAuditLog({
      action: "VISITED_CUSTOMER_CREATED",
      actorType: admin ? "ADMIN" : "EMPLOYEE",
      actorName: employeeName,
      entityType: "VisitedCustomer",
      entityId: newRecord.id,
      details: {
        id: newRecord.id,
        city: cleanCity,
        shopName: newRecord.shopName,
        employeeName,
      },
      status: "SUCCESS",
    });

    return NextResponse.json(
      {
        message: "Visited customer uploaded successfully with city in CAPITAL.",
        visitedCustomer: newRecord,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating visited customer:", error);
    return NextResponse.json(
      { error: "Failed to create visited customer: " + error.message },
      { status: 500 }
    );
  }
}
