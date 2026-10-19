import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const dwarkadhishList = await prisma.customer.findMany({
      where: {
        shopName: {
          contains: "DWARKADHISH",
        },
      },
      include: {
        orders: true,
        payments: true,
        salesReturns: true,
      },
    });

    const sheetalList = await prisma.customer.findMany({
      where: {
        OR: [
          { shopName: { contains: "EETAL" } },
          { gstPanNo: { contains: "24AJNPD8327K1ZZ" } },
        ],
      },
      include: {
        orders: true,
        payments: true,
        salesReturns: true,
      },
    });

    return NextResponse.json({
      dwarkadhishList,
      sheetalList,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. DWARKADHISH CLOTHING:
    // Find all DWARKADHISH customers
    const dwarkadhishCustomers = await prisma.customer.findMany({
      where: {
        shopName: {
          contains: "DWARKADHISH",
        },
      },
      include: {
        orders: true,
        payments: true,
        salesReturns: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    let removedFirstDwarkadhish = null;
    let retainedDwarkadhish = null;

    if (dwarkadhishCustomers.length >= 2) {
      // First one is the older one with 0 bills (or phone 8128756632)
      const firstDwarkadhish = dwarkadhishCustomers[0];
      const secondDwarkadhish = dwarkadhishCustomers[1];

      // Move any phone number or GST from first to second if second is missing them
      await prisma.customer.update({
        where: { id: secondDwarkadhish.id },
        data: {
          phoneNumber: secondDwarkadhish.phoneNumber || firstDwarkadhish.phoneNumber || "8128756632",
          gstPanNo: secondDwarkadhish.gstPanNo || firstDwarkadhish.gstPanNo || "GGLPS3886R",
        },
      });

      // Move any orders / payments from first to second if any exist
      await prisma.order.updateMany({
        where: { customerId: firstDwarkadhish.id },
        data: { customerId: secondDwarkadhish.id },
      });
      await prisma.salesInvoice.updateMany({
        where: { customerId: firstDwarkadhish.id },
        data: { customerId: secondDwarkadhish.id },
      });
      await prisma.payment.updateMany({
        where: { customerId: firstDwarkadhish.id },
        data: { customerId: secondDwarkadhish.id },
      });
      await prisma.salesReturn.updateMany({
        where: { customerId: firstDwarkadhish.id },
        data: { customerId: secondDwarkadhish.id },
      });

      // Delete the first Dwarkadhish customer
      await prisma.customer.delete({
        where: { id: firstDwarkadhish.id },
      });

      removedFirstDwarkadhish = firstDwarkadhish;
      retainedDwarkadhish = secondDwarkadhish;
    }

    // 2. SHEETAL FAMILY SHOWROOM -> Merge into SHEETAL SELECTION and remove SHEETAL FAMILY SHOWROOM
    const seetalFamily = await prisma.customer.findFirst({
      where: {
        OR: [
          { shopName: { contains: "SEETAL" } },
          { shopName: { contains: "FAMILY SHOWROOM" } },
        ],
      },
      include: {
        orders: true,
        payments: true,
        salesReturns: true,
      },
    });

    const sheetalSelection = await prisma.customer.findFirst({
      where: {
        shopName: {
          contains: "SHEETAL SELECTION",
        },
      },
      include: {
        orders: true,
        payments: true,
        salesReturns: true,
      },
    });

    let mergedSheetal = null;

    if (seetalFamily && sheetalSelection) {
      // Transfer phone number and any missing fields from SEETAL FAMILY to SHEETAL SELECTION
      await prisma.customer.update({
        where: { id: sheetalSelection.id },
        data: {
          phoneNumber: sheetalSelection.phoneNumber || seetalFamily.phoneNumber || "9898008517",
          gstPanNo: sheetalSelection.gstPanNo || seetalFamily.gstPanNo || "24AJNPD8327K1ZZ",
        },
      });

      // Reassign all orders, invoices, payments, and returns from SEETAL FAMILY to SHEETAL SELECTION
      await prisma.order.updateMany({
        where: { customerId: seetalFamily.id },
        data: {
          customerId: sheetalSelection.id,
          customerName: sheetalSelection.shopName,
        },
      });

      await prisma.salesInvoice.updateMany({
        where: { customerId: seetalFamily.id },
        data: {
          customerId: sheetalSelection.id,
          customerName: sheetalSelection.shopName,
        },
      });

      await prisma.payment.updateMany({
        where: { customerId: seetalFamily.id },
        data: {
          customerId: sheetalSelection.id,
          customerName: sheetalSelection.shopName,
        },
      });

      await prisma.salesReturn.updateMany({
        where: { customerId: seetalFamily.id },
        data: {
          customerId: sheetalSelection.id,
          customerName: sheetalSelection.shopName,
        },
      });

      // Delete SEETAL FAMILY SHOWROOM customer account
      await prisma.customer.delete({
        where: { id: seetalFamily.id },
      });

      mergedSheetal = {
        deletedCustomer: seetalFamily.shopName,
        retainedCustomer: sheetalSelection.shopName,
      };
    } else if (seetalFamily && !sheetalSelection) {
      // If only SEETAL FAMILY exists, rename it to SHEETAL SELECTION
      await prisma.customer.update({
        where: { id: seetalFamily.id },
        data: { shopName: "SHEETAL SELECTION" },
      });
      mergedSheetal = {
        renamedCustomer: "SHEETAL SELECTION",
      };
    }

    return NextResponse.json({
      success: true,
      removedFirstDwarkadhish: removedFirstDwarkadhish ? "Removed first DWARKADHISH CLOTHING account" : "Not found / already removed",
      retainedDwarkadhish: retainedDwarkadhish ? "Retained DWARKADHISH CLOTHING with bills" : null,
      mergedSheetal: mergedSheetal || "Not found / already merged",
    });
  } catch (error: any) {
    console.error("Error merging customers:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
