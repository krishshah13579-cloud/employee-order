import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, getEmployeeSession } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const types = await (prisma as any).accessoryType.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, types });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    const employee = await getEmployeeSession(req);
    if (!admin && (!employee || !employee.canUpdateStock)) {
      return NextResponse.json({ error: "Permission Denied: Stock update access required." }, { status: 403 });
    }

    const body = await req.json();
    const { name } = body;
    const cleanName = (name || "").trim();

    if (!cleanName) {
      return NextResponse.json({ error: "Type name is required" }, { status: 400 });
    }

    const created = await (prisma as any).accessoryType.upsert({
      where: { name: cleanName },
      update: {},
      create: { name: cleanName },
    });

    return NextResponse.json({ success: true, type: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    const employee = await getEmployeeSession(req);
    if (!admin && (!employee || !employee.canUpdateStock)) {
      return NextResponse.json({ error: "Permission Denied: Stock update access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const id = parseInt(searchParams.get("id") || "", 10);

    if (name) {
      await (prisma as any).accessoryType.deleteMany({
        where: { name: name.trim() },
      });
      return NextResponse.json({ success: true, message: `Type "${name}" deleted.` });
    }

    if (!isNaN(id) && id > 0) {
      await (prisma as any).accessoryType.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: "Type deleted." });
    }

    return NextResponse.json({ error: "Type name or ID is required" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
