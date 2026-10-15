import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
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
        isTeamLeader: true,
        mobileNumber: true,
        isActive: true,
      },
    });

    if (!employee || !employee.isActive) {
      cookieStore.delete("garmentpro_emp_session");
      return NextResponse.json({ authenticated: false });
    }

    const isTL = isEmployeeTeamLeader(employee);

    // If NOT Team Leader and after 9:00 PM IST - expire session immediately
    // Team Leaders (T.L.) have unrestricted 24*7 access!
    if (!isTL && isNightLogoutTimeIST()) {
      cookieStore.delete("garmentpro_emp_session");
      return NextResponse.json({
        authenticated: false,
        nightLogout: true,
        message: "Employee portal is closed for the day (Daily logout after 9:00 PM IST).",
      });
    }

    return NextResponse.json({
      authenticated: true,
      employee: {
        ...employee,
        isTeamLeader: isTL,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error.message });
  }
}
