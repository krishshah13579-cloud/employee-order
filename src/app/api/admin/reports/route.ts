import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";
import { PAST_INVOICES_1_TO_39 } from "@/lib/pastInvoicesData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lookup map for historical bills 1 to 39 to ensure their original invoice dates (July, Aug, Sept) are always exact
const pastInvoiceDateMap = new Map<string, string>();
for (const p of PAST_INVOICES_1_TO_39) {
  pastInvoiceDateMap.set(String(p.invoiceNumber).trim(), p.date);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // "1" - "12" or "all"
    const yearParam = searchParams.get("year");   // e.g. "2026"
    const statusParam = searchParams.get("status"); // "all" or specific status

    const now = new Date();
    const currentYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();

    // Query non-cancelled orders
    const where: any = {
      status: statusParam && statusParam !== "all" ? statusParam : { not: "Cancelled" },
    };

    const allOrders = await prisma.order.findMany({
      where,
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

    // Resolve accurate invoice date for each order
    interface ProcessedOrder {
      order: typeof allOrders[0];
      effectiveDate: Date;
    }

    const resolvedOrders: ProcessedOrder[] = allOrders.map((o) => {
      // 1. Check if order corresponds to historical invoice 1-39
      const invNum = (o.taxInvoiceNumber || "").trim();
      const histDateStr = invNum ? pastInvoiceDateMap.get(invNum) : undefined;

      let effectiveDate: Date;
      if (histDateStr) {
        effectiveDate = new Date(histDateStr);
      } else if (o.taxInvoiceDate) {
        effectiveDate = new Date(o.taxInvoiceDate);
      } else if (o.orderDate) {
        effectiveDate = new Date(o.orderDate);
      } else {
        effectiveDate = new Date(o.createdAt);
      }

      return {
        order: o,
        effectiveDate,
      };
    });

    // Filter by year and month using effective invoice date
    const filteredByDate = resolvedOrders.filter(({ effectiveDate }) => {
      const orderYear = effectiveDate.getFullYear();
      if (yearParam && orderYear !== currentYear) {
        return false;
      }

      if (monthParam && monthParam !== "all") {
        const targetMonth = parseInt(monthParam, 10); // 1-12
        const orderMonth = effectiveDate.getMonth() + 1; // 1-12
        if (orderMonth !== targetMonth) {
          return false;
        }
      }

      return true;
    });

    // Sort by effective invoice date descending
    filteredByDate.sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());

    // Calculate aggregated metrics
    let totalRevenue = 0;
    let totalSets = 0;
    let totalPcs = 0;
    let retailerOrdersCount = 0;
    let wholesalerOrdersCount = 0;
    let retailerRevenue = 0;
    let wholesalerRevenue = 0;

    const formattedOrders = filteredByDate.map(({ order: o, effectiveDate }) => {
      const bType = o.businessType || o.customer?.businessType || "RETAILER";
      const isWholesaler = bType === "WHOLESALER" || bType === "WHOLESALER WITHOUT GST";
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
        taxInvoiceNumber: o.taxInvoiceNumber,
        date: effectiveDate.toISOString(),
        createdAt: effectiveDate.toISOString(),
        taxInvoiceDate: o.taxInvoiceDate ? o.taxInvoiceDate.toISOString() : effectiveDate.toISOString(),
        orderDate: o.orderDate ? o.orderDate.toISOString() : effectiveDate.toISOString(),
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
        totalOrders: filteredByDate.length,
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
