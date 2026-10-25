import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    // Fetch latest 10 orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        status: true,
        createdAt: true,
        customer: {
          select: { shopName: true, phoneNumber: true },
        },
      },
    }).catch(() => []);

    // Fetch latest 10 customers
    const recentCustomers = await prisma.customer.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shopName: true,
        phoneNumber: true,
        city: true,
        createdAt: true,
      },
    }).catch(() => []);

    // Format into combined notification events
    const notifications = [
      ...recentOrders.map((o) => ({
        id: `order-${o.id}`,
        type: "order" as const,
        title: `New Order: ${o.orderNumber}`,
        subtitle: `${o.customer?.shopName || "Customer"} placed an order of ₹${o.grandTotal.toLocaleString("en-IN")}`,
        timestamp: o.createdAt,
        status: o.status,
        link: `/admin/employee/orders/${o.id}`,
      })),
      ...recentCustomers.map((c) => ({
        id: `customer-${c.id}`,
        type: "customer" as const,
        title: `New Customer: ${c.shopName}`,
        subtitle: `Registered from ${c.city || "Gujarat"}${c.phoneNumber ? ` • Ph: ${c.phoneNumber}` : ""}`,
        timestamp: c.createdAt,
        link: `/admin/employee/customers`,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      notifications: notifications.slice(0, 15),
      count: notifications.length,
    });
  } catch (error: any) {
    console.error("Failed to fetch admin notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications", details: error.message },
      { status: 500 }
    );
  }
}
