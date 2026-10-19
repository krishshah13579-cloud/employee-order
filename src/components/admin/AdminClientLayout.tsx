"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AdminSidebarNav from "./AdminSidebarNav";
import AdminTopHeader from "./AdminTopHeader";

export default function AdminClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-close drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock background scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-zinc-50/70 flex flex-col md:flex-row antialiased selection:bg-zinc-900 selection:text-white">
      {/* Desktop Sidebar (Fixed left navigation) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200/90 shrink-0 flex-col h-screen sticky top-0 z-20 print:hidden">
        <AdminSidebarNav />
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 print:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white z-50 md:hidden shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col print:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <AdminSidebarNav onItemClick={() => setMobileMenuOpen(false)} />
      </aside>

      {/* Main Admin View Area (Pure Admin Content) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen print:min-h-0 print:block">
        <div className="print:hidden">
          <AdminTopHeader
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
            mobileMenuOpen={mobileMenuOpen}
          />
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto print:p-0 print:m-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
