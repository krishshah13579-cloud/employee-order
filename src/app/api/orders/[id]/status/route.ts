import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ORDER_STATUSES, OrderStatus } from "@/lib/types";

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
