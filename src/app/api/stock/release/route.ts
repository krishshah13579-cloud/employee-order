import { NextRequest, NextResponse } from "next/server";
import { releaseReservations } from "@/lib/reservations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, productId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const pId = productId ? parseInt(String(productId), 10) : undefined;
    await releaseReservations(sessionId, pId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error releasing reservations:", err);
    return NextResponse.json(
      { error: "Failed to release reservations: " + err.message },
      { status: 500 }
    );
  }
}
