import { NextRequest, NextResponse } from "next/server";
import { getNextOrderNumber, getNextTaxInvoiceNumber } from "@/lib/order-numbers";

export async function GET(request: NextRequest) {
  try {
    const nextOrderNumber = await getNextOrderNumber();
    const nextTaxInvoiceNumber = await getNextTaxInvoiceNumber();

    return NextResponse.json({
      nextOrderNumber,
      nextTaxInvoiceNumber,
    });
  } catch (error: any) {
    console.error("Error fetching next numbers:", error);
    return NextResponse.json(
      { error: "Failed to calculate next numbers: " + error.message },
      { status: 500 }
    );
  }
}
