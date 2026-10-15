import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    let where: any = {};
    if (search) {
      where = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { mobileNumber: { contains: search } },
          { address: { contains: search } },
        ],
      };
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(employees);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, mobileNumber, address, proofUrl, designation, isActive, pin } = body;

    if (!name || !mobileNumber || !address) {
      return NextResponse.json(
        { error: "Name, mobile number, and address are required" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name: name.trim(),
        email: (email || "").trim() || null,
        pin: (pin || "1234").trim(),
        mobileNumber: mobileNumber.trim(),
        address: address.trim(),
        proofUrl: proofUrl || null,
        designation: designation || "Sales Representative",
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
