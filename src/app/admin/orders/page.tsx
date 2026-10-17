"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { openWhatsAppDirectly } from "@/lib/whatsapp-client";
import { getColorHex } from "@/lib/colors";
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Trash2,
  RefreshCw,
  Clock,
  MessageCircle,
} from "lucide-react";
import {
  ORDER_STATUSES,
  STATUS_COLORS,
  type OrderData,
  type ColorSetEntry,
  type OrderStatus,
} from "@/lib/types";

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Status Update Modal
  const [statusModalOrder, setStatusModalOrder] = useState<OrderData | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("Confirmed");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated && data?.user?.isSuperAdmin) {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = "/api/orders?";
      if (statusFilter !== "All") url += `status=${encodeURIComponent(statusFilter)}&`;
      if (search) url += `search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err: any) {
      toast("Failed to load orders: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleUpdateStatus = async () => {
    if (!statusModalOrder) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/orders/${statusModalOrder.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast(`Order ${statusModalOrder.orderNumber} status updated to ${newStatus}`, "success");
        setStatusModalOrder(null);
        fetchOrders();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update status", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (id: number, orderNum: string) => {
    if (!confirm(`Are you sure you want to delete wholesale order "${orderNum}"?`)) return;

    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Order deleted successfully", "success");
        fetchOrders();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete order", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <ShoppingCart size={14} /> Wholesale Order Fulfillment
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Orders & Invoices</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage client shop orders, color-wise set ratios (e.g. A-2, B-3), mandatory size ranges, automated PCS calculation, and 5% GST tax invoices.
          </p>
        </div>

        {isSuperAdmin && (
          <Link
            href="/admin/orders/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} />
            <span>Book New Order</span>
          </Link>
        )}
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order #, customer, or phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-700 outline-none shadow-2xs cursor-pointer"
          >
            <option value="All">All Statuses</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchOrders}
          className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 shadow-2xs transition-colors self-end md:self-auto cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-zinc-900" : ""} />
        </button>
      </div>

      {/* Orders Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Order # & Date</th>
                <th className="py-3.5 px-6">Customer Shop & GST</th>
                <th className="py-3.5 px-6">Items & Color Sets Breakdown</th>
                <th className="py-3.5 px-6">Total Amount (5% GST Incl.)</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Loading wholesale orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No orders found. Click "Book New Order" to create a client order.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-mono font-bold text-gray-900 text-sm">{o.orderNumber}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {formatDate(o.orderDate || o.createdAt)}
                      </div>
                      {o.placedBy && (
                        <span className="text-[10px] text-gray-500 font-medium">By: {o.placedBy}</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900">
                        {o.customer?.shopName || "Customer #" + o.customerId}
                      </div>
                      <div className="font-mono text-[11px] text-gray-500 mt-0.5">
                        GST: {o.customer?.gstPanNo || "—"}
                      </div>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <div className="space-y-1">
                        {o.items?.map((item, idx) => {
                          let colorSetsParsed: ColorSetEntry[] = [];
                          try {
                            colorSetsParsed = typeof item.colorSets === "string" ? JSON.parse(item.colorSets) : item.colorSets;
                          } catch {}

                          return (
                            <div key={idx} className="text-xs">
                              <span className="font-semibold text-gray-800">{item.productName}</span>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className="text-[11px] text-gray-500">Ratio:</span>
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1 rounded">{item.sizeRatio}</span>
                                {colorSetsParsed
                                  ?.filter((cs) => cs.sets > 0)
                                  .map((cs, cIdx) => {
                                    const colorInfo = getColorHex(cs.color);
                                    return (
                                      <span
                                        key={cIdx}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-700 border border-gray-200"
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                                          style={{ backgroundColor: colorInfo.hex }}
                                        />
                                        <span>{cs.color}: {cs.sets}s</span>
                                      </span>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900 font-mono text-sm">
                        {formatCurrency(o.grandTotal)}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium">
                        (Incl. ₹{o.gstAmount || Math.round(o.subtotal * 0.05)} GST)
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          STATUS_COLORS[o.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/orders/${o.id}/whatsapp`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "ORDER_CONFIRMATION" }),
                            });
                            const data = await res.json();
                            if (data.automated) {
                              toast("✅ Invoice & details sent directly to customer WhatsApp!", "success");
                            } else if (data.whatsappUrl || data.nativeUrl) {
                              openWhatsAppDirectly({ whatsappUrl: data.whatsappUrl, nativeUrl: data.nativeUrl });
                            }
                          } catch {
                            toast("Could not send WhatsApp message", "error");
                          }
                        }}
                        className="p-1.5 inline-flex text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Send Order Updates & Invoice on WhatsApp"
                      >
                        <MessageCircle size={15} />
                      </button>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Full Tax Invoice (Opens dedicated page)"
                      >
                        <Eye size={15} />
                      </Link>
                      <button
                        onClick={() => {
                          setStatusModalOrder(o);
                          setNewStatus(o.status as OrderStatus);
                        }}
                        className="p-1.5 inline-flex text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Update Order Status"
                      >
                        <Clock size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(o.id, o.orderNumber)}
                        className="p-1.5 inline-flex text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Order"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Status Update Modal */}
      {statusModalOrder && (
        <Modal
          isOpen={!!statusModalOrder}
          onClose={() => setStatusModalOrder(null)}
          title={`Update Status — Order ${statusModalOrder.orderNumber}`}
          size="sm"
        >
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Select New Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900 cursor-pointer"
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStatusModalOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={updatingStatus}
                className="px-5 py-2 text-xs font-semibold text-white bg-zinc-950 hover:bg-black rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {updatingStatus ? "Updating..." : "Save Status"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
