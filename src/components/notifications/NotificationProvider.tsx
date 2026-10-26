"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

export interface LiveNotification {
  id: string;
  type: "ARTICLE" | "ORDER_STATUS" | "ORDER_PLACED" | "CUSTOMER";
  title: string;
  subtitle: string;
  timestamp: string | Date;
  link: string;
  badgeColor: string;
}

interface NotificationContextType {
  notifications: LiveNotification[];
  unreadCount: number;
  loading: boolean;
  permission: NotificationPermission;
  isStandalone: boolean;
  requestPermission: () => Promise<boolean>;
  markAllAsRead: () => void;
  refreshNotifications: () => Promise<void>;
  isTrayOpen: boolean;
  setIsTrayOpen: (open: boolean) => void;
  isInstallGuideOpen: boolean;
  setIsInstallGuideOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  permission: "default",
  isStandalone: false,
  requestPermission: async () => false,
  markAllAsRead: () => {},
  refreshNotifications: async () => {},
  isTrayOpen: false,
  setIsTrayOpen: () => {},
  isInstallGuideOpen: false,
  setIsInstallGuideOpen: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);

  const lastSeenIdRef = useRef<string | null>(null);
  const initializedRef = useRef<boolean>(false);

  // Check standalone mode (PWA on iOS / Android)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isIosStandalone = (window.navigator as any).standalone === true;
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      setIsStandalone(Boolean(isIosStandalone || isDisplayStandalone));

      if ("Notification" in window) {
        setPermission(Notification.permission);
      }

      // Register PWA service worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration failed:", err);
          });
      }

      lastSeenIdRef.current = localStorage.getItem("iq_last_seen_notification_id");
    }
  }, []);

  // Request browser & iPhone notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast("Notifications not supported in this browser", "error");
      return false;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") {
        toast("Live iPhone & WebApp alerts enabled!", "success");
        try {
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification("IQ TROUSERS Wholesale", {
              body: "Live alerts are now active for orders, status updates, and new articles!",
              icon: "/apple-touch-icon.png",
              badge: "/apple-touch-icon.png",
            });
          } else {
            new Notification("IQ TROUSERS Wholesale", {
              body: "Live alerts are now active for orders, status updates, and new articles!",
              icon: "/apple-touch-icon.png",
            });
          }
        } catch {}
        return true;
      } else {
        toast("Notification permissions were not granted", "error");
        return false;
      }
    } catch {
      return false;
    }
  }, [toast]);

  // Fetch live notifications
  const fetchLiveNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/live", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;

      const data = await res.json();
      const list: LiveNotification[] = data.notifications || [];
      setNotifications(list);

      if (list.length === 0) return;

      const storedLastSeen = lastSeenIdRef.current || localStorage.getItem("iq_last_seen_notification_id");

      // Calculate unread count
      if (!storedLastSeen) {
        setUnreadCount(Math.min(list.length, 5));
      } else {
        const lastIdx = list.findIndex((n) => n.id === storedLastSeen);
        const count = lastIdx === -1 ? list.length : lastIdx;
        setUnreadCount(count);
      }

      // If initialized, check if a brand-new notification arrived
      if (initializedRef.current && storedLastSeen && list.length > 0) {
        const topItem = list[0];
        if (topItem.id !== storedLastSeen) {
          // Trigger in-app toast
          toast(topItem.title, "info");

          // Trigger System Push Notification on iPhone / iPad / Desktop if granted
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(topItem.title, {
                  body: topItem.subtitle,
                  icon: "/apple-touch-icon.png",
                  badge: "/apple-touch-icon.png",
                  data: { url: topItem.link },
                });
              } else {
                new Notification(topItem.title, {
                  body: topItem.subtitle,
                  icon: "/apple-touch-icon.png",
                });
              }
            } catch (err) {
              console.warn("Push trigger failed:", err);
            }
          }
        }
      }

      initializedRef.current = true;
    } catch (err) {
      console.warn("Failed to fetch live notifications:", err);
    }
  }, [toast]);

  // Initial fetch and interval poll (every 20s)
  useEffect(() => {
    fetchLiveNotifications();
    const interval = setInterval(fetchLiveNotifications, 20000);

    const handleFocus = () => {
      fetchLiveNotifications();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [fetchLiveNotifications]);

  const markAllAsRead = useCallback(() => {
    if (notifications.length > 0) {
      const topId = notifications[0].id;
      lastSeenIdRef.current = topId;
      localStorage.setItem("iq_last_seen_notification_id", topId);
    }
    setUnreadCount(0);
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        permission,
        isStandalone,
        requestPermission,
        markAllAsRead,
        refreshNotifications: fetchLiveNotifications,
        isTrayOpen,
        setIsTrayOpen,
        isInstallGuideOpen,
        setIsInstallGuideOpen,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
