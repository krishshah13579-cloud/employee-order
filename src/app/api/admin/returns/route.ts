import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-security";

// GET /api/admin/returns: List all sales return invoices
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const returns = await prisma.salesReturn.findMany({
      where: customerId ? { customerId: parseInt(customerId, 10) } : undefined,
      include: {
        customer: {
          select: {
            id: true,
            shopName: true,
            phoneNumber: true,
            city: true,
            gstPanNo: true,
          },
        },
      },
      orderBy: {
        returnDate: "desc",
      },
    });

    return NextResponse.json(returns);
  } catch (error: any) {
    console.error("Error fetching sales returns:", error);
    return NextResponse.json({ error: "Failed to fetch sales returns: " + error.message }, { status: 500 });
  }
}

// POST /api/admin/returns: Create new Return Invoice
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerId,
      orderId,
      orderNumber,
      returnDate,
      items,
      totalAmount,
      totalPcs,
      totalSets,
      reason,
      notes,
    } = body;

    const cid = parseInt(customerId, 10);
    const amt = parseFloat(totalAmount);

    if (isNaN(cid)) {
      return NextResponse.json({ error: "Please select a valid customer" }, { status: 400 });
    }

    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: "Return invoice credit amount must be greater than 0" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: cid },
      select: { id: true, shopName: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Generate Return Invoice Number: R-01, R-02... Re-using deleted sequences via gap-finding
    const existingReturns = await prisma.salesReturn.findMany({
      select: { returnNumber: true },
    });
    const usedSeqs = new Set<number>();
    for (const ret of existingReturns) {
      const match = (ret.returnNumber || "").match(/^R-(\d+)$/i);
      if (match) {
        usedSeqs.add(parseInt(match[1], 10));
      }
    }
    let seq = 1;
    while (usedSeqs.has(seq)) {
      seq++;
    }
    const returnNumber = `R-${String(seq).padStart(2, "0")}`;

    const itemsJson = typeof items === "string" ? items : JSON.stringify(items || []);

    const salesReturn = await prisma.salesReturn.create({
      data: {
        returnNumber,
        customerId: cid,
        customerName: customer.shopName,
        orderId: orderId ? parseInt(orderId, 10) : null,
        orderNumber: orderNumber?.trim() || null,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        totalAmount: amt,
        totalPcs: parseInt(totalPcs, 10) || 0,
        totalSets: parseInt(totalSets, 10) || 0,
        items: itemsJson,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    // Add returned items back to product stock (mixPcs)
    try {
      const parsedItems = Array.isArray(items)
        ? items
        : typeof items === "string"
        ? JSON.parse(items || "[]")
        : [];

      for (const item of parsedItems) {
        const pcs =
          Number(item.totalPcs || item.pcs || item.quantity) ||
          (Number(item.totalSets || item.sets || 0) * (Number(item.pcsPerSet) || 5));
        const pId = item.productId ? parseInt(item.productId, 10) : null;
        if (pId && pcs > 0) {
          await prisma.product.update({
            where: { id: pId },
            data: {
              mixPcs: { increment: pcs },
            },
          });
        }
      }
    } catch (err) {
      console.error("Error adding returned items back to stock:", err);
    }

    return NextResponse.json(salesReturn, { status: 201 });
  } catch (error: any) {
    console.error("Error creating sales return:", error);
    return NextResponse.json({ error: "Failed to create sales return: " + error.message }, { status: 500 });
  }
}

// DELETE /api/admin/returns: Delete a return invoice
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const rid = parseInt(id || "", 10);

    if (isNaN(rid)) {
      return NextResponse.json({ error: "Invalid return ID" }, { status: 400 });
    }

    const existingReturn = await prisma.salesReturn.findUnique({
      where: { id: rid },
    });

    if (existingReturn && existingReturn.items) {
      try {
        const parsedItems = JSON.parse(existingReturn.items);
        if (Array.isArray(parsedItems)) {
          for (const item of parsedItems) {
            const pcs =
              Number(item.totalPcs || item.pcs || item.quantity) ||
              (Number(item.totalSets || item.sets || 0) * (Number(item.pcsPerSet) || 5));
            const pId = item.productId ? parseInt(item.productId, 10) : null;
            if (pId && pcs > 0) {
              const prod = await prisma.product.findUnique({
                where: { id: pId },
                select: { mixPcs: true },
              });
              if (prod) {
                const newMix = Math.max(0, (prod.mixPcs || 0) - pcs);
                await prisma.product.update({
                  where: { id: pId },
                  data: { mixPcs: newMix },
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error deducting returned pcs on return deletion:", err);
      }
    }

    await prisma.salesReturn.delete({
      where: { id: rid },
    });

    return NextResponse.json({ success: true, message: "Sales return invoice deleted" });
  } catch (error: any) {
    console.error("Error deleting sales return:", error);
    return NextResponse.json({ error: "Failed to delete sales return: " + error.message }, { status: 500 });
  }
}
