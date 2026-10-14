"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(pathname !== "/admin/login");

  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecking(false);
      return;
    }

    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
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
