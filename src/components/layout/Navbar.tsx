"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Home,
  FilePlus,
  Package,
  LogOut,
  Crown,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { isEmployeeTeamLeader } from "@/lib/time";

export default function Navbar() {
  const pathname = usePathname();
  const { employee, logout } = useEmployee();
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/orders/new", label: "Order Form", icon: FilePlus },
    { href: "/orders", label: "Order Page", icon: Package },
    { href: "/visiting-customers", label: "Visiting Customer", icon: MapPin },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-xs print:hidden">
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
                  : link.href === "/visiting-customers"
                  ? pathname.startsWith("/visiting-customers")
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

          {/* Right Action: Dedicated Profile Icon */}
          <div className="hidden lg:flex items-center space-x-3">
            {employee && (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="relative p-1 rounded-full border-2 border-orange-500 hover:border-orange-600 hover:shadow-md transition cursor-pointer flex items-center justify-center bg-orange-50"
                  title="View Employee Profile"
                  aria-label="Employee Profile"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-sm flex items-center justify-center shadow-inner">
                    {employee.name.charAt(0).toUpperCase()}
                  </div>
                  {isEmployeeTeamLeader(employee) && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs border border-white"
                      title="Team Leader (24*7 Access Active)"
                    >
                      <Crown size={10} className="fill-amber-950" />
                    </span>
                  )}
                </button>

                {/* Profile Details Dropdown Card */}
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-4 px-5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-3.5 pb-3.5 border-b border-slate-100">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-lg flex items-center justify-center shadow-md">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        {isEmployeeTeamLeader(employee) && (
                          <div className="absolute -top-1.5 -right-1.5 p-1 bg-amber-400 text-amber-950 rounded-full border-2 border-white shadow-xs">
                            <Crown size={11} className="fill-amber-950" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-slate-900 text-sm truncate">
                          {employee.name}
                        </h4>
                        <p className="text-xs font-semibold text-orange-600">
                          {employee.designation || "Sales Staff"}
                        </p>
                        <span className="inline-block mt-0.5 text-[10px] font-mono text-slate-400">
                          ID: #EMP-{String(employee.id).padStart(3, "0")}
                        </span>
                      </div>
                    </div>

                    <div className="py-3 space-y-2.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2.5">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">
                          {employee.mobileNumber || "—"}
                        </span>
                      </div>

                      {employee.email && (
                        <div className="flex items-center gap-2.5">
                          <Mail size={14} className="text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">
                            {employee.email}
                          </span>
                        </div>
                      )}

                      {employee.address && (
                        <div className="flex items-start gap-2.5">
                          <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                          <span className="font-medium text-slate-700 leading-tight">
                            {employee.address}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        {isEmployeeTeamLeader(employee) ? (
                          <div className="w-full p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1.5">
                            <Crown size={13} className="text-amber-600 shrink-0" />
                            <span>Team Leader (T.L.) — 24*7 Unrestricted Access</span>
                          </div>
                        ) : (
                          <div className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-400 shrink-0" />
                            <span>Working Shift: 9:00 AM – 9:00 PM IST</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign Out Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Actions */}
          <div className="flex items-center space-x-2.5 lg:hidden">
            {employee && (
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-orange-400"
                title={`Signed in as ${employee.name}`}
              >
                {employee.name.charAt(0).toUpperCase()}
              </button>
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
            <div className="p-3.5 bg-orange-50/80 border border-orange-200/90 rounded-2xl mb-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
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
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 bg-red-100/80 hover:bg-red-200 rounded-lg transition"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>

              <div className="pt-2 border-t border-orange-200/60 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Employee ID:</span>
                  <span className="font-mono font-bold text-slate-800">#EMP-{String(employee.id).padStart(3, "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-semibold text-slate-800">{employee.mobileNumber || "—"}</span>
                </div>
                {employee.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[180px]">{employee.email}</span>
                  </div>
                )}
                <div className="pt-1 text-[10px] text-orange-800 font-medium">
                  {isEmployeeTeamLeader(employee) ? "👑 Team Leader: 24*7 Unrestricted Access" : "⏰ Shift: 9:00 AM – 9:00 PM IST"}
                </div>
              </div>
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
