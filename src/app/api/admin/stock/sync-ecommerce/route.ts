import { NextRequest, NextResponse } from "next/server";
import { syncAllCatalogStock, syncWholesaleProductToEcommerce } from "@/lib/stock-sync";
import { requireAdmin } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const body = await req.json().catch(() => ({}));
    const { productId } = body;

    if (productId) {
      const res = await syncWholesaleProductToEcommerce(Number(productId));
      return NextResponse.json({ success: true, updated: res });
    }

    const results = await syncAllCatalogStock();
    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${results.length} e-commerce products with wholesale catalog`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.authorized) return auth.errorResponse!;

  try {
    const results = await syncAllCatalogStock();
    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
