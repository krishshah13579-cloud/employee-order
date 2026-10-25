"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";

interface AdminTopHeaderProps {
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export default function AdminTopHeader({
  onToggleMobileMenu,
  mobileMenuOpen,
}: AdminTopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const getPageTitle = () => {
    if (pathname === "/admin" || pathname === "/admin/employee") return "Wholesale Overview Dashboard";
    if (pathname === "/admin/online") return "Online Store Dashboard";
    if (pathname.startsWith("/admin/online/products")) return "Online Products Catalog";
    if (pathname.startsWith("/admin/online/categories")) return "Online Categories";
    if (pathname.startsWith("/admin/online/orders")) return "Online Store Orders";
    if (pathname.startsWith("/admin/online/discounts")) return "Online Discounts & Coupons";
    if (pathname.startsWith("/admin/online/users")) return "Online Registered Shoppers";
    if (pathname === "/admin/stock") return "Shared Inventory Control";
    if (pathname.includes("/profile")) return "Company & Admin Details";
    if (pathname.includes("/products/new")) return "Add New Wholesale Garment";
    if (pathname.includes("/products/") && pathname.endsWith("/edit")) return "Edit Wholesale Garment";
    if (pathname.includes("/products")) return "Product Catalog Management";
    if (pathname.includes("/categories")) return "Garment Categories";
    if (pathname.includes("/customers/new")) return "Add Customer Shop";
    if (pathname.includes("/customers/") && pathname.endsWith("/edit")) return "Edit Customer Shop";
    if (pathname.includes("/customers")) return "Customer Shops & Retailers";
    if (pathname.includes("/visited-customers")) return "Visited Retail Customers";
    if (pathname.includes("/employees/new")) return "Add New Employee";
    if (pathname.includes("/employees/") && pathname.endsWith("/edit")) return "Edit Employee";
    if (pathname.includes("/employees")) return "Employee Management";
    if (pathname.includes("/orders/new")) return "Book New Wholesale Order";
    if (pathname.includes("/orders/")) return "Wholesale Order Form & Invoice";
    if (pathname.includes("/invoices")) return "Final Tax Invoices (GST 5%)";
    if (pathname.includes("/bills")) return "Wholesale Bills (Without GST)";
    if (pathname.includes("/orders")) return "Wholesale Order Forms";
    if (pathname.includes("/sales")) return "Sales Register & Invoices";
    if (pathname.includes("/outstanding")) return "Customer Outstanding & Bills";
    if (pathname.includes("/ledger")) return "Print Ledger & Customer Statement";
    if (pathname.includes("/returns")) return "Sales Returns & Credits";
    if (pathname.includes("/profit")) return "Wholesale Gross Profit Breakdown";
    if (pathname.includes("/reports")) return "Sales & Financial Reports";
    if (pathname.includes("/invoice-settings")) return "Invoice & Company Configuration";
    if (pathname.includes("/whatsapp")) return "WhatsApp Business Gateway";
    if (pathname.includes("/audit")) return "System Audit Logs";
    return "Control Center";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200/90 shadow-2xs">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden p-2.5 -ml-1.5 text-gray-700 hover:text-black hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors cursor-pointer touch-manipulation shrink-0"
              aria-label="Toggle navigation menu"
              title="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Admin Panel</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </span>
            <h1 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
              {getPageTitle()}
            </h1>
          </div>
        </div>

        {/* Right: Security Badge, Admin User Pill, Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Security Status Badge */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-800">
              2FA Secured
            </span>
          </div>

          {/* Admin User Info Pill */}
          <div className="hidden sm:flex items-center gap-2.5 pl-2 pr-3 py-1 bg-zinc-900 text-white rounded-full shadow-2xs">
            <div className="w-6 h-6 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center font-bold text-xs uppercase">
              K
            </div>
            <div className="text-left">
              <span className="block text-xs font-semibold leading-tight max-w-[140px] truncate">
                Krish Sandip Shah
              </span>
              <span className="block text-[9px] font-bold text-amber-300 uppercase tracking-wider leading-none">
                Super Admin
              </span>
            </div>
          </div>

          {/* Direct Sign Out Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors border border-rose-200/80 cursor-pointer"
            title="Sign out of Admin Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
