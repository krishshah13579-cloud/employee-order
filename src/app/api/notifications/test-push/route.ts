import { NextRequest, NextResponse } from "next/server";
import { sendWebPushNotification } from "@/lib/web-push";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title || "🔔 IQ TROUSERS Alert Test";
    const message = body.message || "Lock-screen notifications are working properly even with app closed!";
    const role = body.role || "ALL";

    const result = await sendWebPushNotification(
      {
        title,
        body: message,
        url: "/notification",
      },
      { role: role === "ALL" ? undefined : role }
    );

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      message: `Dispatched push to ${result.sentCount} active subscriber(s).`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to dispatch test push: " + error.message },
      { status: 500 }
    );
  }
}
