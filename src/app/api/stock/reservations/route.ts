import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getEffectiveStock } from "@/lib/reservations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdStr = searchParams.get("productId");
    const sessionId = searchParams.get("sessionId") || "anonymous";

    if (!productIdStr) {
      return NextResponse.json({ error: "productId parameter is required" }, { status: 400 });
    }

    const productId = parseInt(productIdStr, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        setsColorwise: true,
        colorMapping: true,
        colorsAvailable: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const stock = await getEffectiveStock(
      product.id,
      product.setsColorwise,
      product.colorMapping,
      product.colorsAvailable,
      sessionId
    );

    return NextResponse.json({ stock }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err: any) {
    console.error("Error fetching stock reservations:", err);
    return NextResponse.json(
      { error: "Failed to fetch stock reservations: " + err.message },
      { status: 500 }
    );
  }
}
