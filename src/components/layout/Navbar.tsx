"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  FilePlus,
  Package,
  LogOut,
  Crown,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { isEmployeeTeamLeader } from "@/lib/time";

export default function Navbar() {
  const pathname = usePathname();
  const { employee, logout } = useEmployee();
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/orders/new", label: "Order Form", icon: FilePlus },
    { href: "/orders", label: "Order Page", icon: Package },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand / Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <img
              src="/iq-trousers-logo-transparent.png"
              alt="IQ Trousers"
              width={40}
              height={48}
              loading="eager"
              className="h-12 w-auto object-contain transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/iq-logo.jpg";
              }}
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-gray-950 font-sans uppercase leading-none">
                IQ Trousers
              </span>
              <span className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mt-0.5">
                Krish Clothing Co.
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : link.href === "/orders/new"
                  ? pathname === "/orders/new"
                  : link.href === "/orders"
                  ? pathname === "/orders" ||
                    (pathname.startsWith("/orders/") && pathname !== "/orders/new")
                  : pathname.startsWith(link.href);

              const Icon = link.icon;

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`text-sm font-semibold transition-colors relative flex items-center gap-2 py-2 px-1 ${
                    isActive
                      ? "text-black border-b-2 border-black"
                      : "text-gray-600 hover:text-black"
                  }`}
                >
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Action: Employee Profile & Logout */}
          <div className="hidden lg:flex items-center space-x-3">
            {employee && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-orange-50/80 border border-orange-200/90 rounded-full text-xs">
                  <div className="w-5 h-5 rounded-full bg-orange-600 text-white font-black text-[10px] flex items-center justify-center">
                    {employee.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-900 leading-tight text-[11px] flex items-center gap-1.5">
                      <span>{employee.name}</span>
                      {isEmployeeTeamLeader(employee) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-black text-[9px]">
                          <Crown size={9} className="text-amber-600" /> T.L. 24*7
                        </span>
                      )}
                    </span>
                    <span className="text-[9px] text-orange-600 font-semibold leading-none">
                      {employee.designation || "Sales Staff"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
                  title="Logout Employee Session"
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Actions */}
          <div className="flex items-center space-x-2.5 lg:hidden">
            {employee && (
              <div
                className="w-7 h-7 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center shrink-0"
                title={`Signed in as ${employee.name}`}
              >
                {employee.name.charAt(0).toUpperCase()}
              </div>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-gray-700 hover:text-black"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top duration-200">
          {employee && (
            <div className="flex items-center justify-between p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{employee.name}</span>
                    {isEmployeeTeamLeader(employee) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-black text-[9px]">
                        <Crown size={9} className="text-amber-600" /> T.L. 24*7
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-orange-600 font-semibold">{employee.designation}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          )}

          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : link.href === "/orders/new"
                  ? pathname === "/orders/new"
                  : link.href === "/orders"
                  ? pathname === "/orders" ||
                    (pathname.startsWith("/orders/") && pathname !== "/orders/new")
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? "bg-gray-100 text-black font-bold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span>{link.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
