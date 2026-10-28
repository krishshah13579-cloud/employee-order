"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calculator,
  Boxes,
  FileText,
  Menu,
} from "lucide-react";
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
    <div className="min-h-screen print:min-h-0 bg-zinc-50/70 flex flex-col md:flex-row antialiased selection:bg-zinc-900 selection:text-white">
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
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto pb-20 md:pb-6 print:p-0 print:m-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg px-2 py-1.5 flex items-center justify-around print:hidden">
        <Link
          href="/admin/employee"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            pathname === "/admin/employee" || pathname === "/admin"
              ? "text-blue-600 font-bold bg-blue-50"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-[10px] mt-0.5">Overview</span>
        </Link>

        <Link
          href="/admin/employee/costing"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            pathname.includes("/costing")
              ? "text-blue-600 font-bold bg-blue-50"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Calculator size={18} />
          <span className="text-[10px] mt-0.5">Costing</span>
        </Link>

        <Link
          href="/admin/employee/stock"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            pathname.includes("/stock")
              ? "text-blue-600 font-bold bg-blue-50"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Boxes size={18} />
          <span className="text-[10px] mt-0.5">Stock</span>
        </Link>

        <Link
          href="/admin/employee/orders"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
            pathname.includes("/orders")
              ? "text-blue-600 font-bold bg-blue-50"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileText size={18} />
          <span className="text-[10px] mt-0.5">Orders</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer ${
            mobileMenuOpen ? "text-blue-600 font-bold bg-blue-50" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Menu size={18} />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>
      </nav>
    </div>
  );
}
