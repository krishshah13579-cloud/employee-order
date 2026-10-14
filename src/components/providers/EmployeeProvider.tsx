"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface EmployeeSession {
  id: number;
  name: string;
  designation: string;
  mobileNumber?: string;
}

interface EmployeeContextType {
  employee: EmployeeSession | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
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

  // Initialize from localStorage & verify via API
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // Fast local check
        const cached = localStorage.getItem("garmentpro_employee");
        if (cached && isMounted) {
          try {
            setEmployee(JSON.parse(cached));
          } catch {}
        }

        // Backend cookie validation
        const res = await fetch("/api/employee/auth/check", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.employee && isMounted) {
            setEmployee(data.employee);
            localStorage.setItem("garmentpro_employee", JSON.stringify(data.employee));
            localStorage.setItem("garmentpro_employee_name", data.employee.name);
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
  }, []);

  // Login handler
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

  // Logout handler
  const logout = useCallback(async () => {
    try {
      await fetch("/api/employee/auth/logout", { method: "POST" });
    } catch {}
    setEmployee(null);
    localStorage.removeItem("garmentpro_employee");
    router.replace("/login");
  }, [router]);

  return (
    <EmployeeContext.Provider value={{ employee, loading, login, logout }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export default EmployeeProvider;
