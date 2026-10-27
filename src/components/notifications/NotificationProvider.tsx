"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
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
  isIos: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
  playNotificationSound: () => void;
  requestPermission: () => Promise<boolean>;
  markAllAsRead: () => void;
  refreshNotifications: () => Promise<void>;
  isTrayOpen: boolean;
  setIsTrayOpen: (open: boolean) => void;
  isInstallGuideOpen: boolean;
  setIsInstallGuideOpen: (open: boolean) => void;
  activeBanner: LiveNotification | null;
  dismissBanner: () => void;
  showInAppNotification: (params: {
    title: string;
    subtitle: string;
    type?: LiveNotification["type"];
    link?: string;
  }) => void;
}

// Pure Web Audio API Synthesized Two-Tone Bell Chime (D5 -> A5)
function playSynthesizedChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // First note: High clear chime (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note: Harmonic ring (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.3, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn("Audio chime could not play:", err);
  }
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  permission: "default",
  isStandalone: false,
  isIos: false,
  soundEnabled: true,
  toggleSound: () => {},
  playNotificationSound: () => {},
  requestPermission: async () => false,
  markAllAsRead: () => {},
  refreshNotifications: async () => {},
  isTrayOpen: false,
  setIsTrayOpen: () => {},
  isInstallGuideOpen: false,
  setIsInstallGuideOpen: () => {},
  activeBanner: null,
  dismissBanner: () => {},
  showInAppNotification: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);
  const [activeBanner, setActiveBanner] = useState<LiveNotification | null>(null);

  const lastSeenIdRef = useRef<string | null>(null);
  const initializedRef = useRef<boolean>(false);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const soundEnabledRef = useRef<boolean>(true);
  soundEnabledRef.current = soundEnabled;

  const dismissBanner = useCallback(() => {
    setActiveBanner(null);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    playSynthesizedChime();
  }, []);

  const showInAppNotification = useCallback(
    ({
      title,
      subtitle,
      type = "ORDER_STATUS",
      link = "/notification",
    }: {
      title: string;
      subtitle: string;
      type?: LiveNotification["type"];
      link?: string;
    }) => {
      const newItem: LiveNotification = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        title,
        subtitle,
        timestamp: new Date().toISOString(),
        link: link || "/notification",
        badgeColor:
          type === "ARTICLE"
            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
            : type === "ORDER_STATUS"
            ? "bg-blue-100 text-blue-800 border-blue-300"
            : type === "ORDER_PLACED"
            ? "bg-amber-100 text-amber-800 border-amber-300"
            : "bg-purple-100 text-purple-800 border-purple-300",
      };

      setNotifications((prev) => [newItem, ...prev]);
      setUnreadCount((prev) => prev + 1);
      setActiveBanner(newItem);

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        setActiveBanner(null);
      }, 7000);

      if (soundEnabledRef.current) {
        playSynthesizedChime();
      }

      // Trigger system push notification if enabled
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body: subtitle,
                icon: "/apple-touch-icon.png",
                badge: "/apple-touch-icon.png",
                data: { url: link || "/notification" },
              });
            });
          } else {
            new Notification(title, {
              body: subtitle,
              icon: "/apple-touch-icon.png",
            });
          }
        } catch (e) {
          console.warn("Push trigger skipped:", e);
        }
      }
    },
    []
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("iq_sound_alerts_enabled", next ? "true" : "false");
      if (next) {
        playSynthesizedChime();
      }
      return next;
    });
  }, []);

  // Check standalone mode and device characteristics
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isIosDevice =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setIsIos(isIosDevice);

      const isIosStandalone = (window.navigator as any).standalone === true;
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      setIsStandalone(Boolean(isIosStandalone || isDisplayStandalone));

      if ("Notification" in window) {
        setPermission(Notification.permission);
      }

      const storedSound = localStorage.getItem("iq_sound_alerts_enabled");
      if (storedSound !== null) {
        setSoundEnabled(storedSound === "true");
      }

      // Register PWA service worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration skipped:", err);
          });
      }

      lastSeenIdRef.current = localStorage.getItem("iq_last_seen_notification_id");
    }
  }, []);

  // Request browser & iPhone notification permission with full cross-browser fallback
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // 1. Immediately play the chime to unlock Web Audio context on user gesture
    playSynthesizedChime();
    setSoundEnabled(true);
    localStorage.setItem("iq_sound_alerts_enabled", "true");

    if (typeof window === "undefined") return false;

    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isInstalled =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    // Case A: iPhone / iPad in regular Safari browser tab (Apple hides Notification API until added to Home Screen)
    if (isIosDevice && !isInstalled) {
      toast("Live in-app alerts & sound chime enabled!", "success");
      setIsInstallGuideOpen(true);
      return true;
    }

    // Case B: Browser does not support Notification API
    if (!("Notification" in window)) {
      toast("Live in-app alerts & sound chime are active!", "success");
      return true;
    }

    // Case C: Notification was previously blocked in browser settings
    if (Notification.permission === "denied") {
      toast(
        "Notifications are blocked in your browser settings. Please enable them in browser settings.",
        "error"
      );
      return false;
    }

    // Case D: Standard permission request (supporting both Promise and legacy Safari callback)
    try {
      let result: NotificationPermission = "default";
      try {
        const promiseResult = Notification.requestPermission();
        if (promiseResult && typeof promiseResult.then === "function") {
          result = await promiseResult;
        } else {
          result = await new Promise<NotificationPermission>((resolve) => {
            Notification.requestPermission((p) => resolve(p));
          });
        }
      } catch {
        result = await new Promise<NotificationPermission>((resolve) => {
          try {
            Notification.requestPermission((p) => resolve(p));
          } catch {
            resolve("denied");
          }
        });
      }

      setPermission(result);

      if (result === "granted") {
        toast("Push & lock-screen alerts enabled successfully!", "success");
        try {
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification("OBEXA Wholesale", {
              body: "Live alerts are now active for new articles, orders, and status updates!",
              icon: "/apple-touch-icon.png",
              badge: "/apple-touch-icon.png",
            });
          } else {
            new Notification("OBEXA Wholesale", {
              body: "Live alerts are now active for new articles, orders, and status updates!",
              icon: "/apple-touch-icon.png",
            });
          }
        } catch (err) {
          console.warn("Test push skipped:", err);
        }
        return true;
      } else {
        toast("In-app live alerts and sound are active!", "info");
        return false;
      }
    } catch (err) {
      console.warn("requestPermission error:", err);
      toast("In-app live alerts & sound are active!", "success");
      return true;
    }
  }, [toast, setIsInstallGuideOpen]);

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

      const storedLastSeen =
        lastSeenIdRef.current ||
        localStorage.getItem("iq_last_seen_notification_id");

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
          // 1. Show floating in-app banner
          setActiveBanner(topItem);
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => {
            setActiveBanner(null);
          }, 6500);

          // 2. Play synthesized chime if sound enabled
          if (soundEnabledRef.current) {
            playSynthesizedChime();
          }

          // 3. Fallback toast
          toast(topItem.title, "info");

          // 4. Trigger system push notification if granted
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
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
              console.warn("Push trigger skipped:", err);
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
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
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
        isIos,
        soundEnabled,
        toggleSound,
        playNotificationSound,
        requestPermission,
        markAllAsRead,
        refreshNotifications: fetchLiveNotifications,
        isTrayOpen,
        setIsTrayOpen,
        isInstallGuideOpen,
        setIsInstallGuideOpen,
        activeBanner,
        dismissBanner,
        showInAppNotification,
      }}
    >
      {/* Native-Style Mobile App In-Screen Notification Banner */}
      {activeBanner && (
        <div className="fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95vw] max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-[9px] flex items-center justify-center shrink-0 shadow-md">
              OBEXA
            </div>
            <Link
              href={activeBanner.link || "/notification"}
              onClick={dismissBanner}
              className="flex-1 min-w-0 cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-orange-400">
                  {activeBanner.type === "ARTICLE"
                    ? "New Article Arrival"
                    : activeBanner.type === "ORDER_STATUS"
                    ? "Order Status Update"
                    : activeBanner.type === "ORDER_PLACED"
                    ? "New Order Placed"
                    : "New Customer Added"}
                </span>
                <span className="text-[10px] text-slate-400">Just now</span>
              </div>
              <p className="font-bold text-xs sm:text-sm text-white truncate mt-0.5 group-hover:text-orange-300 transition-colors">
                {activeBanner.title}
              </p>
              <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
                {activeBanner.subtitle}
              </p>
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              className="text-slate-400 hover:text-white p-1 cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {children}
    </NotificationContext.Provider>
  );
}
