"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

/* ─── Toast Types ────────────────────────── */
interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface ToastContextType {
  toast: (message: string, type?: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

/* ─── Toast Provider ─────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
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
      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-white rounded-xl shadow-lg border-l-4 min-w-[300px] toast-enter ${
              t.type === "error" ? "border-red-500" : "border-green-500"
            }`}
          >
            {t.type === "error" ? (
              <AlertCircle size={20} className="text-red-500 shrink-0" />
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
