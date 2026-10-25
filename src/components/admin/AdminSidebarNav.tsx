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
  X,
  MapPin,
  TrendingUp,
  Tag,
  Users,
  Globe,
  Briefcase,
  Layers,
} from "lucide-react";

interface AdminSidebarNavProps {
  onItemClick?: () => void;
}

// 1. Employee (Wholesale B2B) Navigation Items
const employeeNavItems = [
  {
    name: "Dashboard",
    href: "/employee",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Admin Details",
    href: "/employee/profile",
    icon: ShieldCheck,
    exact: false,
  },
  {
    name: "Employees",
    href: "/employee/employees",
    icon: UserCheck,
    exact: false,
  },
  {
    name: "Customers",
    href: "/employee/customers",
    icon: Store,
    exact: false,
  },
  {
    name: "Visited Customers",
    href: "/employee/visited-customers",
    icon: MapPin,
    exact: false,
  },
  {
    name: "Products",
    href: "/employee/products",
    icon: Package,
    exact: false,
  },
  {
    name: "Categories",
    href: "/employee/categories",
    icon: FolderTree,
    exact: false,
  },
  {
    name: "Order Forms",
    href: "/employee/orders",
    icon: ShoppingCart,
    exact: false,
  },
  {
    name: "Sales Register",
    href: "/employee/sales",
    icon: BadgePercent,
    exact: false,
  },
  {
    name: "Outstanding",
    href: "/employee/outstanding",
    icon: Receipt,
    exact: false,
  },
  {
    name: "Print Ledger",
    href: "/employee/ledger",
    icon: BookOpen,
    exact: false,
  },
  {
    name: "Returns",
    href: "/employee/returns",
    icon: RotateCcw,
    exact: false,
  },
  {
    name: "Invoices",
    href: "/employee/invoices",
    icon: FileText,
    exact: false,
  },
  {
    name: "Stock (Common)",
    href: "/stock",
    icon: Boxes,
    exact: false,
    isCommon: true,
  },
  {
    name: "Profit",
    href: "/employee/profit",
    icon: TrendingUp,
    exact: false,
  },
  {
    name: "Reports",
    href: "/employee/reports",
    icon: FileText,
    exact: false,
  },
  {
    name: "Invoice Settings",
    href: "/employee/invoice-settings",
    icon: SlidersHorizontal,
    exact: false,
  },
  {
    name: "WhatsApp Gateway",
    href: "/employee/whatsapp",
    icon: MessageCircle,
    exact: false,
  },
  {
    name: "Security Audit",
    href: "/employee/audit",
    icon: ShieldAlert,
    exact: false,
  },
];

// 2. Admin (Online E-Commerce) Navigation Items
const onlineNavItems = [
  {
    name: "Dashboard",
    href: "/online",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Products",
    href: "/online/products",
    icon: Package,
    exact: false,
  },
  {
    name: "Categories",
    href: "/online/categories",
    icon: FolderTree,
    exact: false,
  },
  {
    name: "Orders",
    href: "/online/orders",
    icon: ShoppingCart,
    exact: false,
  },
  {
    name: "Discounts",
    href: "/online/discounts",
    icon: Tag,
    exact: false,
  },
  {
    name: "Customers",
    href: "/online/users",
    icon: Users,
    exact: false,
  },
  {
    name: "Stock (Common)",
    href: "/stock",
    icon: Boxes,
    exact: false,
    isCommon: true,
  },
];

export default function AdminSidebarNav({ onItemClick }: AdminSidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState({ name: "Administrator", email: "" });

  // Remember the active mode ('employee' or 'online')
  const [activeMode, setActiveMode] = useState<"employee" | "online">("employee");

  useEffect(() => {
    if (pathname.startsWith("/online")) {
      setActiveMode("online");
    } else if (pathname.startsWith("/employee") || pathname.startsWith("/admin")) {
      setActiveMode("employee");
    }
  }, [pathname]);

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

  const navItems = activeMode === "online" ? onlineNavItems : employeeNavItems;

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
        <Link
          href={activeMode === "online" ? "/online" : "/employee"}
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
            Super Admin
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

      {/* Mode Switcher: Admin (Online) vs Employee (Wholesale) */}
      <div className="p-3 border-b border-gray-100 bg-zinc-50/80 shrink-0">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-200/70 rounded-xl">
          <Link
            href="/online"
            onClick={() => {
              setActiveMode("online");
              if (onItemClick) onItemClick();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all ${
              activeMode === "online"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-white/50"
            }`}
          >
            <Globe className={`w-3.5 h-3.5 ${activeMode === "online" ? "text-emerald-600" : "text-zinc-500"}`} />
            <span>Admin</span>
          </Link>

          <Link
            href="/employee"
            onClick={() => {
              setActiveMode("employee");
              if (onItemClick) onItemClick();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all ${
              activeMode === "employee"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-white/50"
            }`}
          >
            <Briefcase className={`w-3.5 h-3.5 ${activeMode === "employee" ? "text-orange-600" : "text-zinc-500"}`} />
            <span>Employee</span>
          </Link>
        </div>
      </div>

      {/* Scrollable Navigation Section */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {activeMode === "online" ? "Online Store (E-Commerce)" : "Wholesale (Garment Orders)"}
          </p>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-zinc-100 text-zinc-600 uppercase">
            {activeMode === "online" ? "/online" : "/employee"}
          </span>
        </div>
        <nav className="space-y-1 mt-1">
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
                    : item.isCommon
                    ? "text-zinc-900 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/60 font-bold"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? "text-amber-400"
                        : item.isCommon
                        ? "text-amber-600"
                        : "text-zinc-400 group-hover:text-zinc-950"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.isCommon && !isActive && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 tracking-wider">
                    SHARED
                  </span>
                )}
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
          href="/api/admin/open-store?target=/"
          target="_blank"
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 hover:text-black hover:bg-zinc-100 transition-colors border border-gray-200 cursor-pointer shadow-2xs"
          title="Open Employee Order Collection in new tab as Super Admin"
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
