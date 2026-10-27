import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { VAPID_PUBLIC_KEY, sendWebPushNotification } from "@/lib/web-push";

export async function GET() {
  return NextResponse.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const body = await req.json();
    const { subscription, employeeId, employeeName, role } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Invalid push subscription object." },
        { status: 400 }
      );
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys.p256dh;
    const auth = subscription.keys.auth;

    if (!p256dh || !auth) {
      return NextResponse.json(
        { error: "Push subscription keys (p256dh, auth) are missing." },
        { status: 400 }
      );
    }

    // Upsert subscription into database
    const saved = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh,
        auth,
        employeeId: employeeId ? Number(employeeId) : undefined,
        employeeName: employeeName || undefined,
        role: role || "EMPLOYEE",
        userAgent,
        ipAddress: ip,
        updatedAt: new Date(),
      },
      create: {
        endpoint,
        p256dh,
        auth,
        employeeId: employeeId ? Number(employeeId) : undefined,
        employeeName: employeeName || undefined,
        role: role || "EMPLOYEE",
        userAgent,
        ipAddress: ip,
      },
    });

    // Send an immediate test welcome push
    try {
      await sendWebPushNotification(
        {
          title: "🎉 IQ TROUSERS Push Active!",
          body: "You will now receive instant lock-screen alerts for new articles, orders, and status updates even when the app is closed.",
          url: "/notification",
        },
        { employeeId: employeeId ? Number(employeeId) : undefined }
      );
    } catch (e) {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription saved successfully.",
      id: saved.id,
    });
  } catch (error: any) {
    console.error("Save push subscription error:", error);
    return NextResponse.json(
      { error: "Failed to save push subscription: " + error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });

    return NextResponse.json({
      success: true,
      message: "Push subscription removed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to remove subscription: " + error.message },
      { status: 500 }
    );
  }
}
