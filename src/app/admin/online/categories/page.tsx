import { prisma } from "@/lib/prisma";
import CategoriesManager from "./CategoriesManager";

export const metadata = {
  title: "Categories Management | IQ Trousers Admin",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCategoriesPage() {
  let categories: any[] = [];
  try {
    categories = await prisma.ecommerceCategory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  } catch (error) {
    console.error("Failed to query categories in AdminCategoriesPage:", error);
    categories = [];
  }

  // Serialize dates for Client Component
  const serialized = categories.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return <CategoriesManager initialCategories={serialized} />;
}
