import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: any = {};
    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { shopName: { contains: term } },
        { gstPanNo: { contains: term } },
        { phoneNumber: { contains: term } },
        { contactPerson: { contains: term } },
        { address: { contains: term } },
        { city: { contains: term } },
        { state: { contains: term } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: { orders: true },
        },
      },
      orderBy: {
        shopName: "asc",
      },
    });

    return NextResponse.json(customers);
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const finalShopName = (body.firmName || body.shopName || body.name || body.company || "").trim();
    const finalPhone = (body.phoneNumber || body.phone || "").trim();
    const finalAddress = (body.address || "").trim();
    const finalCity = (body.city || "").trim();
    const finalState = (body.state || "").trim();
    const finalContact = (body.contactPerson || body.name || "").trim();
    const gstPanNo = (body.gstPanNo || "N/A").trim().toUpperCase();
    const visitingCardUrl = body.visitingCardUrl || null;

    if (!finalShopName || !finalPhone) {
      return NextResponse.json(
        { error: "Firm Name / Shop Name and Phone Number are mandatory" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        shopName: finalShopName,
        gstPanNo: gstPanNo,
        address: finalAddress || "Direct Delivery",
        city: finalCity || null,
        state: finalState || null,
        phoneNumber: finalPhone,
        visitingCardUrl: visitingCardUrl,
        contactPerson: finalContact || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer: " + error.message },
      { status: 500 }
    );
  }
}
