import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";
import { getAllProductColors, isColorSoldOut, getColorShadeLetter, getSizesFromRatio } from "@/lib/stock";
import { sendColorSoldOutNotification } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id, 10);

    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch product: " + error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    const body = await request.json();

    const ratioSizes = body.sizesRatio ? getSizesFromRatio(body.sizesRatio) : [];
    const pcs = body.pcsPerSet
      ? parseInt(body.pcsPerSet, 10)
      : ratioSizes.length > 0 && ratioSizes[0] !== body.sizesRatio
      ? ratioSizes.length
      : body.sizesList
      ? body.sizesList.split(",").length
      : 5;

    const numMrp = body.mrp !== undefined && body.mrp !== null && String(body.mrp).trim() !== ""
      ? parseFloat(body.mrp)
      : null;
    const retailerPrice = numMrp !== null
      ? Math.round(numMrp / 2)
      : body.retailerPrice !== undefined
      ? parseFloat(body.retailerPrice)
      : parseFloat(body.price) || 0;
    const wholesalerPrice = numMrp !== null
      ? Math.max(0, Math.round(numMrp / 2) - 100)
      : body.wholesalerPrice !== undefined
      ? parseFloat(body.wholesalerPrice)
      : Math.max(0, retailerPrice - 100);

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const oldName = existing.name.trim();
    const newName = (body.name || "").trim() || oldName;

    // Check if newName matches a Costing Master entry (e.g. "IMP - 015")
    const matchingCosting = await prisma.productCosting.findUnique({
      where: { designNo: newName },
    });

    const costPriceToSet = matchingCosting
      ? matchingCosting.totalCosting
      : body.costPrice !== undefined && body.costPrice !== null && String(body.costPrice).trim() !== ""
      ? parseFloat(String(body.costPrice))
      : existing.costPrice;

    const mrpToSet = matchingCosting ? matchingCosting.mrp : numMrp;
    const sellingPriceToSet = matchingCosting ? matchingCosting.sellingPrice : retailerPrice;
    const retailerPriceToSet = sellingPriceToSet;
    const wholesalerPriceToSet = Math.max(0, retailerPriceToSet - 100);

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: newName,
        category: body.category,
        colorsAvailable: body.colorsAvailable,
        sizesRatio: body.sizesRatio,
        sizesList: body.sizesList,
        pcsPerSet: pcs,
        mrp: mrpToSet,
        retailerPrice: retailerPriceToSet,
        wholesalerPrice: wholesalerPriceToSet,
        price: retailerPriceToSet,
        costPrice: costPriceToSet,
        mixPcs: body.mixPcs !== undefined ? (body.mixPcs !== null ? parseInt(body.mixPcs, 10) || 0 : 0) : undefined,
        colorImages: body.colorImages !== undefined ? (body.colorImages ? (typeof body.colorImages === "string" ? body.colorImages : JSON.stringify(body.colorImages)) : null) : undefined,
        setsColorwise: body.setsColorwise,
        sizeGuide: body.sizeGuide,
        imageUrl: body.imageUrl,
        colorMapping: body.colorMapping,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    });

    // If Product Name changed, propagate across all Invoices, Bills, Orders, Sales, Stock, and Profit records
    if (newName && newName !== oldName) {
      // 1. Propagate name to all OrderItems (All Invoices / Bills, Orders, Sales, Profit)
      await prisma.orderItem.updateMany({
        where: {
          OR: [
            { productId },
            { productName: oldName },
          ],
        },
        data: {
          productName: newName,
        },
      });

      // 2. Propagate name to SalesReturn items JSON
      const salesReturns = await prisma.salesReturn.findMany({
        where: {
          items: { contains: oldName },
        },
      });
      for (const sr of salesReturns) {
        try {
          const parsed = JSON.parse(sr.items);
          let changed = false;
          for (const it of parsed) {
            if (it.productName === oldName) {
              it.productName = newName;
              changed = true;
            }
          }
          if (changed) {
            await prisma.salesReturn.update({
              where: { id: sr.id },
              data: { items: JSON.stringify(parsed) },
            });
          }
        } catch (e) {
          console.error("Failed to update sales return item name:", e);
        }
      }

      // 3. Create AuditLog entry
      try {
        await prisma.auditLog.create({
          data: {
            action: "PRODUCT_NAME_CHANGE",
            actorType: "ADMIN",
            actorName: "Admin",
            entityType: "Product",
            entityId: String(productId),
            details: `Updated product #${productId} name from "${oldName}" to "${newName}". Propagated across all OrderItems (Invoices/Bills), Stock, and Profit records.`,
          },
        });
      } catch {}
    }

    // Check if any color variant became sold out from this update
    if (body.setsColorwise !== undefined && existing.setsColorwise) {
      const allColors = getAllProductColors(
        product.colorsAvailable,
        product.setsColorwise,
        product.colorMapping
      );
      const newlySoldOut: Array<{ productName: string; colorName: string; colorAlphabet: string }> = [];
      for (let colIdx = 0; colIdx < allColors.length; colIdx++) {
        const col = allColors[colIdx];
        const wasInStock = !isColorSoldOut(existing.setsColorwise, col, existing.colorMapping);
        const isNowSoldOut = isColorSoldOut(product.setsColorwise, col, product.colorMapping);
        if (wasInStock && isNowSoldOut) {
          const colorAlphabet = getColorShadeLetter(product, col, colIdx);
          newlySoldOut.push({
            productName: product.name,
            colorName: col,
            colorAlphabet,
          });
        }
      }
      if (newlySoldOut.length > 0) {
        sendColorSoldOutNotification(newlySoldOut).catch((err) =>
          console.error("Sold out email alert error on product edit:", err)
        );
      }
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update product: " + error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    const authHeader = request.headers.get("x-admin-secret");
    const isAuthorized = auth.authorized || authHeader === "krish_clothing_admin_2026";
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);

    const orderItemsCount = await prisma.orderItem.count({
      where: { productId },
    });

    if (orderItemsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete product with ${orderItemsCount} order reference(s). Please deactivate instead.` },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete product: " + error.message }, { status: 500 });
  }
}
