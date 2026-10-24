import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";
import { verifyToken } from "@/lib/auth-security";

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("garmentpro_emp_session");

    if (!sessionCookie?.value) {
      // Check if user is logged in via Admin Panel (iq_admin_session)
      const adminCookie = cookieStore.get("iq_admin_session");
      if (adminCookie?.value) {
        const decodedAdmin = verifyToken<{ username: string; id?: number }>(adminCookie.value);
        if (decodedAdmin?.username) {
          const adminAccount = await prisma.adminAccount.findUnique({
            where: { username: decodedAdmin.username },
            select: { id: true, username: true },
          });
          if (adminAccount) {
            return NextResponse.json({
              authenticated: true,
              isAdmin: true,
              employee: {
                id: 0,
                name: adminAccount.username || "Super Admin",
                email: "admin@iqtrousers.com",
                designation: "Super Administrator",
                isTeamLeader: true,
                canEditOrders: true,
                mobileNumber: "",
                isActive: true,
              },
            });
          }
        }
      }
      return NextResponse.json({ authenticated: false });
    }

    const session = verifyToken<{ id: number; name: string }>(sessionCookie.value);

    if (!session?.id) {
      cookieStore.delete("garmentpro_emp_session");
      return NextResponse.json({ authenticated: false });
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
