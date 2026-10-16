import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-security";

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

    const pcs = body.pcsPerSet
      ? parseInt(body.pcsPerSet, 10)
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

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: body.name,
        category: body.category,
        colorsAvailable: body.colorsAvailable,
        sizesRatio: body.sizesRatio,
        sizesList: body.sizesList,
        pcsPerSet: pcs,
        mrp: numMrp,
        retailerPrice: retailerPrice,
        wholesalerPrice: wholesalerPrice,
        price: retailerPrice,
        costPrice: body.costPrice !== undefined ? (body.costPrice !== null ? parseFloat(body.costPrice) : null) : undefined,
        mixPcs: body.mixPcs !== undefined ? (body.mixPcs !== null ? parseInt(body.mixPcs, 10) || 0 : 0) : undefined,
        colorImages: body.colorImages !== undefined ? (body.colorImages ? (typeof body.colorImages === "string" ? body.colorImages : JSON.stringify(body.colorImages)) : null) : undefined,
        setsColorwise: body.setsColorwise,
        sizeGuide: body.sizeGuide,
        imageUrl: body.imageUrl,
        colorMapping: body.colorMapping,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    });

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
    if (!auth.authorized) {
      return auth.errorResponse!;
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
