import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ORDER_STATUSES, OrderStatus } from "@/lib/types";
import { restoreSetsToStock, deductSetsFromStock } from "@/lib/stock";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values are: ${ORDER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (status === "Confirmed") {
      const sessionCookie = request.cookies.get("iq_admin_session");
      let isAdmin = false;
      if (sessionCookie?.value) {
        try {
          const decoded = JSON.parse(Buffer.from(sessionCookie.value, "base64").toString("utf-8"));
          if (decoded?.username) {
            const admin = await prisma.adminAccount.findUnique({
              where: { username: decoded.username },
            });
            if (admin) isAdmin = true;
          }
        } catch {}
      }

      if (!isAdmin) {
        return NextResponse.json(
          { error: "Permission Denied: Only Admin or Super Admin can confirm orders." },
          { status: 403 }
        );
      }
    }

    // Fetch existing order with items to handle stock adjustment
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 1. If cancelling order, restore stock sets back to inventory
    if (status === "Cancelled" && existingOrder.status !== "Cancelled") {
      for (const item of existingOrder.items) {
        if (item.productId && item.colorSets) {
          try {
            const parsed = JSON.parse(item.colorSets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, setsColorwise: true },
              });
              if (product && product.setsColorwise) {
                const restored = restoreSetsToStock(product.setsColorwise, parsed);
                await prisma.product.update({
                  where: { id: product.id },
                  data: { setsColorwise: restored },
                });
              }
            }
          } catch (e) {
            console.error("Error restoring stock sets on cancellation:", e);
          }
        }
      }
    }

    // 2. If un-cancelling order, re-deduct stock
    if (existingOrder.status === "Cancelled" && status !== "Cancelled") {
      for (const item of existingOrder.items) {
        if (item.productId && item.colorSets) {
          try {
            const parsed = JSON.parse(item.colorSets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { id: true, setsColorwise: true },
              });
              if (product && product.setsColorwise) {
                const deducted = deductSetsFromStock(product.setsColorwise, parsed);
                await prisma.product.update({
                  where: { id: product.id },
                  data: { setsColorwise: deducted },
                });
              }
            }
          } catch (e) {
            console.error("Error re-deducting stock sets:", e);
          }
        }
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: "Failed to update order status: " + error.message }, { status: 500 });
  }
}
