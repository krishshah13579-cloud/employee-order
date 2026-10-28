"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sendAutomatedWhatsAppDirect } from "@/lib/whatsapp-client";
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Clock,
  MessageCircle,
  FileText,
  Receipt,
  FileCheck2,
  Lock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  ORDER_STATUSES,
  STATUS_COLORS,
  type OrderData,
  type OrderStatus,
} from "@/lib/types";
import DeleteOrderModal from "@/components/orders/DeleteOrderModal";

export default function OrdersView({
  initialTab = "ORDERS",
}: {
  initialTab?: "ORDERS" | "INVOICES" | "BILLS";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"ORDERS" | "INVOICES" | "BILLS">(initialTab);
  const [orderFormSubTab, setOrderFormSubTab] = useState<"PENDING" | "APPROVED">("PENDING");

  // Outstanding data map (customerId -> totalOutstanding)
  const [outstandingMap, setOutstandingMap] = useState<Record<number, number>>({});
  const [wholesaleNoGstCustomers, setWholesaleNoGstCustomers] = useState<any[]>([]);

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

  // Fetch outstanding ledger summary
  const fetchOutstanding = async () => {
    try {
      const res = await fetch("/api/admin/outstanding");
      if (res.ok) {
        const data = await res.json();
        const map: Record<number, number> = {};
        if (Array.isArray(data.customers)) {
          data.customers.forEach((c: any) => {
            map[c.customerId] = c.totalOutstanding || 0;
          });
          const noGstCusts = data.customers.filter((c: any) => {
            const bt = (c.businessType || "").toUpperCase();
            return bt.includes("WITHOUT GST") || bt.includes("NO GST");
          });
          setWholesaleNoGstCustomers(noGstCusts);
        }
        setOutstandingMap(map);
      }
    } catch (e) {
      console.error("Error loading outstanding in OrdersView:", e);
    }
  };

  useEffect(() => {
    fetchOutstanding();
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
        fetchOutstanding();

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
      } else if (tabParam === "bills" || tabParam === "bill") {
        setActiveTab("BILLS");
      } else if (tabParam === "orders" || tabParam === "order-forms") {
        setActiveTab("ORDERS");
      } else if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab]);

  const pendingOrders = orders.filter((o) => o.status === "Pending" && !o.taxInvoiceNumber);
  const approvedOrders = orders.filter(
    (o) => o.status === "Approved" || o.status === "Confirmed" || Boolean(o.taxInvoiceNumber && o.taxInvoiceNumber.trim())
  );
  const orderForms = orderFormSubTab === "PENDING" ? pendingOrders : approvedOrders;

  // A Bill (Without GST) is specifically an order tagged with [BILL_WITHOUT_GST: ...]
  // or explicitly marked with 0% GST (and not an official tax invoice with 5% GST).
  const isOrderBillWithoutGst = (o: OrderData) => {
    if (o.notes && o.notes.includes("[BILL_WITHOUT_GST")) return true;
    if ((o as any).isBillWithoutGst === true) return true;
    // Official Tax Invoices have 5% GST and gstAmount > 0
    if (o.gstRate && o.gstRate > 0 && o.gstAmount && o.gstAmount > 0) return false;
    // If gstRate is 0 or gstAmount is 0 and customer is Without GST
    const bt = (o.customer?.businessType || (o as any).businessType || "").toUpperCase();
    if ((o.gstRate === 0 || o.gstAmount === 0) && (bt.includes("WITHOUT GST") || bt.includes("NO GST"))) {
      return true;
    }
    return false;
  };

  const finalInvoices = orders.filter(
    (o) =>
      !isOrderBillWithoutGst(o) &&
      (Boolean(o.taxInvoiceNumber && o.taxInvoiceNumber.trim()) ||
        o.status === "Approved" ||
        o.status === "Confirmed" ||
        o.status === "Processing" ||
        o.status === "Ready" ||
        o.status === "Dispatched" ||
        o.status === "Delivered")
  );
  const billsOrders = orders.filter((o) => isOrderBillWithoutGst(o));

  const displayedOrders =
    activeTab === "ORDERS"
      ? orderForms
      : activeTab === "INVOICES"
      ? finalInvoices
      : billsOrders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            {activeTab === "ORDERS" ? (
              <ShoppingCart size={14} />
            ) : activeTab === "INVOICES" ? (
              <Receipt size={14} />
            ) : (
              <FileCheck2 size={14} />
            )}{" "}
            Wholesale Order Fulfillment
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {activeTab === "ORDERS"
              ? "Order Forms"
              : activeTab === "INVOICES"
              ? "Final Tax Invoices"
              : "Bill"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeTab === "ORDERS"
              ? "Manage client booked order forms, color-wise set ratios, mix sizes, transport details, and order booking."
              : activeTab === "INVOICES"
              ? "Official finalized tax invoices generated for deliveries, billing, and accounting with 5% GST."
              : "Dedicated billing section with direct billing and manual sequential bill numbering."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {isSuperAdmin && (
            <Link
              href={activeTab === "BILLS" ? "/admin/employee/orders/new?billType=non_gst" : "/admin/employee/orders/new"}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer ${
                activeTab === "BILLS"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-zinc-950 hover:bg-black text-white"
              }`}
            >
              <Plus size={16} />
              <span>{activeTab === "BILLS" ? "Generate Bill" : "Book New Order"}</span>
            </Link>
          )}
        </div>
      </div>

      {/* SEPARATE TABS: Order Forms vs Final Invoices vs Bill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl overflow-x-auto scrollbar-none">
          {/* 1. Order Forms Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("ORDERS");
              if (pathname.includes("/invoices") || pathname.includes("/bills")) {
                router.push("/admin/employee/orders");
              } else if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "orders");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "ORDERS"
                ? "bg-white text-gray-900 shadow-xs border border-gray-200/80 font-black"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileText size={15} className={activeTab === "ORDERS" ? "text-blue-600" : "text-gray-400"} />
            <span>Order Forms ({orderForms.length})</span>
          </button>

          {/* 2. Final Invoices Tab */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("INVOICES");
              if (pathname.includes("/orders") || pathname.includes("/bills")) {
                router.push("/admin/employee/invoices");
              } else if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "invoices");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "INVOICES"
                ? "bg-amber-500 text-white shadow-xs font-black"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <Receipt size={15} className={activeTab === "INVOICES" ? "text-white" : "text-gray-400"} />
            <span>Final Invoices ({finalInvoices.length})</span>
          </button>

          {/* 3. Dedicated BILL Tab for Wholesale Without GST */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("BILLS");
              if (pathname.includes("/orders") || pathname.includes("/invoices")) {
                router.push("/admin/employee/bills");
              } else if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "bills");
                window.history.replaceState({}, "", url.toString());
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "BILLS"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileCheck2 size={15} className={activeTab === "BILLS" ? "text-white" : "text-gray-400"} />
            <span>Bill ({billsOrders.length})</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 font-medium px-2">
          {activeTab === "ORDERS"
            ? "Showing all Booked Client Order Forms (Ratios & Sets)"
            : activeTab === "INVOICES"
            ? "Showing official Final Tax Invoices with GST"
            : "Direct bills with custom numbering"}
        </div>
      </div>

      {/* Sub-Tabs for Order Forms (Pending vs Approved) */}
      {activeTab === "ORDERS" && (
        <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-gray-200/80 shadow-2xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2">Order Form Status:</span>
          <button
            type="button"
            onClick={() => setOrderFormSubTab("PENDING")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              orderFormSubTab === "PENDING"
                ? "bg-amber-500 text-white shadow-xs font-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Clock size={13} />
            <span>Pending Orders ({pendingOrders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setOrderFormSubTab("APPROVED")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              orderFormSubTab === "APPROVED"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Approved Orders ({approvedOrders.length})</span>
          </button>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === "ORDERS"
                  ? "Search by order #, customer, or phone..."
                  : activeTab === "INVOICES"
                  ? "Search by invoice #, customer, or phone..."
                  : "Search by bill #, customer, or phone..."
              }
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs cursor-pointer"
          >
            <option value="All">All Statuses</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">
                  {activeTab === "INVOICES" ? "Invoice #" : activeTab === "BILLS" ? "Bill #" : "Order Form #"}
                </th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6">{activeTab === "BILLS" ? "Customer & Type" : "Customer & City"}</th>
                {activeTab !== "BILLS" && <th className="py-3.5 px-6">Outstanding</th>}
                <th className="py-3.5 px-6">Sets / Pcs</th>
                <th className="py-3.5 px-6">
                  {activeTab === "BILLS" ? "Bill Amount" : "Total Amount & Status"}
                </th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    {activeTab === "ORDERS"
                      ? "Loading order forms..."
                      : activeTab === "INVOICES"
                      ? "Loading final tax invoices..."
                      : "Loading bills..."}
                  </td>
                </tr>
              ) : displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    {activeTab === "ORDERS"
                      ? "No order forms found. Click 'Book New Order' to create a client order."
                      : activeTab === "INVOICES"
                      ? "No final tax invoices found. Once orders are ready or tax invoices are generated, they appear here."
                      : (
                        <div className="flex flex-col items-center justify-center gap-2 py-2">
                          <p>No bills found.</p>
                          {isSuperAdmin && (
                            <Link
                              href="/admin/employee/orders/new?billType=non_gst"
                              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                            >
                              <Plus size={14} />
                              <span>Generate Bill</span>
                            </Link>
                          )}
                        </div>
                      )}
                  </td>
                </tr>
              ) : (
                displayedOrders.map((o) => {
                  const isFinalInvoiceGenerated =
                    (Boolean(o.taxInvoiceNumber && o.taxInvoiceNumber.trim()) ||
                    activeTab === "INVOICES") &&
                    o.status !== "Pending";
                  const isBillTab = activeTab === "BILLS";
                  const custOutstanding =
                    outstandingMap[o.customerId] !== undefined ? outstandingMap[o.customerId] : 0;

                  return (
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
                        ) : activeTab === "BILLS" ? (
                          <div className="font-mono font-bold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-emerald-950 text-sm">
                              {(() => {
                                const match = o.notes?.match(/\[BILL_WITHOUT_GST:\s*([^\]]+)\]/);
                                const billNo = match ? match[1].trim() : (o.taxInvoiceNumber || o.orderNumber);
                                return billNo?.startsWith("#") ? billNo : `#${billNo || o.id}`;
                              })()}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Bill
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
                          {formatDate(
                            activeTab === "INVOICES" && o.taxInvoiceDate
                              ? o.taxInvoiceDate
                              : o.orderDate || o.createdAt
                          )}
                        </div>
                        {o.placedBy && (
                          <div className="text-[10px] text-gray-400 mt-0.5">By: {o.placedBy}</div>
                        )}
                      </td>

                      {/* 3. Customer Name & Type / City */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-gray-900">
                          {o.customer?.shopName || "Customer #" + o.customerId}
                        </div>
                        {activeTab === "BILLS" ? (
                          <div className="mt-1">
                            {(() => {
                              const bt = (o.customer?.businessType || (o as any).businessType || "").toUpperCase();
                              if (bt.includes("SPECIAL DISCOUNT")) {
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                    RETAILER (SPL DISCOUNT NO GST)
                                  </span>
                                );
                              }
                              if (bt.includes("WHOLESAL")) {
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200">
                                    WHOLESALER WITHOUT GST
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  RETAILER WITHOUT GST
                                </span>
                              );
                            })()}
                          </div>
                        ) : o.customer?.city ? (
                          <div className="text-[10px] text-gray-400 mt-0.5 font-medium">
                            {o.customer.city}
                          </div>
                        ) : null}
                      </td>

                      {/* 4. Customer Outstanding Balance (Hidden on Bills tab) */}
                      {activeTab !== "BILLS" && (
                        <td className="py-4 px-6">
                          <span
                            className={`font-mono font-bold px-2 py-1 rounded-lg text-xs ${
                              custOutstanding > 0
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {formatCurrency(custOutstanding)}
                          </span>
                        </td>
                      )}

                      {/* 5. Sets & Pieces */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-gray-800">{o.totalSets} Sets</div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          {o.totalPcs} Pcs
                        </div>
                      </td>

                      {/* 6. Amount & Status */}
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

                      {/* 7. Actions */}
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        {/* ─────────────────────────────────────────────────────────────
                            FINAL INVOICE GENERATED (or Invoices / Bills Tab):
                            STRICT REQUIREMENT: "Once the final invoice is generated
                            just show the action buttons: Whatsapp, Status Update, View the PDF"
                            ───────────────────────────────────────────────────────────── */}
                        {isFinalInvoiceGenerated || isBillTab ? (
                          <>
                            {/* Edit Button (if order status is converted back to Pending) */}
                            {o.status === "Pending" && (
                              <Link
                                href={`/admin/employee/orders/${o.id}`}
                                className="p-1.5 inline-flex text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Order Form"
                              >
                                <Edit size={15} />
                              </Link>
                            )}

                            {/* 1. WhatsApp Button */}
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
                                    toast(
                                      `✅ PDF generated & sent directly to ${
                                        data.customerName || "customer"
                                      } (${data.customerPhone || ""}) via WhatsApp!`,
                                      "success"
                                    );
                                  } else {
                                    toast(
                                      data.error ||
                                        "Could not dispatch WhatsApp message. Please check WhatsApp Gateway.",
                                      "error"
                                    );
                                  }
                                } catch {
                                  toast("Could not send WhatsApp message", "error");
                                }
                              }}
                              className="p-1.5 inline-flex text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Send PDF on WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </button>

                            {/* 2. Status Update Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setStatusModalOrder(o);
                                setNewStatus(o.status as OrderStatus);
                              }}
                              className="p-1.5 inline-flex text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Update Status"
                            >
                              <Clock size={15} />
                            </button>

                            {/* 3. View the PDF Button */}
                            <a
                              href={`/api/orders/${o.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 inline-flex text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="View the PDF"
                            >
                              <FileText size={15} />
                            </a>
                          </>
                        ) : (
                          /* ─────────────────────────────────────────────────────────────
                             REGULAR UNFINALIZED ORDER FORM:
                             WhatsApp, Edit (if Pending), View Order, Status Update, Delete
                             ───────────────────────────────────────────────────────────── */
                          <>
                            {/* Approve Order Button -> Generates Final Tax Invoice */}
                            {o.status === "Pending" && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Approve order #${o.orderNumber} and generate Final Tax Invoice?`)) return;
                                  try {
                                    const res = await fetch(`/api/orders/${o.id}/status`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ status: "Approved" }),
                                    });
                                    if (res.ok) {
                                      toast(`✅ Order #${o.orderNumber} approved & Final Tax Invoice generated!`, "success");
                                      fetchOrders();
                                      fetchOutstanding();
                                    } else {
                                      const err = await res.json();
                                      toast(err.error || "Failed to approve order", "error");
                                    }
                                  } catch (err: any) {
                                    toast("Error: " + err.message, "error");
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Approve order and create Final Tax Invoice"
                              >
                                <CheckCircle2 size={13} />
                                <span>Approve</span>
                              </button>
                            )}

                            {/* WhatsApp Button */}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/orders/${o.id}/whatsapp`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      type: "ORDER_CONFIRMATION",
                                      formatType: "order_form",
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.automated) {
                                    toast(
                                      `✅ Order Form PDF generated & sent directly to ${
                                        data.customerName || "customer"
                                      } (${data.customerPhone || ""}) via WhatsApp!`,
                                      "success"
                                    );
                                  } else {
                                    toast(
                                      data.error || "Could not dispatch WhatsApp message.",
                                      "error"
                                    );
                                  }
                                } catch {
                                  toast("Could not send WhatsApp message", "error");
                                }
                              }}
                              className="p-1.5 inline-flex text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Send Order Form on WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </button>

                            {/* Edit Order */}
                            <Link
                              href={`/admin/employee/orders/${o.id}`}
                              className="p-1.5 inline-flex text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Order Form items & quantities"
                            >
                              <Edit size={15} />
                            </Link>

                            {/* View Dedicated Page */}
                            <Link
                              href={`/admin/employee/orders/${o.id}?format=order-form`}
                              className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Order Form"
                            >
                              <Eye size={15} />
                            </Link>

                            {/* Status Update Button */}
                            <button
                              type="button"
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
                                title="Dispatched orders cannot be deleted"
                              >
                                <Trash2 size={15} />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setOrderToDelete(o)}
                                className="p-1.5 inline-flex text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
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
                {activeTab === "INVOICES"
                  ? ["Processing", "Ready", "Dispatched", "Delivered", "Cancelled by Customer"].map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))
                  : activeTab === "ORDERS"
                  ? ["Pending", "Approved"].map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))
                  : ORDER_STATUSES.map((st) => (
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
            fetchOutstanding();
          }}
        />
      )}
    </div>
  );
}
