import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch product: " + error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id, 10);
    const body = await request.json();

    const pcs = body.pcsPerSet
      ? parseInt(body.pcsPerSet, 10)
      : body.sizesList
      ? body.sizesList.split(",").length
      : 5;

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: body.name,
        category: body.category,
        colorsAvailable: body.colorsAvailable,
        sizesRatio: body.sizesRatio,
        sizesList: body.sizesList,
        pcsPerSet: pcs,
        price: parseFloat(body.price) || 0,
        setsColorwise: body.setsColorwise,
        sizeGuide: body.sizeGuide,
        imageUrl: body.imageUrl,
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
