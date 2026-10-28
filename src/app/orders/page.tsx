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
  FileCheck2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_COLORS, type OrderStatus } from "@/lib/types";
import type { OrderData } from "@/lib/types";
import { useEmployee } from "@/components/providers/EmployeeProvider";

export default function EmployeeOrdersListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { employee } = useEmployee();

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");

  useEffect(() => {
    if (employee?.name) {
      setEmpName(employee.name);
    } else {
      try {
        const saved = localStorage.getItem("garmentpro_employee_name");
        if (saved) setEmpName(saved);
      } catch {}
    }
  }, [employee]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedStatus !== "All") params.set("status", selectedStatus);
      if (empName) params.set("placedBy", empName);

      const qs = params.toString();
      const url = qs ? `/api/orders?${qs}` : "/api/orders";
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
  }, [selectedStatus, empName]);

  // Helper to identify bills
  const isOrderBill = (o: OrderData) => {
    if (o.notes && o.notes.includes("[BILL_WITHOUT_GST")) return true;
    if ((o as any).isBillWithoutGst === true) return true;
    if (o.isPreviousBill === true) return true;
    if (o.gstRate === 0 && o.taxInvoiceNumber) return true;
    return false;
  };

  const getOrderBillNumber = (o: OrderData): string => {
    const match = o.notes?.match(/\[BILL_WITHOUT_GST:\s*([^\]]+)\]/);
    const raw = match ? match[1].trim() : (o.taxInvoiceNumber || o.orderNumber);
    const numMatch = raw?.match(/\d+/);
    return numMatch ? numMatch[0] : (raw || "1");
  };

  const canViewBills = Boolean(
    employee?.canAddPreviousBills === true ||
    (employee?.id === 0 && (employee?.designation === "Administrator" || employee?.designation?.includes("Admin")))
  );

  const [activeCategoryTab, setActiveCategoryTab] = useState<"ORDERS" | "BILLS">("ORDERS");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tabParam = p.get("tab");
      if (tabParam === "bills" || tabParam === "bill") {
        setActiveCategoryTab("BILLS");
      }
    }
  }, []);

  // Client-side search and strict employee isolation
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (empName) {
      const cleanEmp = empName.trim().toLowerCase();
      list = list.filter((ord) => ord.placedBy && ord.placedBy.trim().toLowerCase() === cleanEmp);
    }

    if (!searchQuery.trim()) return list;
    const term = searchQuery.toLowerCase().trim();
    return list.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(term) ||
        (order.taxInvoiceNumber && order.taxInvoiceNumber.toLowerCase().includes(term)) ||
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
  }, [orders, searchQuery, empName]);

  const regularOrders = useMemo(
    () => filteredOrders.filter((o) => !isOrderBill(o)),
    [filteredOrders]
  );

  const billsOrders = useMemo(
    () => filteredOrders.filter((o) => isOrderBill(o)),
    [filteredOrders]
  );

  const displayedOrders = activeCategoryTab === "BILLS" && canViewBills ? billsOrders : regularOrders;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Customer Orders
            </h1>
            {empName && (
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Showing orders placed by: <span className="font-bold text-orange-600">{empName}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition shadow-xs cursor-pointer"
            title="Refresh orders list"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Category Tabs: Order Forms vs Bills (Visible only if permitted by Admin) */}
        {canViewBills && (
          <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => {
                setActiveCategoryTab("ORDERS");
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("tab");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                activeCategoryTab === "ORDERS"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package size={15} className={activeCategoryTab === "ORDERS" ? "text-orange-600" : "text-slate-400"} />
              <span>Order Forms ({regularOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategoryTab("BILLS");
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "bills");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
                activeCategoryTab === "BILLS"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCheck2 size={15} className={activeCategoryTab === "BILLS" ? "text-emerald-400" : "text-slate-400"} />
              <span>Bills ({billsOrders.length})</span>
            </button>
          </div>
        )}
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
            ORDERS / BILLS TABLE
            ═══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">{activeCategoryTab === "BILLS" ? "Bill # & Order #" : "Order #"}</th>
                  <th className="py-3.5 px-4">Customer / Shop Name</th>
                  {activeCategoryTab !== "BILLS" && <th className="py-3.5 px-4">GST NO. / PAN NO.</th>}
                  <th className="py-3.5 px-4">City / Station</th>
                  {activeCategoryTab === "BILLS" && <th className="py-3.5 px-4">Sets / Pcs</th>}
                  <th className="py-3.5 px-4 text-right">{activeCategoryTab === "BILLS" ? "Bill Amount" : "Grand Total (₹)"}</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Booked By</th>
                  <th className="py-3.5 px-4">{activeCategoryTab === "BILLS" ? "Bill Date" : "Order Date"}</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={activeCategoryTab === "BILLS" ? 9 : 9} className="py-4 px-4">
                        <div className="w-full h-5 bg-slate-200 rounded" />
                      </td>
                    </tr>
                  ))
                ) : displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                          {activeCategoryTab === "BILLS" ? <FileCheck2 size={28} /> : <Package size={28} />}
                        </div>
                        <p className="font-bold text-slate-800 text-sm">
                          {searchQuery
                            ? "No matching records found"
                            : activeCategoryTab === "BILLS"
                            ? "No bills recorded yet"
                            : "No wholesale orders placed in this status"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {activeCategoryTab === "BILLS"
                            ? "You can generate a Bill from the Order Form page."
                            : "No customer orders recorded in this status."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const statusStyle =
                      STATUS_COLORS[order.status] ||
                      "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/orders/${order.id}`)}
                        className="hover:bg-orange-50/60 cursor-pointer transition-colors group"
                        title="Click to view details"
                      >
                        {/* Order # / Bill # */}
                        <td className="py-4 px-4 font-mono font-bold text-slate-900 group-hover:text-orange-600 whitespace-nowrap">
                          {activeCategoryTab === "BILLS" ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 w-fit">
                                <FileCheck2 size={12} className="text-emerald-700" />
                                <span>Bill {getOrderBillNumber(order)}</span>
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Order #{order.orderNumber}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span>
                                {order.orderNumber?.startsWith("#")
                                  ? order.orderNumber
                                  : `#${order.orderNumber}`}
                              </span>
                              <ExternalLink
                                size={12}
                                className="opacity-0 group-hover:opacity-100 text-orange-500 transition-opacity"
                              />
                            </div>
                          )}
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

                        {/* GST / PAN No. (Only for regular orders) */}
                        {activeCategoryTab !== "BILLS" && (
                          <td className="py-4 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {order.customerGstPan || "—"}
                          </td>
                        )}

                        {/* City / Station */}
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-orange-500 shrink-0" />
                            <span>
                              {order.customerAddress?.split(",").slice(-2)[0]?.trim() || "Gujarat"}
                            </span>
                          </div>
                        </td>

                        {/* Sets / Pieces (For Bills tab) */}
                        {activeCategoryTab === "BILLS" && (
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{order.totalSets} Sets</div>
                            <div className="text-[11px] text-slate-500">{order.totalPcs} PCS</div>
                          </td>
                        )}

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

                        {/* Action: View Order */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/orders/${order.id}`);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black px-3.5 py-1.5 rounded-xl shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                              title="View details"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                            {activeCategoryTab === "BILLS" && (
                              <a
                                href={`/api/orders/${order.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3 py-1.5 rounded-xl transition cursor-pointer"
                                title="Download PDF"
                              >
                                <Printer size={13} />
                                <span>PDF</span>
                              </a>
                            )}
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
