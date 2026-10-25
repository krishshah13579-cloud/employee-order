import prisma from "@/lib/prisma";
import CategoriesManager, { CategoryItem } from "./CategoriesManager";

export const metadata = {
  title: "Categories Management | IQ Trousers Admin",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CATEGORIES = [
  {
    name: "EVERYDAY CASUAL",
    slug: "everyday-casual",
    description: "Comfortable stretch chinos, casual trousers, and everyday versatile wear.",
    image: null,
  },
  {
    name: "FORMAL WEAR",
    slug: "formal-wear",
    description: "Executive formal trousers, pleated & flat-front business trousers for professional elegance.",
    image: null,
  },
  {
    name: "LINEN",
    slug: "linen",
    description: "Lightweight, ultra-breathable pure linen and linen-blend summer trousers.",
    image: null,
  },
];

export default async function AdminCategoriesPage() {
  let categories: any[] = [];
  try {
    categories = await prisma.category.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (categories.length === 0) {
      for (const def of DEFAULT_CATEGORIES) {
        await prisma.category.create({
          data: def,
        });
      }
      categories = await prisma.category.findMany({
        orderBy: { createdAt: "desc" },
      });
    }
  } catch (error) {
    console.error("Failed to query categories in AdminCategoriesPage:", error);
    categories = [];
  }

  // Compute products count for each category
  const categoriesWithCount: CategoryItem[] = await Promise.all(
    categories.map(async (c) => {
      let productCount = 0;
      try {
        productCount = await prisma.product.count({
          where: { category: c.name },
        });
      } catch {}

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: c.image,
        createdAt: c.createdAt.toISOString(),
        _count: {
          products: productCount,
        },
      };
    })
  );

  return <CategoriesManager initialCategories={categoriesWithCount} />;
}
