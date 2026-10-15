import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DashboardStats } from "@/lib/types";
import { getTotalAvailableSets } from "@/lib/stock";

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
      activeProductsList,
      categoriesRaw,
      revenueAggregation,
      recentOrdersRaw,
    ] = await Promise.all([
      prisma.order.count().catch(() => 0),
      prisma.order.count({
        where: { createdAt: { gte: startOfToday } },
      }).catch(() => 0),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: {
          createdAt: { gte: startOfToday },
          status: { not: "Cancelled" },
        },
      }).catch(() => ({ _sum: { grandTotal: 0 } })),
      prisma.order.count({ where: { status: "Pending" } }).catch(() => 0),
      prisma.customer.count().catch(() => 0),
      prisma.employee.count({ where: { isActive: true } }).catch(() => 0),
      prisma.product.count({ where: { isActive: true } }).catch(() => 0),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, setsColorwise: true },
      }).catch(() => []),
      prisma.category.findMany({ orderBy: { name: "asc" } }).catch(() => []),
      prisma.order.aggregate({
        _sum: {
          grandTotal: true,
        },
        where: {
          status: {
            not: "Cancelled",
          },
        },
      }).catch(() => ({ _sum: { grandTotal: 0 } })),
      prisma.order.findMany({
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          customer: {
            select: {
              id: true,
              shopName: true,
              gstPanNo: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  price: true,
                },
              },
            },
          },
        },
      }).catch(() => []),
    ]);

    let inStockProductsCount = 0;
    for (const p of activeProductsList) {
      if (!p.setsColorwise || !p.setsColorwise.trim()) {
        inStockProductsCount++;
      } else {
        const total = getTotalAvailableSets(p.setsColorwise);
        if (total > 0) inStockProductsCount++;
      }
    }

    const stats = {
      totalOrders,
      todayOrders,
      todayRevenue: Math.round((todayRevenueAgg._sum.grandTotal || 0) * 100) / 100,
      pendingOrders,
      totalCustomers,
      totalEmployees,
      totalProducts,
      inStockProducts: inStockProductsCount,
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

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, max-age=4, s-maxage=8, stale-while-revalidate=20",
      },
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats: " + error.message },
      { status: 500 }
    );
  }
}
