import webpush from "web-push";
import prisma from "@/lib/prisma";

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BOm9TNqONUBgqGi_ZkwAJeWPLQupnHZlGXPrX-el8DCCUevY9g2E5E2YHU2K3SXFkW7LmCCcgu0e-3VFE1bxiTo";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "3rX-DgBjqSwiXJEzXUR5L6l-uXnIGs-YKoRAp9TyPRA";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@iqtrousers.in";

// Configure web-push with VAPID details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn("[WEB-PUSH] Failed to set VAPID details:", err);
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

export interface PushTargetOptions {
  role?: "ALL" | "SUPER_ADMIN" | "TEAM_LEADER" | "EMPLOYEE";
  employeeId?: number;
}

/**
 * Dispatch real-time background lock-screen Web Push notifications
 * Reaches users even when browser / webapp is closed or phone is locked.
 */
export async function sendWebPushNotification(
  payload: WebPushPayload,
  options?: PushTargetOptions
): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  try {
    const where: any = {};
    if (options?.role && options.role !== "ALL") {
      where.role = options.role;
    }
    if (options?.employeeId) {
      where.employeeId = options.employeeId;
    }

    const subscriptions = await prisma.pushSubscription.findMany({ where });

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0, failedCount: 0 };
    }

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/apple-touch-icon.png",
      badge: payload.badge || "/apple-touch-icon.png",
      url: payload.url || "/notification",
      tag: payload.tag || `push-${Date.now()}`,
      data: {
        url: payload.url || "/notification",
        timestamp: Date.now(),
        ...(payload.data || {}),
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    const expiredIds: number[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, jsonPayload, {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          });
          sentCount++;
        } catch (err: any) {
          failedCount++;
          // If subscription is expired / revoked by browser (410 or 404), queue for deletion
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredIds.push(sub.id);
          } else {
            console.warn(`[WEB-PUSH] Error dispatching to ${sub.endpoint.slice(0, 40)}:`, err?.message || err);
          }
        }
      })
    );

    // Clean up dead/unregistered browser endpoints
    if (expiredIds.length > 0) {
      await prisma.pushSubscription
        .deleteMany({
          where: { id: { in: expiredIds } },
        })
        .catch(() => {});
    }

    return { success: true, sentCount, failedCount };
  } catch (error: any) {
    console.error("[WEB-PUSH] Global dispatch error:", error);
    return { success: false, sentCount: 0, failedCount: 0 };
  }
}
