import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, signToken } from "@/lib/auth-security";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("iq_admin_session");

    if (!adminCookie?.value) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const decoded = verifyToken<{ username: string; id?: number }>(adminCookie.value);
    if (!decoded?.username) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const adminAccount = await prisma.adminAccount.findUnique({
      where: { username: decoded.username },
      select: { id: true, username: true },
    });

    if (!adminAccount) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // Explicitly set the Super Admin employee session because access was initiated through the Admin Panel
    const sessionToken = signToken(
      {
        id: 0,
        name: adminAccount.username || "Super Admin",
        isAdmin: true,
        openedFromAdmin: true,
        loggedInAt: new Date().toISOString(),
      },
      60 * 60 * 24 * 7 // 7 days
    );

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";

    cookieStore.set("garmentpro_emp_session", sessionToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    const target = req.nextUrl.searchParams.get("target") || "/";
    // Sanitize target to prevent open redirect vulnerabilities
    const safeTarget = target.startsWith("/") && !target.startsWith("//") ? target : "/";

    return NextResponse.redirect(new URL(safeTarget, req.url));
  } catch (err) {
    console.error("open-store error:", err);
    return NextResponse.redirect(new URL("/admin", req.url));
  }
}
