"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isNightLogoutTimeIST, isEmployeeTeamLeader } from "@/lib/time";

export interface EmployeeSession {
  id: number;
  name: string;
  designation: string;
  isTeamLeader?: boolean;
  canEditOrders?: boolean;
  mobileNumber?: string;
  email?: string;
  address?: string;
}

interface EmployeeContextType {
  employee: EmployeeSession | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: (reason?: string) => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType>({
  employee: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
});

export const useEmployee = () => useContext(EmployeeContext);

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
            setEmployee(parsed);
          } catch {}
        }

        // Backend cookie validation (backend enforces night logout for non-T.L. staff)
        const res = await fetch("/api/employee/auth/check", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.employee && isMounted) {
            setEmployee(data.employee);
            localStorage.setItem("garmentpro_employee", JSON.stringify(data.employee));
            localStorage.setItem("garmentpro_employee_name", data.employee.name);
          } else if (data.nightLogout && isMounted) {
            setEmployee(null);
            localStorage.removeItem("garmentpro_employee");
            localStorage.removeItem("garmentpro_employee_name");
            logout("night_logout");
          } else if (isMounted) {
            setEmployee(null);
            localStorage.removeItem("garmentpro_employee");
          }
        } else if (isMounted) {
          setEmployee(null);
          localStorage.removeItem("garmentpro_employee");
        }
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
  }, [logout]);

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
    <EmployeeContext.Provider value={{ employee, loading, login, logout }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export default EmployeeProvider;
