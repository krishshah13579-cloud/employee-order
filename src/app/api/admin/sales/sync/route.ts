import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-security";
import { syncExistingConfirmedOrdersToSales } from "@/lib/sales";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await syncExistingConfirmedOrdersToSales();
    return NextResponse.json({
      success: true,
      message: "Confirmed orders synced to Sales Invoices successfully.",
    });
  } catch (error: any) {
    console.error("Manual sales sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync orders: " + error.message },
      { status: 500 }
    );
  }
}
