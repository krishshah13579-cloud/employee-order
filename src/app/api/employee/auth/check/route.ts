import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";
import { verifyToken } from "@/lib/auth-security";

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("garmentpro_emp_session");

    // Do NOT automatically log in as Super Admin without a valid session!
    // Super Admin login is only granted when access was explicitly initiated through Admin Panel (/api/admin/open-store)
    if (!sessionCookie?.value) {
      return NextResponse.json({ authenticated: false });
    }

    const session = verifyToken<{ id: number; name: string; isAdmin?: boolean }>(sessionCookie.value);

    if (session?.id === undefined || session === null) {
      cookieStore.delete("garmentpro_emp_session");
      return NextResponse.json({ authenticated: false });
    }

    // If session is for Super Admin (delegated access from Admin Panel)
    if (session.id === 0 || session.isAdmin) {
      // Confirm that the underlying Admin session is still valid
      const adminCookie = cookieStore.get("iq_admin_session");
      if (!adminCookie?.value) {
        cookieStore.delete("garmentpro_emp_session");
        return NextResponse.json({ authenticated: false });
      }

      const decodedAdmin = verifyToken<{ username: string; id?: number }>(adminCookie.value);
      if (!decodedAdmin?.username) {
        cookieStore.delete("garmentpro_emp_session");
        return NextResponse.json({ authenticated: false });
      }

      return NextResponse.json({
        authenticated: true,
        isAdmin: true,
        employee: {
          id: 0,
          name: session.name || decodedAdmin.username || "Super Admin",
          email: "admin@iqtrousers.com",
          designation: "Super Administrator",
          isTeamLeader: true,
          canEditOrders: true,
          canUpdateStock: true,
          canAddPreviousBills: true,
          mobileNumber: "",
          isActive: true,
        },
      });
    }

    // Verify against DB
    const employee = await prisma.employee.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        designation: true,
        isTeamLeader: true,
        canEditOrders: true,
        canUpdateStock: true,
        canAddPreviousBills: true,
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
        canAddPreviousBills: Boolean(employee.canAddPreviousBills || isTL),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error.message });
  }
}
