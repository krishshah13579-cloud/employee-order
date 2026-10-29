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
  Bell,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DashboardStats, STATUS_COLORS } from "@/lib/types";

interface AdminNotification {
  id: string;
  type: "order" | "customer";
  title: string;
  subtitle: string;
  timestamp: string;
  status?: string;
  link: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/stats");
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Failed to fetch stats (${res.status})`);
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

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchNotifications();

    // Check super admin status
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated && data?.user?.isSuperAdmin) {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: IndianRupee,
      description: "Wholesale invoices billed",
      color: "text-emerald-600 bg-emerald-50 border-emerald-200/80",
      href: "/admin/employee/orders",
    },
    {
      title: "Total Orders",
      value: (stats?.totalOrders ?? 0).toLocaleString(),
      icon: ShoppingCart,
      description: "All wholesale orders",
      color: "text-blue-600 bg-blue-50 border-blue-200/80",
      href: "/admin/employee/orders",
    },
    {
      title: "Pending Orders",
      value: (stats?.pendingOrders ?? 0).toLocaleString(),
      icon: Clock,
      description: "Awaiting dispatch",
      color: "text-amber-600 bg-amber-50 border-amber-200/80",
      href: "/admin/employee/orders?status=Pending",
    },
    {
      title: "Garment Catalog",
      value: (stats?.totalProducts ?? 0).toLocaleString(),
      icon: Package,
      description: "Active trouser designs",
      color: "text-indigo-600 bg-indigo-50 border-indigo-200/80",
      href: "/admin/employee/products",
    },
    {
      title: "Customer Shops",
      value: (stats?.totalCustomers ?? 0).toLocaleString(),
      icon: Store,
      description: "Registered retailers",
      color: "text-orange-600 bg-orange-50 border-orange-200/80",
      href: "/admin/employee/customers",
    },
    {
      title: "Sales Employees",
      value: (stats?.totalEmployees ?? 0).toLocaleString(),
      icon: UserCheck,
      description: "Active field staff",
      color: "text-purple-600 bg-purple-50 border-purple-200/80",
      href: "/admin/employee/employees",
    },
  ];

  return (
    <div className="space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <span>Wholesale Control Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 truncate">Overview Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5 break-words">
            Real-time wholesale sales performance, garment catalog ratios, orders, and field employees.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => {
              fetchStats();
              fetchNotifications();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-zinc-900" : ""} />
            <span>Refresh</span>
          </button>
          
          {/* Book New Order button: Allowed ONLY for Super Admin */}
          {isSuperAdmin && (
            <Link
              href="/admin/employee/orders/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Book New Order</span>
            </Link>
          )}
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

      {/* Live Notification Center: New Customers & Orders Received */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden w-full max-w-full">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-orange-50/50 to-amber-50/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Live Notifications
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                  {notifications.length} Recent Alerts
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                Instant alerts for newly registered customer retail shops and wholesale orders received.
              </p>
            </div>
          </div>
          <button
            onClick={fetchNotifications}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RefreshCw size={12} className={loadingNotifications ? "animate-spin" : ""} />
            <span>Check Updates</span>
          </button>
        </div>

        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {loadingNotifications ? (
            <div className="p-6 text-center text-xs text-gray-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No new customer or order alerts at this time.
            </div>
          ) : (
            notifications.map((notif) => (
              <Link
                key={notif.id}
                href={notif.link}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors group block min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      notif.type === "order"
                        ? "bg-blue-50 text-blue-600 border border-blue-200"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    }`}
                  >
                    {notif.type === "order" ? <ShoppingCart size={15} /> : <Store size={15} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                        {notif.title}
                      </span>
                      {notif.status && (
                        <span
                          className={`shrink-0 px-2 py-0.2 rounded-full text-[9px] font-bold ${
                            STATUS_COLORS[notif.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {notif.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 text-right shrink-0">
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {formatDate(notif.timestamp)}
                  </span>
                  <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-600 transition-colors shrink-0" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Recent Orders Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden w-full max-w-full">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Recent Wholesale Orders
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest garment bookings and invoice statuses.
            </p>
          </div>
          <Link
            href="/admin/employee/orders"
            className="text-xs font-semibold text-zinc-900 hover:underline flex items-center gap-1 shrink-0"
          >
            <span>View all</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto max-w-full">
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
                    No orders booked yet.
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-gray-900">
                      {o.orderNumber?.startsWith("#") ? o.orderNumber : `#${o.orderNumber}`}
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
                        href={`/admin/employee/orders/${o.orderNumber || o.id}`}
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
