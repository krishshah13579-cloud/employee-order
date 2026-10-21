"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
  Store,
  Package,
  FolderTree,
  ShoppingCart,
  FileText,
  Boxes,
  Receipt,
  RotateCcw,
  BookOpen,
  MessageCircle,
  LogOut,
  ExternalLink,
  BadgePercent,
  SlidersHorizontal,
  ShieldAlert,
  FileCheck2,
  X,
  MapPin,
} from "lucide-react";

interface AdminSidebarNavProps {
  onItemClick?: () => void;
}

const navItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Admin Details",
    href: "/admin/profile",
    icon: ShieldCheck,
    exact: false,
  },
  {
    name: "Employees",
    href: "/admin/employees",
    icon: UserCheck,
    exact: false,
  },
  {
    name: "Customers",
    href: "/admin/customers",
    icon: Store,
    exact: false,
  },
  {
    name: "Visited Customers",
    href: "/admin/visited-customers",
    icon: MapPin,
    exact: false,
  },
  {
    name: "Products",
    href: "/admin/products",
    icon: Package,
    exact: false,
  },
  {
    name: "Categories",
    href: "/admin/categories",
    icon: FolderTree,
    exact: false,
  },
  {
    name: "Order Forms",
    href: "/admin/orders",
    icon: ShoppingCart,
    exact: false,
  },
  {
    name: "Final Invoices",
    href: "/admin/invoices",
    icon: Receipt,
    exact: false,
  },
  {
    name: "Bill (Without GST)",
    href: "/admin/bills",
    icon: FileCheck2,
    exact: false,
  },
  {
    name: "Sales Register",
    href: "/admin/sales",
    icon: BadgePercent,
    exact: false,
  },
  {
    name: "Outstanding",
    href: "/admin/outstanding",
    icon: Receipt,
    exact: false,
  },
  {
    name: "Print Ledger",
    href: "/admin/ledger",
    icon: BookOpen,
    exact: false,
  },
  {
    name: "Returns",
    href: "/admin/returns",
    icon: RotateCcw,
    exact: false,
  },
  {
    name: "Stock",
    href: "/admin/stock",
    icon: Boxes,
    exact: false,
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: FileText,
    exact: false,
  },
  {
    name: "Invoice Settings",
    href: "/admin/invoice-settings",
    icon: SlidersHorizontal,
    exact: false,
  },
  {
    name: "WhatsApp Gateway",
    href: "/admin/whatsapp",
    icon: MessageCircle,
    exact: false,
  },
  {
    name: "Security Audit",
    href: "/admin/audit",
    icon: ShieldAlert,
    exact: false,
  },
];

export default function AdminSidebarNav({ onItemClick }: AdminSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState({ name: "Administrator", email: "" });

  useEffect(() => {
    fetch("/api/admin/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.fullName) {
          setAdminUser({
            name: data.fullName || "Administrator",
            email: data.email || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    if (onItemClick) onItemClick();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
        <Link
          href="/admin"
          onClick={onItemClick}
          className="flex items-center gap-3 group min-w-0"
        >
          <div className="w-9 h-9 bg-white rounded-xl p-1 shadow-xs border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/images/iq-logo.jpg"
              alt="IQ Trousers"
              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-black tracking-wider text-zinc-950 uppercase leading-tight truncate">
              IQ TROUSERS
            </span>
            <span className="block text-[9px] font-bold text-orange-600 uppercase tracking-widest leading-none mt-0.5">
              Control Center
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-amber-400 tracking-wider uppercase">
            Admin
          </span>
          {onItemClick && (
            <button
              type="button"
              onClick={onItemClick}
              className="md:hidden p-1.5 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close menu"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Navigation Section */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3">
        <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Wholesale Management
        </p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-zinc-950 text-white shadow-xs font-bold"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-amber-400" : "text-zinc-400 group-hover:text-zinc-950"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer User & Security Card */}
      <div className="p-3 border-t border-gray-100 space-y-2 shrink-0 bg-white">
        {/* User Card */}
        <div className="p-3 rounded-xl bg-zinc-50 border border-gray-200/80">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-zinc-900 text-amber-400 flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {adminUser.name[0] || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-zinc-900 truncate">
                {adminUser.name}
              </span>
              {adminUser.email ? (
                <span className="block text-[10px] text-zinc-500 truncate">
                  {adminUser.email}
                </span>
              ) : (
                <span className="block text-[10px] text-zinc-500 truncate">
                  Master Administrator
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 text-[10px]">
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              2FA Verified
            </span>
            <span className="font-bold uppercase tracking-wider text-zinc-500">
              Super Admin
            </span>
          </div>
        </div>

        {/* View Storefront Link */}
        <Link
          href="/"
          target="_blank"
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors border border-gray-200 cursor-pointer shadow-2xs"
          title="Open Employee Order Collection in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
          <span>Employee Order Page</span>
        </Link>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors border border-rose-200/80 cursor-pointer shadow-2xs"
          title="Sign out of Admin Session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
