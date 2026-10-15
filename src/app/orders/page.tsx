"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Search,
  RefreshCw,
  ExternalLink,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  Edit3,
  ArrowRight,
  AlertCircle,
  Truck,
  Eye,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_COLORS, type OrderStatus } from "@/lib/types";
import type { OrderData } from "@/lib/types";

export default function EmployeeOrdersListPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const url =
        selectedStatus === "All"
          ? "/api/orders"
          : `/api/orders?status=${encodeURIComponent(selectedStatus)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load orders (${res.status})`);
      }
      const data: OrderData[] = await res.json();
      setOrders(data);
    } catch (err: any) {
      console.error("Error loading orders:", err);
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStatus]);

  // Client-side search filtering
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const term = searchQuery.toLowerCase().trim();
    return orders.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(term) ||
        (order.customerName && order.customerName.toLowerCase().includes(term)) ||
        (order.customerGstPan && order.customerGstPan.toLowerCase().includes(term)) ||
        (order.placedBy && order.placedBy.toLowerCase().includes(term)) ||
        (order.items &&
          order.items.some(
            (it) =>
              it.productName.toLowerCase().includes(term) ||
              (typeof it.colorSets === "string" && it.colorSets.toLowerCase().includes(term))
          ))
    );
  }, [orders, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <UserHeader />

      {/* Top Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link href="/" className="hover:text-white transition">
                Home
              </Link>
              <span>/</span>
              <span className="text-orange-400 font-bold">Orders Collection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Customer Wholesale Orders
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Review and open any order form to edit details, adjust sets/colors, or print wholesale order slips.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
              title="Refresh orders list"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Error notification */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchOrders}
              className="text-xs font-bold underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SEARCH & STATUS TABS
            ═══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {["All", ...ORDER_STATUSES].map((status) => {
              const isSelected = selectedStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-slate-900 text-orange-400 shadow-md ring-2 ring-slate-900"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          {/* Search bar & count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 max-w-md">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders by Order #, Customer, GST/PAN, Placed By..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              />
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Total Found:{" "}
              <span className="font-bold text-slate-900">{filteredOrders.length}</span>{" "}
              wholesale order(s)
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            ORDERS TABLE (ONE CUSTOMER LINE - NO PRODUCTS SHOWN HERE)
            ═══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Customer / Shop Name</th>
                  <th className="py-3.5 px-4">GST NO. / PAN NO.</th>
                  <th className="py-3.5 px-4">City / Station</th>
                  <th className="py-3.5 px-4 text-right">Grand Total (₹)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Booked By</th>
                  <th className="py-3.5 px-4">Order Date</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={9} className="py-4 px-4">
                        <div className="w-full h-5 bg-slate-200 rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                          <Package size={28} />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">
                          {searchQuery
                            ? "No matching orders found"
                            : "No wholesale orders placed in this status"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          No wholesale customer orders recorded in this status.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const statusStyle =
                      STATUS_COLORS[order.status] ||
                      "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className="hover:bg-orange-50/60 cursor-pointer transition-colors group"
                        title="Click to view customer product details and edit order"
                      >
                        {/* Order # */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-900 group-hover:text-orange-600 flex items-center gap-1.5 whitespace-nowrap">
                          <span>{order.orderNumber}</span>
                          <ExternalLink
                            size={12}
                            className="opacity-0 group-hover:opacity-100 text-orange-500 transition-opacity"
                          />
                        </td>

                        {/* Customer / Shop Name */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {order.customerName}
                          </div>
                          {order.customerPhone && (
                            <div className="text-[10px] text-slate-500">
                              Ph: {order.customerPhone}
                            </div>
                          )}
                        </td>

                        {/* GST / PAN No. */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {order.customerGstPan || "—"}
                        </td>

                        {/* City / Station */}
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-orange-500 shrink-0" />
                            <span>
                              {order.customerAddress?.split(",").slice(-2)[0]?.trim() || "Gujarat"}
                            </span>
                          </div>
                        </td>

                        {/* Grand Total */}
                        <td className="py-4 px-4 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                          {formatCurrency(order.grandTotal)}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle}`}
                          >
                            {order.status}
                          </span>
                        </td>

                        {/* Booked By */}
                        <td className="py-4 px-4 text-slate-700 font-medium whitespace-nowrap">
                          {order.placedBy || "Employee"}
                        </td>

                        {/* Order Date */}
                        <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(order.orderDate)}
                        </td>

                        {/* Action: View Order & WhatsApp */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/orders/${order.id}`);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 px-3 py-1.5 rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95"
                              title="View customer product details"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const res = await fetch(`/api/orders/${order.id}/whatsapp`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ type: "ORDER_CONFIRMATION" }),
                                  });
                                  const data = await res.json();
                                  if (data.whatsappUrl) {
                                    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
                                  }
                                } catch {}
                              }}
                              className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 transition"
                              title="Send invoice & updates on WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
