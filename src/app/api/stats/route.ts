import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DashboardStats } from "@/lib/types";

export async function GET() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      todayRevenueAgg,
      pendingOrders,
      totalCustomers,
      totalEmployees,
      totalProducts,
      categoriesRaw,
      revenueAggregation,
      recentOrdersRaw,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: {
          createdAt: { gte: startOfToday },
          status: { not: "Cancelled" },
        },
      }),
      prisma.order.count({ where: { status: "Pending" } }),
      prisma.customer.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.order.aggregate({
        _sum: {
          grandTotal: true,
        },
        where: {
          status: {
            not: "Cancelled",
          },
        },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
    ]);

    const stats = {
      totalOrders,
      todayOrders,
      todayRevenue: Math.round((todayRevenueAgg._sum.grandTotal || 0) * 100) / 100,
      pendingOrders,
      totalCustomers,
      totalEmployees,
      totalProducts,
      totalCategories: categoriesRaw.length,
      categories: categoriesRaw.map((c) => c.name),
      totalRevenue: Math.round((revenueAggregation._sum.grandTotal || 0) * 100) / 100,
      recentOrders: recentOrdersRaw.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName || (order.customer ? order.customer.shopName : "Unknown"),
        customerGstPan: order.customerGstPan || (order.customer ? order.customer.gstPanNo : "—"),
        customerPhone: order.customerPhone || (order.customer ? order.customer.phoneNumber : "—"),
        status: order.status,
        subtotal: order.subtotal,
        gstAmount: order.gstAmount,
        grandTotal: order.grandTotal,
        totalPcs: order.totalPcs,
        totalSets: order.totalSets,
        orderDate: order.orderDate ? order.orderDate.toISOString() : order.createdAt.toISOString(),
        items: order.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          sizeRatio: it.sizeRatio,
          sizesList: it.sizesList,
          pcsPerSet: it.pcsPerSet,
          colorSets: it.colorSets,
          totalSets: it.totalSets,
          totalPcs: it.totalPcs,
          unitPrice: it.unitPrice,
          itemSubtotal: it.itemSubtotal,
        })),
      })),
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats: " + error.message },
      { status: 500 }
    );
  }
}
