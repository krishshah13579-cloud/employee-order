import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const [recentProducts, recentOrders, recentCustomers] = await Promise.all([
      prisma.product.findMany({
        take: Math.min(limit, 30),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          category: true,
          colorsAvailable: true,
          price: true,
          createdAt: true,
          imageUrl: true,
        },
      }).catch(() => []),

      prisma.order.findMany({
        take: Math.min(limit, 40),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          grandTotal: true,
          totalSets: true,
          placedBy: true,
          createdAt: true,
          updatedAt: true,
        },
      }).catch(() => []),

      prisma.customer.findMany({
        take: Math.min(limit, 25),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shopName: true,
          city: true,
          phoneNumber: true,
          businessType: true,
          createdAt: true,
        },
      }).catch(() => []),
    ]);

    const notifications: Array<{
      id: string;
      type: "ARTICLE" | "ORDER_STATUS" | "ORDER_PLACED" | "CUSTOMER";
      title: string;
      subtitle: string;
      timestamp: Date;
      link: string;
      badgeColor: string;
    }> = [];

    // 1. New Article Arrival notifications (Admin adds product -> Employee notified)
    for (const p of recentProducts) {
      notifications.push({
        id: `article-${p.id}`,
        type: "ARTICLE",
        title: `🎉 New Article Arrival: ${p.name}`,
        subtitle: `${p.category || "Trousers"} • Colors: ${p.colorsAvailable || "Available"} • ₹${p.price}/pc`,
        timestamp: p.createdAt,
        link: `/products/${p.id}`,
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      });
    }

    // 2. Order Placed and Order Status Updates (Admin updates status -> Employee notified)
    for (const o of recentOrders) {
      const isStatusUpdated =
        o.updatedAt &&
        new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime() > 10000;

      if (isStatusUpdated || o.status.toLowerCase() !== "pending") {
        notifications.push({
          id: `order-status-${o.id}-${o.status}`,
          type: "ORDER_STATUS",
          title: `🚚 Order #${o.orderNumber} Status: ${o.status.toUpperCase()}`,
          subtitle: `${o.customerName} • ₹${o.grandTotal.toLocaleString("en-IN")} • ${o.totalSets} Sets`,
          timestamp: o.updatedAt || o.createdAt,
          link: `/orders`,
          badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
        });
      }

      notifications.push({
        id: `order-placed-${o.id}`,
        type: "ORDER_PLACED",
        title: `📦 New Order Placed: #${o.orderNumber}`,
        subtitle: `${o.customerName} • ₹${o.grandTotal.toLocaleString("en-IN")}${o.placedBy ? ` • By: ${o.placedBy}` : ""}`,
        timestamp: o.createdAt,
        link: `/orders`,
        badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      });
    }

    // 3. New Customer added notifications
    for (const c of recentCustomers) {
      notifications.push({
        id: `customer-${c.id}`,
        type: "CUSTOMER",
        title: `👤 New Customer Added: ${c.shopName}`,
        subtitle: `${c.city || "Gujarat"}${c.phoneNumber ? ` • Ph: ${c.phoneNumber}` : ""}${c.businessType ? ` • ${c.businessType}` : ""}`,
        timestamp: c.createdAt,
        link: `/visiting-customers`,
        badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
      });
    }

    // 4. Access & Security Notifications (Device Allowed/Revoked, Access Updates)
    const recentAuditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "DEVICE_REVOKED",
            "DEVICE_INVITE_SENT_WHATSAPP",
            "DEVICE_INVITE_GENERATED",
            "EMPLOYEE_PATCHED",
          ],
        },
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    for (const a of recentAuditLogs) {
      notifications.push({
        id: `audit-${a.id}`,
        type: "ORDER_STATUS",
        title: a.action.includes("REVOKED")
          ? "🔒 Security Update: Device Access Revoked"
          : "🔑 Access Update: Device Authorized",
        subtitle: a.details || "Authorization status updated by administration",
        timestamp: a.createdAt,
        link: "/notification",
        badgeColor: a.action.includes("REVOKED")
          ? "bg-red-100 text-red-800 border-red-300"
          : "bg-emerald-100 text-emerald-800 border-emerald-300",
      });
    }

    // Sort newest first
    notifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      notifications: notifications.slice(0, limit),
      count: notifications.length,
      latestTimestamp: notifications.length > 0 ? notifications[0].timestamp : null,
    });
  } catch (error: any) {
    console.error("Live notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live notifications", details: error.message },
      { status: 500 }
    );
  }
}
