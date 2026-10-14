import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("iq_admin_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ authenticated: false });
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(sessionCookie.value, "base64").toString("utf-8")
      );
      if (decoded && decoded.username) {
        const admin = await prisma.adminAccount.findUnique({
          where: { username: decoded.username },
          select: { username: true, id: true },
        });

        if (admin) {
          return NextResponse.json({
            authenticated: true,
            user: { username: admin.username },
          });
        }
      }
    } catch {
      // Cookie corrupted
    }

    return NextResponse.json({ authenticated: false });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error.message });
  }
}
