import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { isNightLogoutTimeIST } from "@/lib/time";

export async function POST(req: NextRequest) {
  try {
    // Check daily after 9:00 PM IST working hours restriction
    if (isNightLogoutTimeIST()) {
      return NextResponse.json(
        {
          error:
            "Employee portal is closed for the day (Daily logout after 9:00 PM IST). Access will resume tomorrow morning.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = (body.name || "").trim();
    const pin = (body.pin || "").trim();

    if (!name || !pin) {
      return NextResponse.json(
        { error: "Employee Name and Security PIN are required." },
        { status: 400 }
      );
    }

    // Find all active employees to match name case-insensitively
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
    });

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "No employee accounts found in the database. Please ask the Administrator to register your employee account from the Admin Panel." },
        { status: 401 }
      );
    }

    const employee = employees.find(
      (e) => e.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (!employee) {
      return NextResponse.json(
        { error: `No active employee found matching "${name}". Please check the name or contact admin.` },
        { status: 401 }
      );
    }

    if (employee.pin !== pin) {
      return NextResponse.json(
        { error: "Incorrect PIN entered. Please try again." },
        { status: 401 }
      );
    }

    // Set employee session cookie
    const sessionData = {
      id: employee.id,
      name: employee.name,
      designation: employee.designation,
      mobileNumber: employee.mobileNumber,
      loggedInAt: new Date().toISOString(),
    };

    const cookieStore = await cookies();
    cookieStore.set("garmentpro_emp_session", JSON.stringify(sessionData), {
      httpOnly: false, // Accessible to client for instant reactive state
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        designation: employee.designation,
        mobileNumber: employee.mobileNumber,
      },
      message: `Welcome, ${employee.name}!`,
    });
  } catch (error: any) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      { error: "Login failed: " + error.message },
      { status: 500 }
    );
  }
}
