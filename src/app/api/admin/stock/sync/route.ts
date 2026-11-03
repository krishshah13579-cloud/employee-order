import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call external storefront API server-to-server with browser headers & sync secret
    const storefrontRes = await fetch(
      "https://www.iqtrousers.in/api/sync-stock",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-sync-secret":
            process.env.SYNC_STOCK_SECRET ||
            "1a08f1242cec6f7c1d19635591c516eaaea70388a1093f2c",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      }
    );

    const data = await storefrontRes.json().catch(() => null);

    if (!storefrontRes.ok || !data) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            `Storefront sync responded with status ${storefrontRes.status}`,
        },
        { status: storefrontRes.status || 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Storefront proxy sync error:", error);
    return NextResponse.json(
      { error: "Failed to connect to Storefront: " + error.message },
      { status: 500 }
    );
  }
}
