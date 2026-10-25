import { prisma } from "@/lib/prisma";
import OrderTable from "./OrderTable";


export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let orders: any[] = [];
  try {
    orders = await prisma.ecommerceOrder.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to query orders in AdminOrdersPage:", error);
    orders = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Orders
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor customer transactions, order status, and fulfillments.
        </p>
      </div>

      <OrderTable initialOrders={orders} />
    </div>
  );
}
