import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reserveColorSets } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, employeeName, productId, color, sets } = body;

    if (!sessionId || !productId || !color || typeof sets !== "number") {
      return NextResponse.json(
        { error: "sessionId, productId, color, and numeric sets are required" },
        { status: 400 }
      );
    }

    const pId = parseInt(String(productId), 10);
    const product = await prisma.product.findUnique({
      where: { id: pId },
      select: {
        id: true,
        setsColorwise: true,
        colorMapping: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const result = await reserveColorSets(
      sessionId,
      employeeName,
      product.id,
      color,
      sets,
      product.setsColorwise,
      product.colorMapping
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Error reserving stock:", err);
    return NextResponse.json(
      { error: "Failed to reserve stock: " + err.message },
      { status: 500 }
    );
  }
}
