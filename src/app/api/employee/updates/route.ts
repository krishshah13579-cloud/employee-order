import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEmployeeSession, getAdminSession } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  try {
    const isEmployee = await getEmployeeSession(req);
    const isAdmin = !isEmployee ? await getAdminSession(req) : null;

    if (!isEmployee && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    // Fetch the 15 most recently updated orders
    const orders = await prisma.order.findMany({
      take: 15,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        grandTotal: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch(() => []);

    return NextResponse.json({
      success: true,
      orders,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Employee updates polling error:", error);
    return NextResponse.json(
      { error: "Failed to fetch updates: " + error.message },
      { status: 500 }
    );
  }
}
