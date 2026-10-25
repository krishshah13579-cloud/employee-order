"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  XCircle,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { formatPrice, getOrderStatusColor } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  product?: {
    name: string;
    images: string;
  } | null;
}

interface OrderData {
  id: string;
  total: number;
  status: string;
  trackingNumber: string | null;
  shippingAddress: string;
  discountCode: string | null;
  discountAmount: number;
  createdAt: string | Date;
  user?: {
    name: string | null;
    email: string;
  } | null;
  items: OrderItem[];
}

const statusOptions: { value: string; label: string }[] = [
  { value: "PENDING", label: "1. Order Placed (Pending)" },
  { value: "CONFIRMED", label: "2. Confirmed" },
  { value: "DISPATCHED", label: "3. Dispatched" },
  { value: "IN_TRANSIT", label: "4. In Transit" },
  { value: "OUT_FOR_DELIVERY", label: "5. Out For Delivery" },
  { value: "DELIVERED", label: "6. Delivered" },
  { value: "CANCELLED", label: "✕ Cancelled" },
];

export default function OrderTable({ initialOrders }: { initialOrders: OrderData[] }) {
  const [orders, setOrders] = useState<OrderData[]>(initialOrders);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [deleteModalOrder, setDeleteModalOrder] = useState<OrderData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch("/api/online/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          trackingNumber: trackingInputs[orderId],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to update order status");
      }

      const updated = await res.json();
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o))
      );
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to update order status";
      alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!deleteModalOrder) return;
    const orderId = deleteModalOrder.id;
    setDeletingId(orderId);
    try {
      const res = await fetch(`/api/online/orders?orderId=${orderId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete order");
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setDeleteModalOrder(null);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to delete order";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateTracking = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const tracking = trackingInputs[orderId];
      const currentOrder = orders.find((o) => o.id === orderId);
      const res = await fetch("/api/online/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: currentOrder?.status,
          trackingNumber: tracking,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update tracking");
      }

      const updated = await res.json();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, trackingNumber: updated.trackingNumber } : o
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update tracking number");
    } finally {
      setUpdatingId(null);
    }
  };

  const parseShippingAddress = (addressStr: string) => {
    try {
      return JSON.parse(addressStr);
    } catch {
      return { address: addressStr };
    }
  };

  const getProductImage = (imagesStr?: string) => {
    if (!imagesStr) return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";
    try {
      const parsed = JSON.parse(imagesStr);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) return parsed[0];
      if (typeof parsed === "string" && parsed) return parsed;
    } catch {}
    if (imagesStr.startsWith("data:")) return imagesStr;
    const split = imagesStr.split(",")[0]?.trim();
    return split || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            No orders found in the database.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-5 py-3">Order</th>
                <th scope="col" className="px-5 py-3">Customer</th>
                <th scope="col" className="px-5 py-3">Date</th>
                <th scope="col" className="px-5 py-3">Total</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const isExpanded = !!expandedIds[order.id];
                const address = parseShippingAddress(order.shippingAddress);
                const itemsCount = order.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );

                return (
                  <tr key={order.id} className="group">
                    <td colSpan={6} className="p-0">
                      <div className="flex flex-col">
                        <div
                          onClick={() => toggleExpand(order.id)}
                          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/80 transition-colors"
                        >
                          {/* Order ID */}
                          <div className="w-1/6 font-mono text-xs font-semibold text-gray-900">
                            #{order.id.slice(-8).toUpperCase()}
                            <div className="text-[11px] font-sans text-gray-500">
                              {itemsCount} {itemsCount === 1 ? "item" : "items"}
                            </div>
                          </div>

                          {/* Customer */}
                          <div className="w-1/4">
                            <div className="font-medium text-gray-900 truncate">
                              {order.user?.name || address.fullName || "Customer"}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {order.user?.email || "No email"}
                            </div>
                          </div>

                          {/* Date */}
                          <div className="w-1/6 text-xs text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>

                          {/* Total */}
                          <div className="w-1/6 font-semibold text-gray-900">
                            {formatPrice(order.total)}
                          </div>

                          {/* Status Dropdown */}
                          <div
                            className="w-1/5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={order.status}
                              disabled={updatingId === order.id}
                              onChange={(e) =>
                                handleStatusChange(order.id, e.target.value)
                              }
                              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-black ${getOrderStatusColor(
                                order.status
                              )}`}
                            >
                              {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                              {!statusOptions.some((opt) => opt.value === order.status) && (
                                <option value={order.status}>{order.status}</option>
                              )}
                            </select>
                          </div>

                          {/* Actions: Delete & Expand */}
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setDeleteModalOrder(order)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete this order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleExpand(order.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                              title={isExpanded ? "Collapse Details" : "View Details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Inline Expanded Details */}
                        {isExpanded && (
                          <div className="bg-gray-50/70 border-t border-b border-gray-200 p-5 space-y-5 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Order Items */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                  <Package className="w-4 h-4" />
                                  Ordered Items
                                </h4>
                                <div className="space-y-2">
                                  {order.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 text-xs"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                                          <img
                                            src={getProductImage(item.product?.images)}
                                            alt={item.product?.name || "Product"}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-900">
                                            {item.product?.name || "Deleted Product"}
                                          </div>
                                          <div className="flex items-center gap-2 text-gray-500 mt-0.5">
                                            <span>Qty: {item.quantity} × {formatPrice(item.price)}</span>
                                            {item.size && (
                                              <span className="font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded text-[10px] border border-gray-200">
                                                Size: {item.size}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="font-semibold text-gray-900">
                                        {formatPrice(item.quantity * item.price)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Shipping & Fulfillment */}
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
                                    <MapPin className="w-4 h-4" />
                                    Shipping Address
                                  </h4>
                                  <div className="bg-white p-3.5 rounded-lg border border-gray-200 text-xs text-gray-700 leading-relaxed">
                                    <p className="font-semibold text-gray-900">
                                      {address.fullName || order.user?.name}
                                    </p>
                                    <p>{address.address}</p>
                                    <p>
                                      {address.city ? `${address.city}, ` : ""}
                                      {address.state ? `${address.state} ` : ""}
                                      {address.zipCode || ""}
                                    </p>
                                    <p>{address.country || ""}</p>
                                    {address.phone && (
                                      <p className="mt-1 text-gray-500">
                                        Phone: {address.phone}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Tracking Number Management */}
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
                                    <Truck className="w-4 h-4" />
                                    Tracking Number
                                  </h4>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder={
                                        order.trackingNumber || "Enter tracking number"
                                      }
                                      value={
                                        trackingInputs[order.id] ??
                                        order.trackingNumber ??
                                        ""
                                      }
                                      onChange={(e) =>
                                        setTrackingInputs((prev) => ({
                                          ...prev,
                                          [order.id]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-black"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTracking(order.id)}
                                      disabled={updatingId === order.id}
                                      className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>

                                {/* Order Deletion & Customer Page Actions */}
                                <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between">
                                  <Link
                                    href={`/orders/${order.id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-black hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>View Customer Order Page</span>
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteModalOrder(order)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Order</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 text-gray-900 relative">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Delete Order #{deleteModalOrder.id.slice(-8).toUpperCase()}?
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete this order? This will remove all associated line items. If this order was active, any reserved stock will be safely returned to inventory.
                </p>
                <div className="mt-2 text-xs font-medium text-gray-500">
                  Customer: {deleteModalOrder.user?.name || "Customer"} ({formatPrice(deleteModalOrder.total)})
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!deletingId) setDeleteModalOrder(null);
                }}
                disabled={!!deletingId}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteOrder}
                disabled={!!deletingId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs disabled:opacity-70 cursor-pointer"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Order</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
