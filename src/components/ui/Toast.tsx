"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

/* ─── Toast Types ────────────────────────── */
interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

/* ─── Toast Provider ─────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    // Detect mobile, fold device, tablet, or installed WebApp (PWA standalone mode)
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      const isMobileTabletOrFold =
        window.innerWidth <= 1024 ||
        /iphone|ipad|ipod|android|mobile|tablet|fold/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);

      if (isStandalone || isMobileTabletOrFold) {
        // Trigger native device notification instead of web toast
        if ("Notification" in window) {
          const sendNativeAlert = () => {
            try {
              new Notification("IQ TROUSERS", {
                body: message,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
              });
            } catch {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready
                  .then((reg) => {
                    reg.showNotification("IQ TROUSERS", {
                      body: message,
                      icon: "/icon-192.png",
                      badge: "/icon-192.png",
                    });
                  })
                  .catch(() => {});
              }
            }
          };

          if (Notification.permission === "granted") {
            sendNativeAlert();
          } else if (Notification.permission === "default") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") sendNativeAlert();
            });
          }
        }
        // Do NOT show floating in-app toast on mobile, fold devices, tablets, or installed webapp
        return;
      }
    }

    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Keep only 1 notification/toast at a time on desktop
    setToasts([{ id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Container - Hidden on mobile view (< 768px/sm); desktop only */}
      <div className="hidden sm:flex fixed top-5 right-5 z-[100] flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-white rounded-xl shadow-lg border-l-4 min-w-[300px] toast-enter ${
              t.type === "error"
                ? "border-red-500"
                : t.type === "info"
                ? "border-blue-500"
                : "border-green-500"
            }`}
          >
            {t.type === "error" ? (
              <AlertCircle size={20} className="text-red-500 shrink-0" />
            ) : t.type === "info" ? (
              <Info size={20} className="text-blue-500 shrink-0" />
            ) : (
              <CheckCircle size={20} className="text-green-500 shrink-0" />
            )}
            <span className="flex-1 text-sm font-medium text-gray-800">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ─── Toaster (drop into layout) ─────────── */
export function Toaster() {
  return null; // Rendering handled by ToastProvider; this is a placeholder for the layout import
}

// Re-export for direct usage — wrap app with ToastProvider
export { ToastContext };
