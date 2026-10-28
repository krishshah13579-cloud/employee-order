"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import EmployeeWelcomeBreadcrumb from "@/components/layout/EmployeeWelcomeBreadcrumb";
import MobilePhoneNavbar from "@/components/layout/MobilePhoneNavbar";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { Loader2 } from "lucide-react";

export default function StoreLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { employee, loading } = useEmployee();

  const isAdminRoute = pathname?.startsWith("/admin");
  const isLoginPage = pathname === "/login";

  // Redirect unauthenticated employee to /login
  useEffect(() => {
    if (!isAdminRoute && !isLoginPage && !loading && !employee) {
      router.replace("/login");
    }
  }, [isAdminRoute, isLoginPage, loading, employee, router]);

  // Ensure Employee Portal PWA manifest and meta tags are active for "OBEXA"
  useEffect(() => {
    if (!isAdminRoute && typeof window !== "undefined") {
      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (link) {
        link.href = "/manifest.json";
      }
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
      if (appleTitle) {
        appleTitle.content = "OBEXA";
      }
      const appName = document.querySelector('meta[name="application-name"]') as HTMLMetaElement | null;
      if (appName) {
        appName.content = "OBEXA";
      }
    }
  }, [isAdminRoute]);

  // 1. Admin panel is completely isolated with its own layout/auth
  if (isAdminRoute) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  // 2. Employee Login page renders directly without storefront header
  if (isLoginPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  // 3. While verifying session on protected employee routes, show branded loader
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/iq-trousers-logo-transparent.png"
            alt="IQ Trousers"
            width={64}
            height={64}
            className="h-16 w-auto object-contain animate-pulse"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/iq-logo.jpg";
            }}
          />
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span>Verifying Employee Access...</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Block content if not logged in
  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-2" />
        <span className="text-xs text-slate-400">Redirecting to employee login...</span>
      </div>
    );
  }

  // 5. Authenticated employee side: Navbar at top, Welcome Breadcrumb with motivation message, main body
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <div className="print:hidden">
        <Navbar />
        <EmployeeWelcomeBreadcrumb />
      </div>
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <MobilePhoneNavbar />
    </div>
  );
}
