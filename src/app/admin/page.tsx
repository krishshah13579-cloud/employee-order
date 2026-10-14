"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IndianRupee,
  ShoppingCart,
  Clock,
  Package,
  UserCheck,
  Store,
  ShieldCheck,
  ArrowRight,
  Plus,
  RefreshCw,
  Layers,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DashboardStats, STATUS_COLORS } from "@/lib/types";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/stats");
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.statusText}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err: unknown) {
      console.error("Failed to load dashboard stats", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: IndianRupee,
      description: "Wholesale invoices billed",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200/80",
      href: "/admin/orders",
    },
    {
      title: "Total Orders",
      value: (stats?.totalOrders ?? 0).toLocaleString(),
      icon: ShoppingCart,
      description: "All wholesale orders",
      color: "text-blue-600 bg-blue-50 border-blue-200/80",
      href: "/admin/orders",
    },
    {
      title: "Pending Orders",
      value: (stats?.pendingOrders ?? 0).toLocaleString(),
      icon: Clock,
      description: "Awaiting dispatch",
      color: "text-amber-600 bg-amber-50 border-amber-200/80",
      href: "/admin/orders?status=Pending",
    },
    {
      title: "Garment Catalog",
      value: (stats?.totalProducts ?? 0).toLocaleString(),
      icon: Package,
      description: "Active trouser designs",
      color: "text-indigo-600 bg-indigo-50 border-indigo-200/80",
      href: "/admin/products",
    },
    {
      title: "Customer Shops",
      value: (stats?.totalCustomers ?? 0).toLocaleString(),
      icon: Store,
      description: "Registered retailers",
      color: "text-orange-600 bg-orange-50 border-orange-200/80",
      href: "/admin/customers",
    },
    {
      title: "Sales Employees",
      value: (stats?.totalEmployees ?? 0).toLocaleString(),
      icon: UserCheck,
      description: "Active field staff",
      color: "text-purple-600 bg-purple-50 border-purple-200/80",
      href: "/admin/employees",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <span>Wholesale Control Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Overview Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time wholesale sales performance, garment catalog ratios, orders, and field employees.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-zinc-900" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin/orders/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Book New Order</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:border-gray-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {card.title}
                </span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-gray-900 font-mono tracking-tight">
                  {loading ? "..." : card.value}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
                  <span>{card.description}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-black group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Dedicated Page Actions Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
          Quick Management Actions (Opens in dedicated page)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-gray-200 text-xs font-semibold text-gray-900 transition-colors shadow-2xs"
          >
            <Plus size={16} className="text-orange-600" />
            <span>Add New Garment</span>
          </Link>
          <Link
            href="/admin/orders/new"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-gray-200 text-xs font-semibold text-gray-900 transition-colors shadow-2xs"
          >
            <Plus size={16} className="text-blue-600" />
            <span>Book New Order</span>
          </Link>
          <Link
            href="/admin/customers/new"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-gray-200 text-xs font-semibold text-gray-900 transition-colors shadow-2xs"
          >
            <Plus size={16} className="text-emerald-600" />
            <span>Add Customer Shop</span>
          </Link>
          <Link
            href="/admin/employees/new"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-gray-200 text-xs font-semibold text-gray-900 transition-colors shadow-2xs"
          >
            <Plus size={16} className="text-purple-600" />
            <span>Add Employee</span>
          </Link>
        </div>
      </div>

      {/* Recent Orders Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Recent Wholesale Orders
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest garment bookings and invoice statuses.
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-semibold text-zinc-900 hover:underline flex items-center gap-1"
          >
            <span>View all orders</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-6">Order #</th>
                <th className="py-3 px-6">Customer Shop</th>
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-6">Total Amount (₹)</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (!stats?.recentOrders || stats.recentOrders.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Loading recent orders...
                  </td>
                </tr>
              ) : !stats?.recentOrders || stats.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No orders booked yet. Use "Book New Order" to create one.
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-gray-900">
                      {o.orderNumber}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-gray-900">
                      {o.customerName}
                    </td>
                    <td className="py-3.5 px-6 text-gray-500">
                      {formatDate(o.orderDate)}
                    </td>
                    <td className="py-3.5 px-6 font-bold font-mono text-gray-900">
                      {formatCurrency(o.grandTotal)}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          STATUS_COLORS[o.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-xs font-semibold text-zinc-900 hover:underline"
                      >
                        View Invoice →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
