"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Plus, Boxes, Users } from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";

export default function MobilePhoneNavbar() {
  const pathname = usePathname();
  const { employee } = useEmployee();

  // Don't show on admin routes or login
  if (pathname?.startsWith("/admin") || pathname === "/login") {
    return null;
  }

  const canUpdateStock = Boolean(
    employee?.canUpdateStock === true ||
    (employee?.id === 0 && (employee?.designation === "Administrator" || employee?.designation?.includes("Admin")))
  );

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      label: "Orders",
      href: "/orders",
      icon: Package,
      isActive: pathname === "/orders" || (pathname?.startsWith("/orders/") && pathname !== "/orders/new"),
    },
    {
      label: "New Order",
      href: "/orders/new",
      icon: Plus,
      isCenterAction: true,
      isActive: pathname === "/orders/new",
    },
    {
      label: canUpdateStock ? "Stock" : "Products",
      href: canUpdateStock ? "/update-stock" : "/products",
      icon: Boxes,
      isActive: pathname === "/update-stock" || pathname === "/products",
    },
    {
      label: "Customers",
      href: "/visiting-customers",
      icon: Users,
      isActive: pathname === "/visiting-customers",
    },
  ];

  return (
    <nav
      aria-label="Phone Navigation Bar"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 print:hidden"
    >
      <div className="max-w-md mx-auto px-3 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;

          if (item.isCenterAction) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className="relative -top-3.5 flex flex-col items-center group cursor-pointer focus:outline-hidden"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${
                    item.isActive
                      ? "bg-orange-600 ring-4 ring-orange-200 scale-105"
                      : "bg-gradient-to-tr from-orange-600 to-amber-500 hover:scale-105 shadow-orange-500/30"
                  }`}
                >
                  <Plus className="w-6 h-6 stroke-[2.8]" />
                </div>
                <span
                  className={`text-[10px] mt-0.5 font-bold tracking-tight leading-none ${
                    item.isActive ? "text-orange-600" : "text-slate-600"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 ${
                item.isActive
                  ? "text-orange-600 font-bold"
                  : "text-slate-500 hover:text-slate-900 font-medium"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  item.isActive ? "scale-110 stroke-[2.4]" : "stroke-[1.8]"
                }`}
              />
              <span className="text-[10px] mt-1 tracking-tight leading-none">
                {item.label}
              </span>
              {item.isActive && (
                <span className="absolute bottom-0 w-3 h-0.5 rounded-full bg-orange-600" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
