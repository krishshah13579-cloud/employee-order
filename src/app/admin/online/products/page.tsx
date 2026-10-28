import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ProductTable from "./ProductTable";


export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  let products: any[] = [];
  try {
    // Strictly filter out any out-of-stock products (stock > 0 only)
    products = await prisma.ecommerceProduct.findMany({
      where: {
        stock: { gt: 0 },
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to query products in AdminProductsPage:", error);
    products = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Products
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your store inventory, pricing, and availability.
          </p>
        </div>
        <Link
          href="/admin/online/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </Link>
      </div>

      <ProductTable products={products} />
    </div>
  );
}
