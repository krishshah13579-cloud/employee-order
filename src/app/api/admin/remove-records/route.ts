import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { restoreSetsToStock } from "@/lib/stock";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: "GO-261018-001" },
          { orderNumber: "GO-261018-002" },
        ],
      },
      include: {
        items: true,
      },
    });

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        OR: [
          { invoiceNumber: "INV-261018-001" },
          { invoiceNumber: "INV-261018-002" },
          { orderNumber: "GO-261018-001" },
          { orderNumber: "GO-261018-002" },
        ],
      },
    });

    return NextResponse.json({
      orders,
      invoices,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const targetOrderNumbers = ["GO-261018-001", "GO-261018-002"];
    const targetInvoiceNumbers = ["INV-261018-001", "INV-261018-002"];

    // 1. Fetch Orders with Items
    const orders = await prisma.order.findMany({
      where: {
        orderNumber: { in: targetOrderNumbers },
      },
      include: {
        items: true,
      },
    });

    const restoredProducts: { productId: number; restoredSets: any[] }[] = [];

    // 2. Restore Stock for each Order
    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        const productItemsMap = new Map<number, { color: string; sets: number; ratio?: string }[]>();

        for (const item of order.items) {
          if (!productItemsMap.has(item.productId)) {
            productItemsMap.set(item.productId, []);
          }

          let colorSetsList: { color: string; sets: number }[] = [];
          try {
            if (typeof item.colorSets === "string") {
              colorSetsList = JSON.parse(item.colorSets);
            } else if (Array.isArray(item.colorSets)) {
              colorSetsList = item.colorSets;
            }
          } catch {
            colorSetsList = [];
          }

          if (Array.isArray(colorSetsList) && colorSetsList.length > 0) {
            for (const cs of colorSetsList) {
              const numSets = parseInt(String(cs.sets), 10) || 0;
              if (numSets > 0 && cs.color) {
                productItemsMap.get(item.productId)!.push({
                  color: cs.color,
                  sets: numSets,
                  ratio: item.sizeRatio,
                });
              }
            }
          } else if (item.totalSets > 0) {
            productItemsMap.get(item.productId)!.push({
              color: "Standard",
              sets: item.totalSets,
              ratio: item.sizeRatio,
            });
          }
        }

        for (const [productId, returnedSets] of productItemsMap.entries()) {
          if (returnedSets.length === 0) continue;
          const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, setsColorwise: true },
          });

          if (product && product.setsColorwise && product.setsColorwise.trim() !== "") {
            const updatedStock = restoreSetsToStock(product.setsColorwise, returnedSets);
            await prisma.product.update({
              where: { id: productId },
              data: { setsColorwise: updatedStock },
            });
            restoredProducts.push({ productId, restoredSets: returnedSets });
          }
        }
      }

      // Delete Order
      await prisma.order.delete({
        where: { id: order.id },
      });
    }

    // 3. Delete Sales Invoices
    const deletedInvoices = await prisma.salesInvoice.deleteMany({
      where: {
        OR: [
          { invoiceNumber: { in: targetInvoiceNumbers } },
          { orderNumber: { in: targetOrderNumbers } },
        ],
      },
    });

    // 4. Delete any matching payment entries linked to these invoices
    await prisma.payment.deleteMany({
      where: {
        referenceNo: { in: [...targetInvoiceNumbers, ...targetOrderNumbers] },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully removed orders (${orders.map((o) => o.orderNumber).join(", ")}), invoices, and restored inventory stock.`,
      deletedOrdersCount: orders.length,
      deletedInvoicesCount: deletedInvoices.count,
      restoredProducts,
    });
  } catch (error: any) {
    console.error("Error removing records:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
