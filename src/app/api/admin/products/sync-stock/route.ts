import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, getEmployeeSession } from "@/lib/auth-security";
import { ensureDbSchema } from "@/lib/ensure-db-schema";
import { getProductAllImages } from "@/lib/utils";
import { getTotalAvailableSets } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    const employee = await getEmployeeSession(req);

    if (!admin && !employee) {
      return NextResponse.json({ error: "Unauthorized. Please log in as admin or employee." }, { status: 401 });
    }

    await ensureDbSchema();

    // 1. Fetch all wholesale products
    const products = await prisma.product.findMany();

    // 2. Fetch default category for e-commerce store
    let defaultCat = await prisma.ecommerceCategory.findFirst();
    if (!defaultCat) {
      defaultCat = await prisma.ecommerceCategory.create({
        data: {
          name: "Formal & Casual Trousers",
          slug: "formal-casual-trousers",
          description: "Premium handcrafted trousers for all occasions.",
        },
      });
    }

    const standardWashGuide =
      "Machine wash cold (30°C) with like colors. Gentle cycle. Do not bleach. Line dry in shade. Warm iron inside-out. Dry clean compatible.";
    const standardDesc =
      "Premium quality handcrafted formal & casual trousers tailored for perfection, superior stretch, all-day comfort, and refined silhouette.";

    let syncedCount = 0;

    for (const prod of products) {
      // Calculate total stock pieces
      const totalSets = getTotalAvailableSets(prod.setsColorwise);
      const mixPcs = prod.mixPcs || 0;
      const pcsPerSet = prod.pcsPerSet || 5;
      const totalStockPcs = totalSets * pcsPerSet + mixPcs;

      // Extract all gallery images; fallback to single image or high-res apparel placeholder
      const imagesList = getProductAllImages(prod.imageUrl);
      if (imagesList.length === 0) {
        imagesList.push("https://images.unsplash.com/photo-1542272604-780c96856592?w=800");
      }

      const activeWashGuide = prod.washGuide && prod.washGuide.trim() !== "" ? prod.washGuide.trim() : standardWashGuide;
      const activeDesc = prod.description && prod.description.trim() !== "" ? prod.description.trim() : standardDesc;

      // Ensure wholesale product has washGuide and description saved
      if (!prod.washGuide || !prod.description) {
        await prisma.product.update({
          where: { id: prod.id },
          data: {
            washGuide: activeWashGuide,
            description: activeDesc,
          },
        });
      }

      // Generate or find slug for E-Commerce store
      const slugBase = prod.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "") || `prod-${prod.id}`;

      const colList = (prod.colorsAvailable || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const szList = (prod.sizesList || "30, 32, 34, 36, 38")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Build variant inventory mapping
      const inventoryMap: Record<string, number> = {};
      const approxPerVariant = Math.max(1, Math.floor(totalStockPcs / Math.max(1, colList.length * szList.length)));
      for (const col of colList) {
        for (const sz of szList) {
          inventoryMap[`${col}-${sz}`] = totalStockPcs > 0 ? approxPerVariant : 0;
        }
      }

      const retailPrice = prod.retailerPrice || prod.price || 490;
      const comparePrice = prod.mrp && prod.mrp > 0 ? prod.mrp : Math.round(retailPrice * 1.5);

      const existingEcomm = await prisma.ecommerceProduct.findFirst({
        where: {
          OR: [{ slug: slugBase }, { name: prod.name.trim() }],
        },
      });

      if (existingEcomm) {
        await prisma.ecommerceProduct.update({
          where: { id: existingEcomm.id },
          data: {
            name: prod.name.trim(),
            description: activeDesc,
            careInstructions: activeWashGuide,
            price: retailPrice,
            comparePrice: comparePrice,
            images: JSON.stringify(imagesList),
            sizes: JSON.stringify(szList),
            colors: JSON.stringify(colList),
            inventory: JSON.stringify(inventoryMap),
            sizeGuide: prod.sizeGuide || "",
            stock: totalStockPcs,
            active: prod.isActive,
          },
        });
      } else {
        let finalSlug = slugBase;
        let cnt = 1;
        while (await prisma.ecommerceProduct.findUnique({ where: { slug: finalSlug } })) {
          finalSlug = `${slugBase}-${cnt}`;
          cnt++;
        }

        await prisma.ecommerceProduct.create({
          data: {
            name: prod.name.trim(),
            slug: finalSlug,
            description: activeDesc,
            careInstructions: activeWashGuide,
            price: retailPrice,
            comparePrice: comparePrice,
            images: JSON.stringify(imagesList),
            sizes: JSON.stringify(szList),
            colors: JSON.stringify(colList),
            inventory: JSON.stringify(inventoryMap),
            categoryId: defaultCat.id,
            sizeGuide: prod.sizeGuide || "",
            stock: totalStockPcs,
            featured: false,
            active: prod.isActive,
            createdAt: new Date(),
          },
        });
      }

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      count: syncedCount,
      message: `Stock & product details synchronized successfully for ${syncedCount} products across Employee, Admin, and E-commerce store!`,
    });
  } catch (error: any) {
    console.error("Error in sync-stock:", error);
    return NextResponse.json({ error: "Failed to sync stock: " + error.message }, { status: 500 });
  }
}
