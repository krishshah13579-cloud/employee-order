import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";
import { signToken, verifyPassword, hashPassword } from "@/lib/auth-security";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
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
      await recordAuditLog({
        action: "EMPLOYEE_LOGIN_FAILED",
        actorType: "EMPLOYEE",
        actorName: name,
        entityType: "Employee",
        details: `No active employee matching "${name}"`,
        ipAddress: ip,
        status: "FAILURE",
      });
      return NextResponse.json(
        { error: `No active employee found matching "${name}". Please check the name or contact admin.` },
        { status: 401 }
      );
    }

    const isPinValid = verifyPassword(pin, employee.pin);
    if (!isPinValid) {
      await recordAuditLog({
        action: "EMPLOYEE_LOGIN_FAILED",
        actorType: "EMPLOYEE",
        actorName: employee.name,
        entityType: "Employee",
        entityId: employee.id,
        details: "Incorrect PIN entered",
        ipAddress: ip,
        status: "FAILURE",
      });
      return NextResponse.json(
        { error: "Incorrect PIN entered. Please try again." },
        { status: 401 }
      );
    }

    // Seamless zero-downtime auto-upgrade: hash PIN with scrypt if still in plaintext
    if (!employee.pin.startsWith("scrypt:")) {
      try {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { pin: hashPassword(pin) },
        });
      } catch (err) {
        console.warn("Failed to auto-upgrade employee PIN hash:", err);
      }
    }

    const isTL = isEmployeeTeamLeader(employee);

    // If NOT Team Leader, check daily after 9:00 PM IST working hours restriction
    // Team Leaders (T.L.) have unrestricted 24*7 access!
    if (!isTL && isNightLogoutTimeIST()) {
      return NextResponse.json(
        {
          error:
            "Employee portal is closed for the day (Daily logout after 9:00 PM IST). Access will resume tomorrow morning. (Team Leaders have 24*7 access).",
        },
        { status: 403 }
      );
    }

    // Set cryptographically signed employee session cookie (HMAC-SHA256)
    const sessionToken = signToken({
      id: employee.id,
      name: employee.name,
      loggedInAt: new Date().toISOString(),
    }, 60 * 60 * 24 * 30); // 30 days

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    const cookieStore = await cookies();
    cookieStore.set("garmentpro_emp_session", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    await recordAuditLog({
      action: "EMPLOYEE_LOGIN_SUCCESS",
      actorType: "EMPLOYEE",
      actorName: employee.name,
      entityType: "Employee",
      entityId: employee.id,
      details: `Employee authenticated successfully${isTL ? " [Team Leader]" : ""}`,
      ipAddress: ip,
      status: "SUCCESS",
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        address: employee.address,
        designation: employee.designation,
        isTeamLeader: isTL,
        canEditOrders: employee.canEditOrders,
        mobileNumber: employee.mobileNumber,
      },
      message: `Welcome, ${employee.name}!${isTL ? " (T.L. 24*7 Access Active)" : ""}`,
    });
  } catch (error: any) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      { error: "Login failed: " + error.message },
      { status: 500 }
    );
  }
}
