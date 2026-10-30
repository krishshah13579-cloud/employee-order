"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";
import { useToast } from "@/components/ui/Toast";

export interface EmployeeSession {
  id: number;
  name: string;
  designation: string;
  isTeamLeader?: boolean;
  canEditOrders?: boolean;
  canUpdateStock?: boolean;
  canAddPreviousBills?: boolean;
  mobileNumber?: string;
  email?: string;
  address?: string;
}

interface EmployeeContextType {
  employee: EmployeeSession | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<{ success: boolean; error?: string }>;
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
    async (name: string, pin: string): Promise<{ success: boolean; error?: string }> => {
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
          return { success: true };
        } else {
          return { success: false, error: data.error || "Login failed" };
        }
      } catch (err: any) {
        return { success: false, error: err.message || "Network error during login" };
      }
    },
    []
  );

  return (
    <EmployeeContext.Provider value={{ employee, loading, login, logout, refreshSession }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export default EmployeeProvider;
