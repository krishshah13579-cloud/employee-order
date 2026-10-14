import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { isNightLogoutTimeIST } from "@/lib/time";

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Check if after 9:00 PM IST - expire session immediately
    if (isNightLogoutTimeIST()) {
      cookieStore.delete("garmentpro_emp_session");
      return NextResponse.json({
        authenticated: false,
        nightLogout: true,
        message: "Employee portal is closed for the day (Daily logout after 9:00 PM IST).",
      });
    }

    const sessionCookie = cookieStore.get("garmentpro_emp_session");

    if (!sessionCookie?.value) {
      return NextResponse.json({ authenticated: false });
    }

    let session: any = null;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({ authenticated: false });
    }

    if (!session?.id) {
      return NextResponse.json({ authenticated: false });
    }

    // Verify against DB
    const employee = await prisma.employee.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        designation: true,
        mobileNumber: true,
        isActive: true,
      },
    });

    if (!employee || !employee.isActive) {
      cookieStore.delete("garmentpro_emp_session");
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      employee,
    });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error.message });
  }
}
