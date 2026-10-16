import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);

    if (admin) {
      return NextResponse.json({
        authenticated: true,
        user: { username: admin.username, isSuperAdmin: admin.isSuperAdmin },
      });
    }

    return NextResponse.json({ authenticated: false });
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, error: error.message });
  }
}
