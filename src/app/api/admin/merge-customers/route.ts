import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const allCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        shopName: true,
        phoneNumber: true,
        gstPanNo: true,
        city: true,
        _count: {
          select: {
            orders: true,
            salesInvoices: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    const dwarkadhishCandidates = await prisma.customer.findMany({
      where: {
        OR: [
          { gstPanNo: { contains: "GGLPS3886R" } },
          { phoneNumber: { contains: "8128756632" } },
          { shopName: { contains: "DWARKA" } },
          { shopName: { contains: "CLOTHING" } },
        ],
      },
      select: {
        id: true,
        shopName: true,
        phoneNumber: true,
        gstPanNo: true,
        city: true,
        _count: {
          select: {
            orders: true,
            salesInvoices: true,
          },
        },
      },
    });

    return NextResponse.json({ allCustomers, dwarkadhishCandidates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. DWARKADHISH CLOTHING:
    // Find the first account (having GST GGLPS3886R, phone 8128756632, or 0 bills)
    const firstDwarkadhish = await prisma.customer.findFirst({
      where: {
        OR: [
          { gstPanNo: { contains: "GGLPS3886R" } },
          { phoneNumber: { contains: "8128756632" } },
          {
            AND: [
              { shopName: { contains: "DWARKADHISH" } },
              { orders: { none: {} } },
              { salesInvoices: { none: {} } },
            ],
          },
        ],
      },
    });

    let removedFirstDwarkadhish = null;
    let retainedDwarkadhish = null;

    if (firstDwarkadhish) {
      // Find the active DWARKADHISH with the 3 bills
      const activeDwarkadhish = await prisma.customer.findFirst({
        where: {
          shopName: { contains: "DWARKADHISH" },
          id: { not: firstDwarkadhish.id },
        },
      });

      if (activeDwarkadhish) {
        // Transfer details to the retained account
        await prisma.customer.update({
          where: { id: activeDwarkadhish.id },
          data: {
            phoneNumber: activeDwarkadhish.phoneNumber || firstDwarkadhish.phoneNumber || "8128756632",
            gstPanNo: firstDwarkadhish.gstPanNo || "GGLPS3886R",
          },
        });

        // Reassign any remaining orders or invoices just in case
        await prisma.order.updateMany({
          where: { customerId: firstDwarkadhish.id },
          data: { customerId: activeDwarkadhish.id },
        });
        await prisma.salesInvoice.updateMany({
          where: { customerId: firstDwarkadhish.id },
          data: { customerId: activeDwarkadhish.id },
        });
        await prisma.payment.updateMany({
          where: { customerId: firstDwarkadhish.id },
          data: { customerId: activeDwarkadhish.id },
        });
        await prisma.salesReturn.updateMany({
          where: { customerId: firstDwarkadhish.id },
          data: { customerId: activeDwarkadhish.id },
        });

        retainedDwarkadhish = activeDwarkadhish;
      }

      await prisma.customer.delete({
        where: { id: firstDwarkadhish.id },
      });
      removedFirstDwarkadhish = firstDwarkadhish;
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
