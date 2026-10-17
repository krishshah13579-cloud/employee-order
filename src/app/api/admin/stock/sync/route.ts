import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth-security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call external storefront API server-to-server to avoid browser CORS restrictions
    const storefrontRes = await fetch(
      "https://iq-trousers-store-uge4.vercel.app/api/sync-stock",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
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
