"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, formatProductNameWithMrp } from "@/lib/utils";
import { openWhatsAppDirectly, shareOrOpenWhatsAppWithPdf, sendAutomatedWhatsAppDirect } from "@/lib/whatsapp-client";
import { getColorHex } from "@/lib/colors";
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Clock,
  MessageCircle,
  FileText,
  Receipt,
  FileCheck2,
  Loader2,
  Lock,
} from "lucide-react";
import {
  ORDER_STATUSES,
  STATUS_COLORS,
  type OrderData,
  type ColorSetEntry,
  type OrderStatus,
} from "@/lib/types";
import DeleteOrderModal from "@/components/orders/DeleteOrderModal";

export default function OrdersView({
  initialTab = "ORDERS",
}: {
  initialTab?: "ORDERS" | "INVOICES";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"ORDERS" | "INVOICES">(initialTab);

  // Status Update Modal
  const [statusModalOrder, setStatusModalOrder] = useState<OrderData | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("Confirmed");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Delete Order Modal
  const [orderToDelete, setOrderToDelete] = useState<OrderData | null>(null);

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
        const data = await res.json();
        const docLabel = statusModalOrder.taxInvoiceNumber
          ? `Invoice #${statusModalOrder.taxInvoiceNumber}`
          : `Order #${statusModalOrder.orderNumber}`;
        toast(`${docLabel} status updated to ${newStatus}`, "success");
        setStatusModalOrder(null);
        fetchOrders();

        // Automated background WhatsApp dispatch to customer
        if (data.whatsapp?.customerPhone && data.whatsapp?.message) {
          sendAutomatedWhatsAppDirect({
            phone: data.whatsapp.customerPhone,
            message: data.whatsapp.message,
            pdfUrl: data.whatsapp.pdfUrl,
            filename: data.whatsapp.filename,
            nativeUrl: data.whatsapp.nativeUrl,
            whatsappUrl: data.whatsapp.directUrl,
            onToast: toast,
          }).catch((e) => console.error("Auto WhatsApp status error:", e));
        }
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



  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tabParam = p.get("tab");
      if (tabParam === "invoices" || tabParam === "final-invoices") {
        setActiveTab("INVOICES");
      } else if (tabParam === "orders" || tabParam === "order-forms") {
        setActiveTab("ORDERS");
      } else if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab]);

  const orderForms = orders;
  const finalInvoices = orders.filter(
    (o) => Boolean(o.taxInvoiceNumber && o.taxInvoiceNumber.trim()) || o.status === "Ready" || o.status === "Dispatched" || o.status === "Delivered"
  );
  const displayedOrders = activeTab === "ORDERS" ? orderForms : finalInvoices;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            {activeTab === "ORDERS" ? <ShoppingCart size={14} /> : <Receipt size={14} />} Wholesale Order Fulfillment
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {activeTab === "ORDERS" ? "Order Forms" : "Final Tax Invoices"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeTab === "ORDERS"
              ? "Manage client booked order forms, color-wise set ratios (e.g. A-2, B-3), mix sizes, transport details, and order booking."
              : "Official finalized tax invoices generated for deliveries, billing, and accounting with 5% GST."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {isSuperAdmin && (
            <Link
              href="/admin/orders/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={16} />
              <span>Book New Order</span>
            </Link>
          )}
        </div>
      </div>

      {/* SEPARATE TABS: Order Forms vs Final Invoices */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("ORDERS");
              if (pathname.startsWith("/admin/invoices")) {
                router.push("/admin/orders");
              } else if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "orders");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "ORDERS"
                ? "bg-white text-gray-900 shadow-xs border border-gray-200/80 font-black"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileText size={15} className={activeTab === "ORDERS" ? "text-blue-600" : "text-gray-400"} />
            <span>Order Forms ({orderForms.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("INVOICES");
              if (pathname === "/admin/orders") {
                router.push("/admin/invoices");
              } else if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "invoices");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "INVOICES"
                ? "bg-amber-500 text-white shadow-xs font-black"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Receipt size={15} className={activeTab === "INVOICES" ? "text-white" : "text-gray-400"} />
            <span>Final Invoices ({finalInvoices.length})</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 font-medium px-2">
          {activeTab === "ORDERS"
            ? "Showing all Booked Client Order Forms (Ratios & Sets)"
            : "Showing official Final Tax Invoices with GST & Delivered pieces"}
        </div>
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
              placeholder={activeTab === "ORDERS" ? "Search by order #, customer, or phone..." : "Search by invoice #, customer, or phone..."}
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

      {/* Orders / Invoices Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">{activeTab === "ORDERS" ? "Order Form #" : "Tax Invoice #"}</th>
                <th className="py-3.5 px-6">{activeTab === "ORDERS" ? "Date Placed" : "Invoice Date"}</th>
                <th className="py-3.5 px-6">Customer Name</th>
                <th className="py-3.5 px-6">{activeTab === "ORDERS" ? "Sets & Pieces" : "Delivered Qty"}</th>
                <th className="py-3.5 px-6">{activeTab === "ORDERS" ? "Booked Amount" : "Final Amount (with 5% GST)"}</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    {activeTab === "ORDERS" ? "Loading order forms..." : "Loading final tax invoices..."}
                  </td>
                </tr>
              ) : displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    {activeTab === "ORDERS"
                      ? "No order forms found. Click 'Book New Order' to create a client order."
                      : "No final tax invoices found. Once orders are ready or tax invoices are generated, they appear here."}
                  </td>
                </tr>
              ) : (
                displayedOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* 1. Identifier */}
                    <td className="py-4 px-6">
                      {activeTab === "INVOICES" ? (
                        <div className="font-mono font-bold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-amber-950 text-base">
                            {o.taxInvoiceNumber || `Pending (Order #${o.orderNumber})`}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Tax Invoice
                          </span>
                        </div>
                      ) : (
                        <div className="font-mono font-bold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">
                            {o.orderNumber?.startsWith("#") ? o.orderNumber : `#${o.orderNumber}`}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Order Form
                          </span>
                        </div>
                      )}
                    </td>

                    {/* 2. Date */}
                    <td className="py-4 px-6">
                      <div className="font-semibold text-gray-800">
                        {formatDate(activeTab === "INVOICES" && o.taxInvoiceDate ? o.taxInvoiceDate : o.orderDate || o.createdAt)}
                      </div>
                      {o.placedBy && (
                        <div className="text-[10px] text-gray-400 mt-0.5">By: {o.placedBy}</div>
                      )}
                    </td>

                    {/* 3. Customer Name */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900">
                        {o.customer?.shopName || "Customer #" + o.customerId}
                      </div>
                      {o.customer?.city && (
                        <div className="text-[10px] text-gray-400 mt-0.5 font-medium">{o.customer.city}</div>
                      )}
                    </td>

                    {/* 4. Sets & Pieces */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-800">
                        {o.totalSets} Sets
                      </div>
                      <div className="text-[11px] text-gray-500 font-medium">
                        {o.totalPcs} Pcs
                      </div>
                    </td>

                    {/* 5. Amount */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900 font-mono text-sm">
                        {formatCurrency(o.grandTotal)}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            STATUS_COLORS[o.status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                    </td>

                    {/* 6. Action */}
                    <td className="py-4 px-6 text-right space-x-1.5">
                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const isTax = activeTab === "INVOICES";
                            const res = await fetch(`/api/orders/${o.id}/whatsapp`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                type: isTax ? "TAX_INVOICE" : "ORDER_CONFIRMATION",
                                formatType: isTax ? "tax_invoice" : "order_form",
                              }),
                            });
                            const data = await res.json();
                            if (data.automated) {
                              toast(`✅ ${isTax ? "Tax Invoice" : "Order Form"} PDF generated & sent directly to ${data.customerName || "customer"} (${data.customerPhone || ""}) via WhatsApp!`, "success");
                            } else {
                              toast(data.error || "Could not dispatch WhatsApp message. Please check WhatsApp Gateway.", "error");
                            }
                          } catch {
                            toast("Could not send WhatsApp message", "error");
                          }
                        }}
                        className="p-1.5 inline-flex text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title={activeTab === "INVOICES" ? "Send Tax Invoice PDF on WhatsApp" : "Send Order Form on WhatsApp"}
                      >
                        <MessageCircle size={15} />
                      </button>

                      {/* Edit Order or Edit Tax Invoice */}
                      {activeTab === "INVOICES" ? (
                        <Link
                          href={`/admin/orders/${o.id}?editInvoice=true`}
                          className="p-1.5 inline-flex text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Tax Invoice details"
                        >
                          <Edit size={15} />
                        </Link>
                      ) : o.status === "Pending" ? (
                        <Link
                          href={`/admin/orders/${o.id}/edit`}
                          className="p-1.5 inline-flex text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Order Form items & quantities"
                        >
                          <Edit size={15} />
                        </Link>
                      ) : (
                        <span
                          className="p-1.5 inline-flex text-gray-300 cursor-not-allowed"
                          title="Order is confirmed and locked from editing"
                        >
                          <Lock size={15} />
                        </span>
                      )}

                      {/* View Dedicated Page */}
                      <Link
                        href={`/admin/orders/${o.id}?format=${activeTab === "INVOICES" ? "tax-invoice" : "order-form"}`}
                        className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        title={activeTab === "INVOICES" ? "View Final Tax Invoice" : "View Order Form"}
                      >
                        <Eye size={15} />
                      </Link>

                      {/* Status Update Button */}
                      <button
                        onClick={() => {
                          setStatusModalOrder(o);
                          setNewStatus(o.status as OrderStatus);
                        }}
                        className="p-1.5 inline-flex text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Update Status"
                      >
                        <Clock size={15} />
                      </button>

                      {/* Delete Order */}
                      {o.status === "Dispatched" ? (
                        <span
                          className="p-1.5 inline-flex text-gray-300 cursor-not-allowed"
                          title="Dispatched orders/invoices cannot be deleted"
                        >
                          <Trash2 size={15} />
                        </span>
                      ) : (
                        <button
                          onClick={() => setOrderToDelete(o)}
                          className="p-1.5 inline-flex text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
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
          title={`Update Status — ${
            statusModalOrder.taxInvoiceNumber
              ? `Invoice #${statusModalOrder.taxInvoiceNumber}`
              : `Order #${statusModalOrder.orderNumber}`
          }`}
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

      {/* Prompt Delete Order Modal */}
      {orderToDelete && (
        <DeleteOrderModal
          isOpen={!!orderToDelete}
          onClose={() => setOrderToDelete(null)}
          order={orderToDelete}
          onDeleted={(stockRestored, orderNum) => {
            toast(
              stockRestored
                ? `Order ${orderNum} deleted and stock sets added back to inventory!`
                : `Order ${orderNum} deleted (stock kept unchanged).`,
              "success"
            );
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
