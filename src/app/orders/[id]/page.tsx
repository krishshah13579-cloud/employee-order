"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Printer,
  Calendar,
  AlertCircle,
  FileText,
  Building,
  Phone,
  MessageCircle,
  Bell,
  Truck,
  Clock,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import { STATUS_COLORS, type OrderStatus } from "@/lib/types";
import type { ColorSetEntry } from "@/lib/types";
import TaxInvoiceA4 from "@/components/orders/TaxInvoiceA4";

interface EditableOrderItem {
  id?: number;
  productId: number;
  productName: string;
  category?: string;
  colorSets: ColorSetEntry[];
  sizeRatio: string;
  sizesList?: string;
  pcsPerSet: number;
  totalSets: number;
  totalPcs: number;
  unitPrice: number;
  itemSubtotal: number;
  notes?: string;
}

export default function OrderEditPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = params?.id as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Order Details
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>("");
  const [status, setStatus] = useState<OrderStatus>("Pending");
  const [placedBy, setPlacedBy] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [businessType, setBusinessType] = useState<string>("RETAILER");
  const [creditDays, setCreditDays] = useState<number>(45);
  const [transportName, setTransportName] = useState<string>("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState<boolean>(false);

  // Customer Details
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerGstPan, setCustomerGstPan] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [customerContactPerson, setCustomerContactPerson] = useState<string>("");
  const [customerCity, setCustomerCity] = useState<string>("");
  const [customerState, setCustomerState] = useState<string>("");
  const [customerVisitingCardUrl, setCustomerVisitingCardUrl] = useState<string>("");

  // Items
  const [items, setItems] = useState<EditableOrderItem[]>([]);

  // WhatsApp Sender Handler
  const handleSendWhatsApp = async (type: "ORDER_CONFIRMATION" | "PAYMENT_REMINDER" = "ORDER_CONFIRMATION") => {
    try {
      setSendingWhatsApp(true);
      const res = await fetch(`/api/orders/${orderId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process WhatsApp request");
      }

      if (data.automated) {
        toast(
          type === "PAYMENT_REMINDER"
            ? "✅ Payment reminder sent directly to customer's WhatsApp!"
            : "✅ Tax Invoice & order updates sent directly to customer's WhatsApp!",
          "success"
        );
      } else if (data.whatsappUrl) {
        toast(
          type === "PAYMENT_REMINDER"
            ? "Opening WhatsApp with Payment Reminder..."
            : "Opening WhatsApp with Tax Invoice & Updates...",
          "success"
        );
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      toast(err.message || "Could not open WhatsApp", "error");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Fetch Order
  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        throw new Error(`Failed to load order #${orderId} (${res.status})`);
      }
      const data = await res.json();

      setOrderNumber(data.orderNumber);
      setOrderDate(data.orderDate || data.createdAt);
      setStatus(data.status as OrderStatus);
      setPlacedBy(data.placedBy || "");
      setOrderNotes(data.notes || "");
      setBusinessType(data.businessType || data.customer?.businessType || "RETAILER");
      setCreditDays(data.creditDays !== undefined ? data.creditDays : data.customer?.creditDays || 45);

      let transport = data.transportName || "";
      if (!transport && data.notes) {
        const match = data.notes.match(/\[TRANSPORT:\s*([^\]|]+)/i);
        if (match && match[1]) transport = match[1].trim();
      }
      setTransportName(transport);

      setCustomerId(data.customerId);
      setCustomerName(data.customerName || (data.customer?.shopName || ""));
      setCustomerGstPan(data.customerGstPan || (data.customer?.gstPanNo || ""));
      setCustomerPhone(data.customerPhone || (data.customer?.phoneNumber || ""));
      setCustomerAddress(data.customerAddress || (data.customer?.address || ""));
      setCustomerContactPerson(data.customer?.contactPerson || "");
      setCustomerCity(data.customer?.city || "");
      setCustomerState(data.customer?.state || "");
      setCustomerVisitingCardUrl(data.customer?.visitingCardUrl || "");

      // Parse order items
      const parsedItems: EditableOrderItem[] = (data.items || []).map((it: any) => {
        let colorSets: ColorSetEntry[] = [];
        try {
          if (Array.isArray(it.colorSets)) {
            colorSets = it.colorSets;
          } else if (typeof it.colorSets === "string") {
            colorSets = JSON.parse(it.colorSets || "[]");
          }
        } catch {
          colorSets = [];
        }

        return {
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          category: it.product?.category,
          colorSets: colorSets,
          sizeRatio: it.sizeRatio || it.product?.sizesRatio || "30 to 38",
          sizesList: it.sizesList || it.product?.sizesList,
          pcsPerSet: it.pcsPerSet || it.product?.pcsPerSet || 5,
          totalSets: it.totalSets || 0,
          totalPcs: it.totalPcs || 0,
          unitPrice: it.unitPrice || 0,
          itemSubtotal: it.itemSubtotal || 0,
          notes: it.notes || "",
        };
      });

      setItems(parsedItems);
    } catch (err: any) {
      console.error("Error loading order:", err);
      setError(err.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
    // Check if current user is admin/super admin
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});

  }, [orderId]);

  // Order Totals Calculations
  const totalSets = items.reduce((sum, it) => sum + (it.totalSets || 0), 0);
  const totalPcs = items.reduce((sum, it) => sum + (it.totalPcs || 0), 0);
  const subtotal = items.reduce((sum, it) => sum + (it.itemSubtotal || 0), 0);
  const gstRate = 5.0; // 5% GST
  const gstAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round(subtotal + gstAmount);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-600">Loading Order Form #{orderId}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Order Not Found</h2>
          <p className="text-xs text-slate-500 mt-2">{error}</p>
          <Link
            href="/orders"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            <ArrowLeft size={16} />
            <span>Return to Orders</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Hide header when printing invoice */}
      <div className="print:hidden">
        <UserHeader showBack />
      </div>

      {/* Top Bar */}
      <div className="bg-slate-900 text-white border-b border-slate-800 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link href="/" className="hover:text-white transition">
                Home
              </Link>
              <span>/</span>
              <Link href="/orders" className="hover:text-white transition">
                Orders
              </Link>
              <span>/</span>
              <span className="text-orange-400 font-mono font-bold">
                {orderNumber || `Order #${orderId}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Order Form &amp; Details
              </h1>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  STATUS_COLORS[status] || "bg-slate-800 text-slate-200 border-slate-700"
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Review customer wholesale order details, status, and print order slips.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Invoice Button */}
            <button
              type="button"
              disabled={sendingWhatsApp}
              onClick={() => handleSendWhatsApp("ORDER_CONFIRMATION")}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-900/30 cursor-pointer"
              title="Send Tax Invoice PDF link & order confirmation to customer on WhatsApp"
            >
              <MessageCircle size={15} />
              <span>{sendingWhatsApp ? "Sending..." : "Send on WhatsApp"}</span>
            </button>

            {/* Weekly Payment Reminder Button */}
            <button
              type="button"
              disabled={sendingWhatsApp}
              onClick={() => handleSendWhatsApp("PAYMENT_REMINDER")}
              className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-amber-900/30 cursor-pointer"
              title="Send weekly payment due reminder to customer on WhatsApp"
            >
              <Bell size={14} />
              <span>Weekly Reminder</span>
            </button>

            {/* Print A4 Tax Invoice */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Print standard A4 Tax Invoice (Krish Clothing Co.)"
            >
              <Printer size={15} />
              <span>Print A4 Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Order Form View (Hidden during print) */}
      <div className="print:hidden">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* ═══════════════════════════════════════════
              1. CUSTOMER & ORDER STATUS DETAILS
              ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-orange-600" />
              <h2 className="text-base font-black text-slate-900">
                Customer &amp; Order Information
              </h2>
            </div>
          </div>

          <div className="p-4 bg-orange-50/30 rounded-2xl border border-orange-200/80 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 flex-1 w-full">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    FIRM NAME
                  </span>
                  <span className="font-black text-slate-900 text-sm">
                    {customerName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    GST NO. / PAN NO.
                  </span>
                  <span className="font-mono font-black text-orange-600 text-sm">
                    {customerGstPan || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    PHONE NUMBER
                  </span>
                  <span className="font-bold text-slate-800 text-sm">
                    {customerPhone || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    Contact PERSON NAME
                  </span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {customerContactPerson || "—"}
                  </span>
                </div>
              </div>

              {customerVisitingCardUrl && (
                <div className="shrink-0 flex flex-col items-center">
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">
                    VISITING CARD
                  </span>
                  <a
                    href={customerVisitingCardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block w-16 h-12 rounded-lg overflow-hidden border border-orange-200 shadow-xs hover:ring-2 hover:ring-orange-500 transition"
                    title="Click to view visiting card full size"
                  >
                    <img
                      src={customerVisitingCardUrl}
                      alt="Visiting Card"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                      View
                    </div>
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-orange-100">
              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                  Shop Address
                </span>
                <span className="font-medium text-slate-800">
                  {customerAddress || "Address on File"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    CITY
                  </span>
                  <span className="font-bold text-slate-900">
                    {customerCity || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    STATE
                  </span>
                  <span className="font-bold text-slate-900">
                    {customerState || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            {/* Current Order Status (Read-Only on Employee Side) */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
              <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1.5">
                Current Order Status
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-xs border ${
                    STATUS_COLORS[status] || "bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  <span>{status}</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  (Updated by Admin)
                </span>
              </div>
            </div>

            {/* Credit Days & Transport Information */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
              <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1.5">
                Credit Terms & Transport
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-300">
                  <Clock size={12} className="text-orange-500" />
                  <span>{creditDays > 0 ? `${creditDays} Days Credit` : "Advance (0 Days)"}</span>
                </span>
                {transportName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-blue-900 border border-blue-200">
                    <span>🚚 {transportName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            2. ORDER FORM ITEMS TABLE
            COLUMNS: Customer Name, GST/PAN No., Product Name, Colors, PCS, Price, Total Amount
            ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Wholesale Garment Items</span>
                <span className="text-xs font-bold text-slate-500">
                  ({items.length} {items.length === 1 ? "product" : "products"})
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Itemized wholesale product breakdown, color sets, and pieces in this order.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Colors &amp; Sets</th>
                  <th className="py-3.5 px-4 text-center">PCS</th>
                  <th className="py-3.5 px-4 text-right">Price (₹/pc)</th>
                  <th className="py-3.5 px-4 text-right">Total Amount (₹)</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      No items currently in this order.
                    </td>
                  </tr>
                ) : (
                  items.map((item, itemIdx) => (
                    <tr key={itemIdx} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Product Name */}
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900 text-sm">
                          {item.productName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Ratio: {item.sizeRatio} ({item.pcsPerSet || 5} pcs/set)
                        </div>
                      </td>

                      {/* Colors & Sets (Read-Only) */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          {item.colorSets && item.colorSets.length > 0 ? (
                            item.colorSets.map((cs) => (
                              <div
                                key={cs.color}
                                className="inline-flex items-center gap-1.5 mr-2 mb-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: getColorHex(cs.color).hex }}
                                />
                                <span className="font-bold text-slate-800">{cs.color}:</span>
                                <span className="font-mono font-black text-orange-600">{cs.sets}</span>
                                <span className="text-[10px] text-slate-500">sets</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400 italic">No color sets</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                          Total Sets: {item.totalSets}
                        </div>
                      </td>

                      {/* PCS */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-black text-slate-900 text-sm">
                          {item.totalPcs}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Pcs</span>
                      </td>

                      {/* Price (Read-Only) */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(item.unitPrice)}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        {formatCurrency(item.itemSubtotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            3. SUMMARY & DISPATCH DETAILS
            ═══════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Notes and Placed By */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              Order Notes &amp; Dispatch Instructions
            </h3>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Placed By
              </span>
              <div className="font-bold text-slate-900 text-sm">
                {placedBy || "Admin / Sales Employee"}
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Order Notes
              </span>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap min-h-[60px]">
                {orderNotes || "No special instructions provided."}
              </div>
            </div>
          </div>

          {/* Wholesale Totals Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 pb-3 border-b border-slate-100">
              Wholesale Order Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Ordered Sets:</span>
                <span className="font-bold text-slate-900">{totalSets} Sets</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Total Ordered Pieces (PCS):</span>
                <span className="font-bold text-slate-900">{totalPcs} Pcs</span>
              </div>

              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Subtotal:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST (5%):</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(gstAmount)}
                </span>
              </div>

              <div className="flex justify-between items-baseline pt-3 border-t-2 border-slate-900 text-sm">
                <span className="font-black text-slate-900 text-base">Grand Total:</span>
                <span className="font-black text-2xl text-orange-600">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    {/* ═══════════════════════════════════════════
        EXACT A4 TAX INVOICE PRINT VIEW
        (Krish Clothing Co. Tax Invoice format)
        ═══════════════════════════════════════════ */}
    <div className="hidden print:block py-2">
      <TaxInvoiceA4
        order={{
          orderNumber,
          orderDate,
          status,
          customerName,
          customerGstPan,
          customerPhone,
          customerAddress,
          customerCity,
          customerState,
          businessType,
          creditDays,
          transportName,
          subtotal,
          gstRate,
          gstAmount,
          grandTotal,
          totalPcs,
          totalSets,
          placedBy,
          notes: orderNotes,
          items: items.map((it) => ({
            id: it.id,
            productName: it.productName,
            colorSets: it.colorSets,
            sizeRatio: it.sizeRatio,
            pcsPerSet: it.pcsPerSet,
            totalSets: it.totalSets,
            totalPcs: it.totalPcs,
            unitPrice: it.unitPrice,
            itemSubtotal: it.itemSubtotal,
          })),
        }}
      />
    </div>

    </div>
  );
}
