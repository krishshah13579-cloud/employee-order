import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    let profile = await prisma.adminProfile.findFirst();
    if (!profile) {
      profile = await prisma.adminProfile.create({
        data: {
          fullName: "Rajesh V. Shah",
          email: "admin@garmentpro.com",
          phone: "+91 98250 12345",
          companyName: "GarmentPro Texfab Wholesalers",
          gstNo: "24AAACG1234F1Z8",
          panNo: "AAACG1234F",
          address: "Shop No. 412-415, 4th Floor, Millennium Textile Market-2, Ring Road, Surat, Gujarat - 395002",
          bankName: "State Bank of India",
          accountNo: "302948571029",
          ifscCode: "SBIN0004050",
          notes: "Wholesale Garments Manufacturer & Supplier across India.",
        },
      });
    }
    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    let profile = await prisma.adminProfile.findFirst();

    if (!profile) {
      profile = await prisma.adminProfile.create({
        data: body,
      });
    } else {
      profile = await prisma.adminProfile.update({
        where: { id: profile.id },
        data: {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone,
          companyName: body.companyName,
          gstNo: body.gstNo,
          panNo: body.panNo,
          address: body.address,
          bankName: body.bankName,
          accountNo: body.accountNo,
          ifscCode: body.ifscCode,
          notes: body.notes,
        },
      });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
