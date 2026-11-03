"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_STORAGE_KEY = "iq_admin_last_active_timestamp";
const THROTTLE_INTERVAL_MS = 10 * 1000; // 10 seconds

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(pathname !== "/admin/login");
  const isLoggingOutRef = useRef(false);
  const lastThrottleRef = useRef(0);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecking(false);
      return;
    }

    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/auth/check", { cache: "no-store" });
        const data = await res.json();
        if (!data.authenticated) {
          router.replace("/admin/login");
        } else {
          setChecking(false);
        }
      } catch {
        router.replace("/admin/login");
      }
    };

    verifyAuth();
  }, [pathname, router]);

  // 30-minute Inactivity Monitor for Admin Portal
  useEffect(() => {
    if (pathname === "/admin/login" || checking) return;

    const triggerInactivityLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        localStorage.removeItem(INACTIVITY_STORAGE_KEY);
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}

      router.replace("/admin/login?reason=inactivity");
    };

    const evaluateInactivity = () => {
      if (isLoggingOutRef.current) return;
      try {
        const storedStr = localStorage.getItem(INACTIVITY_STORAGE_KEY);
        if (!storedStr) {
          const now = Date.now();
          lastThrottleRef.current = now;
          localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
          return;
        }

        const lastActive = parseInt(storedStr, 10);
        if (isNaN(lastActive) || lastActive <= 0) {
          localStorage.setItem(INACTIVITY_STORAGE_KEY, Date.now().toString());
          return;
        }

        if (Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
          triggerInactivityLogout();
        }
      } catch {}
    };

    const recordUserActivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      if (now - lastThrottleRef.current > THROTTLE_INTERVAL_MS) {
        lastThrottleRef.current = now;
        try {
          localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
        } catch {}
      }
    };

    // Initial check and mark active
    evaluateInactivity();
    if (!isLoggingOutRef.current) {
      recordUserActivity();
    }

    const monitoredEvents = ["mousedown", "keydown", "touchstart", "scroll", "click", "mousemove"];
    monitoredEvents.forEach((ev) => window.addEventListener(ev, recordUserActivity, { passive: true }));

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        evaluateInactivity();
        if (!isLoggingOutRef.current) recordUserActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === INACTIVITY_STORAGE_KEY && event.newValue) {
        const remoteTime = parseInt(event.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastThrottleRef.current = remoteTime;
          if (Date.now() - remoteTime >= INACTIVITY_TIMEOUT_MS) {
            triggerInactivityLogout();
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    const intervalTimer = setInterval(evaluateInactivity, 15000);

    return () => {
      monitoredEvents.forEach((ev) => window.removeEventListener(ev, recordUserActivity));
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageEvent);
      clearInterval(intervalTimer);
    };
  }, [pathname, checking, router]);

  if (checking) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-xl mb-4 border border-slate-700 animate-pulse">
          <img
            src="/images/iq-logo.jpg"
            alt="IQ TROUSERS"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
          <RefreshCw size={16} className="animate-spin" />
          <span>Verifying Database Security Session...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
