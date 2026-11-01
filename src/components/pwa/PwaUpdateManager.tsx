"use client";

import { useEffect, useRef } from "react";

/**
 * PwaUpdateManager:
 * Ensures the installed PWA and web app always stay 100% synchronized with the live server.
 * On detecting any new deployment or website update, it clears stale caches and automatically reloads.
 */
export default function PwaUpdateManager() {
  const currentVersionRef = useRef<string | null>(null);
  const isReloadingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let checkInterval: NodeJS.Timeout | null = null;
    let registration: ServiceWorkerRegistration | null = null;

    // Helper to reload safely once
    const triggerAutoReload = async () => {
      if (isReloadingRef.current) return;
      isReloadingRef.current = true;

      try {
        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }
      } catch (e) {
        console.warn("[PWA] Cache clearing warning:", e);
      }

      console.log("[PWA] Website update detected! Automatically reloading to live version...");
      window.location.reload();
    };

    // Check version with live server
    const checkServerVersion = async () => {
      try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const serverVersion = String(data.version || "");

          if (!currentVersionRef.current) {
            currentVersionRef.current = serverVersion;
            sessionStorage.setItem("obexa_app_version", serverVersion);
          } else if (serverVersion && currentVersionRef.current !== serverVersion) {
            console.log(`[PWA] New version detected: ${currentVersionRef.current} -> ${serverVersion}`);
            currentVersionRef.current = serverVersion;
            sessionStorage.setItem("obexa_app_version", serverVersion);
            await triggerAutoReload();
          }
        }
      } catch (err) {
        // Network offline or temporary hiccup
      }
    };

    // Service Worker registration & lifecycle listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        triggerAutoReload();
      });

      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          registration = reg;

          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          reg.addEventListener("updatefound", () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener("statechange", () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  installingWorker.postMessage({ type: "SKIP_WAITING" });
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    const storedVersion = sessionStorage.getItem("obexa_app_version");
    if (storedVersion) {
      currentVersionRef.current = storedVersion;
    }
    checkServerVersion();

    const handleFocus = () => {
      if (registration) {
        registration.update().catch(() => {});
      }
      checkServerVersion();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (registration) {
          registration.update().catch(() => {});
        }
        checkServerVersion();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    checkInterval = setInterval(() => {
      if (registration) {
        registration.update().catch(() => {});
      }
      checkServerVersion();
    }, 45000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  return null;
}
