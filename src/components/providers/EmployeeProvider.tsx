"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";
import { Lock, KeyRound, ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export interface EmployeeSession {
  id: number;
  name: string;
  username?: string;
  designation: string;
  isTeamLeader?: boolean;
  canEditOrders?: boolean;
  canUpdateStock?: boolean;
  canAddPreviousBills?: boolean;
  canViewOrderForm?: boolean;
  mustChangePin?: boolean;
  tasks?: any[];
  mobileNumber?: string;
  email?: string;
  address?: string;
}

interface EmployeeContextType {
  employee: EmployeeSession | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<{ success: boolean; error?: string; employee?: EmployeeSession }>;
  logout: (reason?: string) => Promise<void>;
  refreshSession: () => Promise<EmployeeSession | null>;
}

const EmployeeContext = createContext<EmployeeContextType>({
  employee: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshSession: async () => null,
});

export const useEmployee = () => useContext(EmployeeContext);

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const prevEmployeeRef = useRef<EmployeeSession | null>(null);
  const pathnameRef = useRef<string>(pathname);
  pathnameRef.current = pathname;

  // Logout handler
  const logout = useCallback(async (reason?: string) => {
    try {
      await fetch("/api/employee/auth/logout", { method: "POST" });
    } catch {}
    setEmployee(null);
    localStorage.removeItem("garmentpro_employee");
    localStorage.removeItem("garmentpro_employee_name");
    localStorage.removeItem("garmentpro_last_active_timestamp");
    const redirectUrl = reason ? `/login?reason=${encodeURIComponent(reason)}` : "/login";
    router.replace(redirectUrl);
  }, [router]);

  // Daily after 9:00 PM IST necessary logout check (Bypassed 24*7 for Team Leaders)
  useEffect(() => {
    const enforceNightLogout = () => {
      // Team Leaders (T.L.) have unrestricted 24*7 access to the employee panel
      if (isEmployeeTeamLeader(employee)) {
        return;
      }

      const cached = localStorage.getItem("garmentpro_employee");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (isEmployeeTeamLeader(parsed)) {
            return;
          }
        } catch {}
      }

      if (isNightLogoutTimeIST()) {
        if (cached || employee) {
          logout("night_logout");
        }
      }
    };

    // Check immediately on mount/render
    enforceNightLogout();

    // Check periodically every 30 seconds
    const interval = setInterval(enforceNightLogout, 30000);
    return () => clearInterval(interval);
  }, [employee, logout]);

  // 30 minutes inactivity timeout
  useEffect(() => {
    if (!employee) return;

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins
    const INACTIVITY_STORAGE_KEY = "garmentpro_last_active_timestamp";
    const THROTTLE_INTERVAL_MS = 10 * 1000;

    let isLoggingOut = false;
    let lastThrottle = 0;

    const triggerInactivityLogout = () => {
      if (isLoggingOut) return;
      isLoggingOut = true;
      try {
        localStorage.removeItem(INACTIVITY_STORAGE_KEY);
      } catch {}
      logout("inactivity");
    };

    const evaluateInactivity = () => {
      if (isLoggingOut) return;
      try {
        const storedStr = localStorage.getItem(INACTIVITY_STORAGE_KEY);
        if (!storedStr) {
          const now = Date.now();
          lastThrottle = now;
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
      if (isLoggingOut) return;
      const now = Date.now();
      if (now - lastThrottle > THROTTLE_INTERVAL_MS) {
        lastThrottle = now;
        try {
          localStorage.setItem(INACTIVITY_STORAGE_KEY, now.toString());
        } catch {}
      }
    };

    evaluateInactivity();
    if (!isLoggingOut) {
      recordUserActivity();
    }

    const monitoredEvents = ["mousedown", "keydown", "touchstart", "scroll", "click", "mousemove"];
    monitoredEvents.forEach((ev) => window.addEventListener(ev, recordUserActivity, { passive: true }));

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        evaluateInactivity();
        if (!isLoggingOut) recordUserActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === INACTIVITY_STORAGE_KEY && event.newValue) {
        const remoteTime = parseInt(event.newValue, 10);
        if (!isNaN(remoteTime)) {
          lastThrottle = remoteTime;
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
  }, [employee, logout]);

  // Function to re-verify session with database immediately (used when permissions change)
  const refreshSession = useCallback(async (): Promise<EmployeeSession | null> => {
    try {
      const res = await fetch("/api/employee/auth/check", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.employee) {
          const prev = prevEmployeeRef.current;
          const current: EmployeeSession = data.employee;

          // Check for real-time permission changes and trigger appropriate toasts
          if (prev && prev.id === current.id) {
            if (!prev.canUpdateStock && current.canUpdateStock) {
              toast("🎉 Stock Update Access Granted! You can now update garment stock.", "success");
            } else if (prev.canUpdateStock && !current.canUpdateStock) {
              toast("🔒 Stock Update Access Revoked by Administrator.", "error");
              if (pathnameRef.current === "/update-stock") {
                router.replace("/");
              }
            }
            if (!prev.canEditOrders && current.canEditOrders) {
              toast("✏️ Order Form Editing Access Approved by Administrator.", "success");
            } else if (prev.canEditOrders && !current.canEditOrders) {
              toast("🔒 Order Form Editing Access Revoked by Administrator.", "info");
            }
            if (!prev.canAddPreviousBills && current.canAddPreviousBills) {
              toast("📄 Bill Access Granted by Administrator.", "success");
            } else if (prev.canAddPreviousBills && !current.canAddPreviousBills) {
              toast("🔒 Bill Access Revoked by Administrator.", "error");
              if (pathnameRef.current === "/orders/new" && typeof window !== "undefined") {
                const url = new URL(window.location.href);
                if (url.searchParams.get("tab") === "bill" || url.searchParams.get("billType")) {
                  url.searchParams.delete("tab");
                  url.searchParams.delete("billType");
                  window.history.replaceState({}, "", url.toString());
                }
              }
            }
          }

          prevEmployeeRef.current = current;
          setEmployee(current);
          localStorage.setItem("garmentpro_employee", JSON.stringify(current));
          localStorage.setItem("garmentpro_employee_name", current.name);
          return current;
        } else if (data.nightLogout) {
          setEmployee(null);
          prevEmployeeRef.current = null;
          localStorage.removeItem("garmentpro_employee");
          localStorage.removeItem("garmentpro_employee_name");
          logout("night_logout");
          return null;
        }
      }

      setEmployee(null);
      prevEmployeeRef.current = null;
      localStorage.removeItem("garmentpro_employee");
      localStorage.removeItem("garmentpro_employee_name");
      return null;
    } catch {
      return null;
    }
  }, [logout, router, toast]);

  // Fast cross-tab real-time sync via BroadcastChannel & localStorage events
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("garmentpro_perm_channel");
      channel.onmessage = () => {
        refreshSession();
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "garmentpro_perm_sync") {
        refreshSession();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (channel) {
        try {
          channel.close();
        } catch {}
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshSession]);

  // Re-verify session whenever pathname changes or periodically every 3s to catch permission updates right away
  useEffect(() => {
    refreshSession();
  }, [pathname, refreshSession]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshSession();
    }, 3000);
    return () => clearInterval(timer);
  }, [refreshSession]);

  // Initialize from localStorage & verify via API
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // Fast local check
        const cached = localStorage.getItem("garmentpro_employee");
        if (cached && isMounted) {
          try {
            const parsed = JSON.parse(cached);
            if (pathname !== "/login" || parsed?.id !== 0) {
              setEmployee(parsed);
            }
          } catch {}
        }

        await refreshSession();
      } catch (err) {
        console.error("Session verification error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  // Login handler: Send to server to authenticate (T.L. can log in 24*7)
  const login = useCallback(
    async (name: string, pin: string): Promise<{ success: boolean; error?: string; employee?: EmployeeSession }> => {
      try {
        const res = await fetch("/api/employee/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, pin }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setEmployee(data.employee);
          localStorage.setItem("garmentpro_employee", JSON.stringify(data.employee));
          localStorage.setItem("garmentpro_employee_name", data.employee.name);
          return { success: true, employee: data.employee };
        } else {
          return { success: false, error: data.error || "Login failed" };
        }
      } catch (err: any) {
        return { success: false, error: err.message || "Network error during login" };
      }
    },
    []
  );

  // Mandatory Permanent PIN Change State (for employees with temporary PIN)
  const [newPinValue, setNewPinValue] = useState<string>("");
  const [confirmPinValue, setConfirmPinValue] = useState<string>("");
  const [showPermanentPin, setShowPermanentPin] = useState<boolean>(false);
  const [pinChangeLoading, setPinChangeLoading] = useState<boolean>(false);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);

  const handleSavePermanentPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);

    const cleanPin = newPinValue.trim();
    const cleanConfirm = confirmPinValue.trim();

    if (!cleanPin || !/^\d{4}$/.test(cleanPin)) {
      setPinChangeError("PIN must be exactly 4 numeric digits.");
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setPinChangeError("PIN confirmation does not match. Please verify.");
      return;
    }

    setPinChangeLoading(true);
    try {
      const res = await fetch("/api/employee/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: cleanPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("🎉 Permanent PIN saved successfully! Use this secret PIN for future logins.", "success");
        if (employee) {
          const updated = { ...employee, mustChangePin: false };
          setEmployee(updated);
          localStorage.setItem("garmentpro_employee", JSON.stringify(updated));
        }
        setNewPinValue("");
        setConfirmPinValue("");
      } else {
        setPinChangeError(data.error || "Failed to set permanent PIN.");
      }
    } catch (err: any) {
      setPinChangeError(err.message || "Network error. Please try again.");
    } finally {
      setPinChangeLoading(false);
    }
  };

  const showMandatoryPinModal = Boolean(
    !loading && employee && employee.id !== 0 && employee.mustChangePin
  );

  return (
    <EmployeeContext.Provider value={{ employee, loading, login, logout, refreshSession }}>
      {children}

      {/* Mandatory Permanent PIN Setup Modal */}
      {showMandatoryPinModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-orange-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-slate-100 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-500 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Set Your Permanent 4-Digit PIN
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Welcome, <strong className="text-orange-400">{employee?.name}</strong>! You are currently using a temporary PIN. Please create your permanent 4-digit security PIN to proceed.
              </p>
            </div>

            <form onSubmit={handleSavePermanentPin} className="space-y-4">
              {pinChangeError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-medium">
                  {pinChangeError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Enter New 4-Digit PIN *
                </label>
                <div className="relative">
                  <input
                    type={showPermanentPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={newPinValue}
                    onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-2xl font-mono font-bold tracking-widest text-orange-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPermanentPin(!showPermanentPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showPermanentPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm New 4-Digit PIN *
                </label>
                <input
                  type={showPermanentPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={confirmPinValue}
                  onChange={(e) => setConfirmPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-2xl font-mono font-bold tracking-widest text-orange-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                  <span>Security Notice</span>
                </div>
                <p>
                  This PIN will be your permanent login key. Keep it confidential and do not share it with anyone.
                </p>
              </div>

              <button
                type="submit"
                disabled={pinChangeLoading || newPinValue.length !== 4 || confirmPinValue.length !== 4}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pinChangeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving Permanent PIN...</span>
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Confirm & Activate Permanent PIN</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </EmployeeContext.Provider>
  );
}

export default EmployeeProvider;
