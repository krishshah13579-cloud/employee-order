"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Layers,
  Package,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Truck,
  IndianRupee,
  Sparkles,
  Briefcase,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/types";
import { buildOrderFormReturnUrl } from "@/lib/navigation";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { isEmployeeTeamLeader } from "@/lib/time";
import MyTeamSection from "@/components/home/MyTeamSection";

interface OrderItemSummary {
  id?: number;
  productId: number;
  productName: string;
  colorSets?: any;
  totalSets: number;
  totalPcs: number;
  unitPrice: number;
  itemSubtotal: number;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  placedBy?: string;
  customerName: string;
  customerGstPan?: string;
  customerPhone?: string;
  status: string;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  orderDate: string;
  items?: OrderItemSummary[];
}

interface StatsData {
  todayOrders: number;
  todayRevenue: number;
  totalCustomers: number;
  totalCategories: number;
  categories: string[];
  totalOrders: number;
  totalProducts: number;
  inStockProducts?: number;
  totalRevenue: number;
  recentOrders: RecentOrder[];
}

export default function HomePage() {
  const router = useRouter();
  const { employee } = useEmployee();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [myAllocatedCustomers, setMyAllocatedCustomers] = useState<any[]>([]);

  const isTL = isEmployeeTeamLeader(employee);
  const isSpecialTLKrishShah = isTL && (employee?.name || "").toLowerCase().includes("krish");

  useEffect(() => {
    if (!empName) return;
    fetch("/api/customers")
      .then((r) => r.json())
      .then((all: any[]) => {
        if (Array.isArray(all)) {
          const clean = empName.trim().toLowerCase();
          const allocated = all.filter(
            (c) =>
              (employee?.id && c.allocatedEmployeeId === employee.id) ||
              (c.allocatedEmployeeName && c.allocatedEmployeeName.trim().toLowerCase() === clean)
          );
          setMyAllocatedCustomers(allocated);
        }
      })
      .catch(() => {});
  }, [empName, employee]);

  useEffect(() => {
    if (employee?.name) {
      setEmpName(employee.name);
    } else {
      try {
        const saved =
          localStorage.getItem("garmentpro_employee_name") ||
          localStorage.getItem("garmentpro_employee");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed?.name) setEmpName(parsed.name);
            else setEmpName(saved);
          } catch {
            setEmpName(saved);
          }
        }
      } catch {}
    }
  }, [employee]);

  const loadData = async (activeEmpName?: string) => {
    try {
      setLoading(true);
      setError(null);

      const targetEmp = activeEmpName !== undefined ? activeEmpName : empName;
      const url = targetEmp
        ? `/api/stats?placedBy=${encodeURIComponent(targetEmp)}`
        : "/api/stats";

      const res = await fetch(url);
      if (res.ok) {
        const statsData: StatsData = await res.json();
        setStats(statsData);
      } else {
        throw new Error(`Failed to load stats (${res.status})`);
      }
    } catch (err: any) {
      console.error("Error loading home stats:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(empName);
  }, [empName]);

  // Strict employee isolation: only show orders placed by this particular logged-in employee
  const filteredRecentOrders = (stats?.recentOrders || []).filter((order) => {
    if (empName) {
      const cleanEmp = empName.trim().toLowerCase();
      if (!order.placedBy || order.placedBy.trim().toLowerCase() !== cleanEmp) {
        return false;
      }
    }

    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase().trim();
    return (
      order.orderNumber.toLowerCase().includes(term) ||
      order.customerName.toLowerCase().includes(term) ||
      (order.customerPhone && order.customerPhone.toLowerCase().includes(term))
    );
  });

  const categoriesList =
    stats?.categories && stats.categories.length > 0
      ? stats.categories
      : ["EVERYDAY CASUAL", "FORMAL WEAR", "LINEN"];

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 space-y-8">
        {/* Error alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="font-bold underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>Employee Wholesale Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Order Collection &amp; Operations
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadData()}
              disabled={loading}
              className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition"
              title="Refresh metrics"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            KEY METRICS:
            1. TOTAL ORDERS (PRESENT DAY)
            2. CUSTOMERS
            3. CATEGORY
            ═══════════════════════════════════════════ */}
        <section aria-label="Key Dashboard Metrics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. TOTAL ORDERS (PRESENT DAY) */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center shadow-xs">
                  <Calendar size={22} />
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 uppercase tracking-wider">
                  Present Day
                </span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Orders (Today)
              </h3>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                  {loading ? "..." : stats?.todayOrders ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  orders booked
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Booked Value Today:</span>
                <span className="font-bold text-slate-900">
                  {loading ? "..." : formatCurrency(stats?.todayRevenue || 0)}
                </span>
              </div>
            </div>

            {/* 2. MY ALLOCATED CUSTOMERS */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs">
                  <Briefcase size={22} />
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider">
                  My Portfolio
                </span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                My Allocated Customers
              </h3>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-amber-900 font-mono">
                  {myAllocatedCustomers.length}
                </span>
                <span className="text-xs font-semibold text-amber-700">
                  assigned shops
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-amber-100 flex items-center justify-between text-xs text-amber-900">
                <span>Priority Access:</span>
                <Link
                  href="/orders/new"
                  className="font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 underline"
                >
                  Book Order <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            {/* 3. CUSTOMERS */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
                  <Users size={22} />
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 uppercase tracking-wider">
                  Network
                </span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Customers
              </h3>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                  {loading ? "..." : stats?.totalCustomers ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  registered shops
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Mandatory for Orders:</span>
                <span className="font-bold text-blue-600">Shop + GST/PAN</span>
              </div>
            </div>

            {/* 4. PRODUCT CATALOG */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
                  <Package size={22} />
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wider">
                  Catalog
                </span>
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Product Catalog
              </h3>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 font-mono">
                  {loading ? "..." : stats?.totalProducts ?? 0}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  designs available
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Available Catalog:</span>
                <Link
                  href="/products"
                  className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  Browse Designs <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            RECENT ORDERS (10 CUSTOMER ORDERS SHOWN)
            WHEN THE CUSTOMER ORDER DETAIL IS CLICKED THE ORDER FORM OPENS
            ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/60">
            <div>
              <div className="flex items-center gap-2">
                <Package size={20} className="text-orange-600" />
                <h2 className="text-lg font-black text-slate-900">
                  Recent Orders {empName ? `(${empName})` : "(10 Customer Orders Shown)"}
                </h2>
              </div>
              {empName && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing wholesale orders created by <span className="font-bold text-orange-600">{empName}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Filter by Order#, Shop Name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <Link
                href="/orders"
                className="text-xs font-bold text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition flex items-center gap-1 whitespace-nowrap"
              >
                <span>View All</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-100/70 border-b border-neutral-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">Order #</th>
                  <th className="py-3.5 px-5">Customer / Shop Name</th>
                  <th className="py-3.5 px-5 text-center">PCS (Sets)</th>
                  <th className="py-3.5 px-5 text-right">Grand Total (₹)</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5">Date</th>
                  <th className="py-3.5 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={7} className="py-4 px-5">
                        <div className="w-full h-5 bg-neutral-200 rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredRecentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                          <Package size={28} />
                        </div>
                        <p className="font-bold text-slate-700 text-sm">
                          {searchFilter
                            ? "No matching orders found"
                            : "No customer orders placed yet"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {empName
                            ? `No wholesale customer orders recorded for ${empName} yet.`
                            : "No wholesale customer orders recorded yet."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecentOrders.map((order, idx) => {
                    const statusStyle =
                      STATUS_COLORS[order.status] ||
                      "bg-neutral-100 text-neutral-700 border-neutral-200";

                    return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className="hover:bg-orange-50/50 cursor-pointer transition-colors group"
                        title="Click to open and edit Order Form"
                      >
                        <td className="py-4 px-5 font-mono font-bold text-slate-900 group-hover:text-orange-600 flex items-center gap-1.5 whitespace-nowrap">
                          <span>
                            {order.orderNumber?.startsWith("#")
                              ? order.orderNumber
                              : `#${order.orderNumber}`}
                          </span>
                          <ExternalLink
                            size={12}
                            className="opacity-0 group-hover:opacity-100 text-orange-500 transition-opacity"
                          />
                        </td>

                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900">
                            {order.customerName}
                          </div>
                          {order.customerPhone && (
                            <div className="text-[10px] text-slate-500">
                              Ph: {order.customerPhone}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-5 text-center">
                          <span className="font-bold text-slate-900">
                            {order.totalPcs || 0} Pcs
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            ({order.totalSets || 0} Sets)
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right font-black text-slate-900 whitespace-nowrap">
                          {formatCurrency(order.grandTotal)}
                          <span className="text-[10px] font-normal text-slate-500 block">
                            incl. 5% GST
                          </span>
                        </td>

                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle}`}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                          {formatDate(order.orderDate)}
                        </td>

                        <td className="py-4 px-5 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-100/60 group-hover:bg-orange-600 group-hover:text-white px-2.5 py-1 rounded-lg transition-colors">
                            <span>Open Form</span>
                            <ArrowRight size={12} />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            MY ALLOCATED CUSTOMER PORTFOLIO (QUICK SELECTOR)
            MOVED BELOW RECENT ORDERS WITH EXACT SAME COLORS AND LAYOUT
            ═══════════════════════════════════════════ */}
        {myAllocatedCustomers.length > 0 && (
          <section className="bg-amber-50/40 rounded-3xl border border-amber-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                  <Briefcase size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    ⭐ My Allocated Customers ({myAllocatedCustomers.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Accounts assigned to you by admin. Click any customer to immediately start a new order.
                  </p>
                </div>
              </div>
              <Link
                href="/orders/new"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:underline cursor-pointer"
              >
                <span>Go to Order Form</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
              {myAllocatedCustomers.map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => router.push(buildOrderFormReturnUrl(cust.id))}
                  className="bg-white rounded-2xl p-4 border border-amber-200/70 hover:border-amber-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 uppercase group-hover:text-amber-800 transition">
                      {cust.shopName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                      <span>{cust.phoneNumber}</span>
                      <span>•</span>
                      <span>{cust.city || "—"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 group-hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl transition flex items-center gap-1">
                      <span>Book</span>
                      <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            MY TEAM SUPERVISION SECTION (TEAM LEADER KRISH SHAH ONLY)
            MOVED BELOW MY ALLOCATED CUSTOMERS SECTION
            ═══════════════════════════════════════════ */}
        {isSpecialTLKrishShah && <MyTeamSection />}
      </div>
    </div>
  );
}
