import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // "1" - "12" or "all"
    const yearParam = searchParams.get("year");   // e.g. "2026"
    const statusParam = searchParams.get("status"); // "all" or specific status

    const now = new Date();
    const currentYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // Build Prisma query condition
    const where: any = {
      // Exclude Cancelled orders by default unless explicitly asked for Cancelled
      status: statusParam && statusParam !== "all" ? statusParam : { not: "Cancelled" },
    };

    if (monthParam && monthParam !== "all") {
      const monthIndex = parseInt(monthParam, 10) - 1; // 0-indexed
      if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
        const startOfMonth = new Date(currentYear, monthIndex, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
        where.createdAt = {
          gte: startOfMonth,
          lte: endOfMonth,
        };
      }
    } else if (yearParam) {
      const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      where.createdAt = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: true,
                mrp: true,
                retailerPrice: true,
                wholesalerPrice: true,
                price: true,
                pcsPerSet: true,
              },
            },
          },
        },
      },
    });

    // Calculate aggregated metrics
    let totalRevenue = 0;
    let totalSets = 0;
    let totalPcs = 0;
    let retailerOrdersCount = 0;
    let wholesalerOrdersCount = 0;
    let retailerRevenue = 0;
    let wholesalerRevenue = 0;

    const formattedOrders = orders.map((o) => {
      const bType = o.businessType || o.customer?.businessType || "RETAILER";
      const isWholesaler = bType === "WHOLESALER";
      const orderRevenue = o.grandTotal || 0;

      totalRevenue += orderRevenue;
      if (isWholesaler) {
        wholesalerOrdersCount++;
        wholesalerRevenue += orderRevenue;
      } else {
        retailerOrdersCount++;
        retailerRevenue += orderRevenue;
      }

      let orderSets = 0;
      let orderPcs = 0;

      o.items.forEach((it) => {
        const sets = (it as any).totalSets || 0;
        const pcsPerSet = (it as any).pcsPerSet || it.product?.pcsPerSet || 5;
        const pcs = (it as any).totalPcs || sets * pcsPerSet;
        orderSets += sets;
        orderPcs += pcs;
        totalSets += sets;
        totalPcs += pcs;
      });

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        placedBy: o.placedBy,
        businessType: bType,
        creditDays: o.creditDays ?? o.customer?.creditDays ?? 0,
        totalAmount: o.grandTotal,
        subtotal: o.subtotal,
        gstAmount: o.gstAmount,
        notes: o.notes,
        totalSets: orderSets,
        totalPcs: orderPcs,
        itemsCount: o.items.length,
        customer: {
          id: o.customer?.id,
          shopName: o.customer?.shopName || "Unknown Customer",
          gstPanNo: o.customer?.gstPanNo || "N/A",
          phoneNumber: o.customer?.phoneNumber || "N/A",
          city: o.customer?.city || "—",
          businessType: bType,
          creditDays: o.customer?.creditDays || 0,
        },
        items: o.items.map((it) => ({
          id: it.id,
          productName: it.product?.name || "Product",
          category: it.product?.category,
          sizeRatio: it.sizeRatio,
          totalSets: it.totalSets,
          quantity: it.totalPcs,
          unitPrice: it.unitPrice,
          totalPrice: it.itemSubtotal,
          colorSets: it.colorSets,
        })),
      };
    });

    return NextResponse.json({
      summary: {
        totalOrders: orders.length,
        totalRevenue,
        totalSets,
        totalPcs,
        retailerOrdersCount,
        wholesalerOrdersCount,
        retailerRevenue,
        wholesalerRevenue,
        year: currentYear,
        month: monthParam || "all",
      },
      orders: formattedOrders,
    });
  } catch (error: any) {
    console.error("Error in reports API:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports: " + error.message },
      { status: 500 }
    );
  }
}
