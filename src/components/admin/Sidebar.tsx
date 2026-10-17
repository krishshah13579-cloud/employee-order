"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
  Store,
  Package,
  ShoppingCart,
  Boxes,
  FileText,
  Receipt,
  RotateCcw,
  ArrowRight,
  LogOut,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
}

const navItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    id: "profile",
    label: "Admin Details",
    href: "/admin/profile",
    icon: ShieldCheck,
  },
  {
    id: "employees",
    label: "Employees",
    href: "/admin/employees",
    icon: UserCheck,
  },
  {
    id: "customers",
    label: "Customers",
    href: "/admin/customers",
    icon: Store,
  },
  {
    id: "products",
    label: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    id: "orders",
    label: "Orders",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    id: "outstanding",
    label: "Outstanding",
    href: "/admin/outstanding",
    icon: Receipt,
  },
  {
    id: "returns",
    label: "Sales Returns",
    href: "/admin/returns",
    icon: RotateCcw,
  },
  {
    id: "stock",
    label: "Stock",
    href: "/admin/stock",
    icon: Boxes,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/admin/reports",
    icon: FileText,
  },
];

export function Sidebar({ activePage }: SidebarProps) {
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
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  };

  return (
    <aside className="w-[260px] min-w-[260px] h-screen fixed left-0 top-0 bg-slate-950 text-white z-40 flex flex-col border-r border-slate-800/80 select-none shadow-2xl">
      {/* Brand Header with IQ TROUSERS Logo */}
      <div className="p-5 border-b border-slate-800/80 bg-slate-900/40">
        <Link
          href="/admin"
          className="flex items-center gap-3 group transition-opacity"
        >
          {/* Logo container */}
          <div className="w-11 h-11 bg-white rounded-xl p-1 shadow-md border border-slate-700/60 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/images/iq-logo.jpg"
              alt="IQ TROUSERS"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="tracking-tight text-white font-black text-base leading-tight truncate flex items-center gap-1.5">
              <span>IQ TROUSERS</span>
            </span>
            <span className="text-[10px] text-orange-400 font-bold tracking-wider uppercase flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Admin Portal
            </span>
          </div>
        </Link>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto px-3">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Management Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                isActive
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-600/30 font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/80"
              }`}
            >
              <Icon size={18} className={isActive ? "text-white" : "text-slate-400"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Admin User Badge & Bottom Link */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/30 space-y-2">
        <div className="px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-slate-200 truncate">{adminUser.name}</span>
            {adminUser.email ? (
              <span className="text-[10px] text-slate-400 truncate font-mono">{adminUser.email}</span>
            ) : (
              <span className="text-[10px] text-slate-400 truncate font-mono">Master Admin</span>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
          >
            <LogOut size={15} />
          </button>
        </div>

        <Link
          href="/"
          className="flex items-center justify-between p-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-xl border border-slate-800/80 transition group"
        >
          <span className="flex items-center gap-1.5">
            <span>🛒</span> Employee Order Page
          </span>
          <ArrowRight size={13} className="text-slate-500 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;
