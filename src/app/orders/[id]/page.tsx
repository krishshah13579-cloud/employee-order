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
  Eye,
  X,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, getColorAlphabetLetter, formatProductNameWithMrp } from "@/lib/utils";
import { openWhatsAppDirectly, shareOrOpenWhatsAppWithPdf } from "@/lib/whatsapp-client";
import { getColorHex } from "@/lib/colors";
import { STATUS_COLORS, type OrderStatus, type ColorSetEntry } from "@/lib/types";
import TaxInvoiceA4 from "@/components/orders/TaxInvoiceA4";
import { getProductMixSizesInfo, getColorShadeLetter, parseMixSizesForDisplay } from "@/lib/stock";

interface EditableOrderItem {
  id?: number;
  productId: number;
  productName: string;
  mrp?: number | null;
  product?: any;
  category?: string;
  colorSets: ColorSetEntry[];
  colorMapping?: string | null;
  colorsAvailable?: string | null;
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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

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
  const [viewVisitingCard, setViewVisitingCard] = useState<string | null>(null);

  // Items
  const [items, setItems] = useState<EditableOrderItem[]>([]);
  const [taxInvoiceNumber, setTaxInvoiceNumber] = useState<string>("");
  const [taxInvoiceDate, setTaxInvoiceDate] = useState<string>("");
  const [taxInvoiceItems, setTaxInvoiceItems] = useState<EditableOrderItem[]>([]);
  const [templateOverrides, setTemplateOverrides] = useState<any>(null);
  const [formatType, setFormatType] = useState<"ORDER_FORM" | "TAX_INVOICE">("ORDER_FORM");

  // WhatsApp Sender Handler
  const handleSendWhatsApp = async (type: "ORDER_CONFIRMATION" | "TAX_INVOICE" | "PAYMENT_REMINDER" = "ORDER_CONFIRMATION") => {
    try {
      setSendingWhatsApp(true);
      const isTax = type === "TAX_INVOICE" || (type === "ORDER_CONFIRMATION" && formatType === "TAX_INVOICE");
      const res = await fetch(`/api/orders/${orderId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type === "PAYMENT_REMINDER" ? "PAYMENT_REMINDER" : isTax ? "TAX_INVOICE" : "ORDER_CONFIRMATION",
          formatType: isTax ? "tax_invoice" : "order_form",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process WhatsApp request");
      }

      if (data.automated) {
        toast(
          type === "PAYMENT_REMINDER"
            ? "Payment reminder sent directly to customer's WhatsApp!"
            : isTax
            ? "Tax Invoice sent directly to customer's WhatsApp with updated quantities!"
            : "Order Form sent directly to customer's WhatsApp!",
          "success"
        );
      } else if (data.whatsappUrl || data.nativeUrl) {
        await shareOrOpenWhatsAppWithPdf({
          whatsappUrl: data.whatsappUrl,
          nativeUrl: data.nativeUrl,
          pdfUrl: data.pdfUrl || `/api/orders/${orderId}/pdf?type=${isTax ? "tax_invoice" : "order_form"}`,
          filename: `${isTax ? "Tax_Invoice" : "Order_Form"}_${orderNumber || orderId}.pdf`,
          text: data.message,
          onToast: toast,
        });
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
      setCustomerName((data.customerName || data.customer?.shopName || "").toUpperCase());
      setCustomerGstPan((data.customerGstPan || data.customer?.gstPanNo || "").toUpperCase());
      setCustomerPhone(data.customerPhone || data.customer?.phoneNumber || "");
      setCustomerAddress((data.customerAddress || data.customer?.address || "").toUpperCase());
      setCustomerContactPerson((data.customer?.contactPerson || "").toUpperCase());
      setCustomerCity((data.customer?.city || "").toUpperCase());
      setCustomerState((data.customer?.state || "").toUpperCase());
      setCustomerVisitingCardUrl(data.customer?.visitingCardUrl || "");

      setTaxInvoiceNumber(data.taxInvoiceNumber || "");
      setTaxInvoiceDate(data.taxInvoiceDate || "");
      setTemplateOverrides(data.templateOverrides || null);

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
          mrp: it.product?.mrp || it.mrp || null,
          product: it.product,
          category: it.product?.category,
          colorSets: colorSets,
          colorMapping: it.product?.colorMapping || it.colorMapping || null,
          colorsAvailable: it.product?.colorsAvailable || it.colorsAvailable || null,
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

      // Parse tax invoice items if available
      if (data.taxInvoiceItems) {
        try {
          const parsedTaxItems = JSON.parse(data.taxInvoiceItems);
          if (Array.isArray(parsedTaxItems) && parsedTaxItems.length > 0) {
            setTaxInvoiceItems(parsedTaxItems);
            if (data.status === "Ready" || data.status === "Dispatched" || data.status === "Delivered" || data.taxInvoiceNumber) {
              setFormatType("TAX_INVOICE");
            }
          }
        } catch {}
      }
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

  // Active items based on selected format
  const activeItems =
    formatType === "TAX_INVOICE" && taxInvoiceItems.length > 0
      ? taxInvoiceItems
      : items.length > 0
      ? items
      : taxInvoiceItems;

  // Order Totals Calculations
  const totalSets = activeItems.reduce((sum, it) => sum + (it.totalSets || 0), 0);
  const totalPcs = activeItems.reduce((sum, it) => sum + (it.totalPcs || 0), 0);
  const subtotal = activeItems.reduce((sum, it) => sum + (it.itemSubtotal || 0), 0);
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
      {/* Interactive Order Form View (Hidden during print) */}
      <div className="print:hidden">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* Top Header: Only keep H1 tag and Preview button */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Order Form
            </h1>

            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer"
              title="Preview Order Form"
            >
              <Eye size={15} />
              <span>Preview Order Form</span>
            </button>
          </div>
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
                  <span className="font-black text-slate-900 text-sm uppercase">
                    {customerName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    GST NO. / PAN NO.
                  </span>
                  <span className="font-mono font-black text-orange-600 text-sm uppercase">
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
                  <span className="font-semibold text-slate-800 text-xs uppercase">
                    {customerContactPerson || "—"}
                  </span>
                </div>
              </div>

              {customerVisitingCardUrl && (
                <div className="shrink-0 flex flex-col items-center">
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">
                    VISITING CARD
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewVisitingCard(customerVisitingCardUrl)}
                    className="group relative block w-16 h-12 rounded-lg overflow-hidden border border-orange-200 shadow-xs hover:ring-2 hover:ring-orange-500 transition cursor-pointer"
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
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-orange-100">
              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                  Shop Address
                </span>
                <span className="font-medium text-slate-800 uppercase">
                  {customerAddress || "Address on File"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    CITY
                  </span>
                  <span className="font-bold text-slate-900 uppercase">
                    {customerCity || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    STATE
                  </span>
                  <span className="font-bold text-slate-900 uppercase">
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-blue-900 border border-blue-200 uppercase">
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
                  ({activeItems.length} {activeItems.length === 1 ? "product" : "products"})
                </span>
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Colors &amp; Sets</th>
                  <th className="py-3.5 px-4 text-center">Mix Sizes</th>
                  <th className="py-3.5 px-4 text-center">PCS</th>
                  <th className="py-3.5 px-4 text-right">Price (₹/pc)</th>
                  <th className="py-3.5 px-4 text-right">Total Amount (₹)</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {activeItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No items currently in this order.
                    </td>
                  </tr>
                ) : (
                  activeItems.map((item, itemIdx) => (
                    <tr key={itemIdx} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Product Name */}
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900 text-sm">
                          {formatProductNameWithMrp(
                            item.productName,
                            item.mrp || item.product?.mrp,
                            item.product?.retailerPrice || item.product?.price || item.unitPrice
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Ratio: {item.sizeRatio} ({item.pcsPerSet || 5} pcs/set)
                        </div>
                      </td>

                      {/* Colors & Sets (Read-Only) */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {item.colorSets && item.colorSets.length > 0 ? (
                            item.colorSets
                              .filter((cs) => Number(cs.sets) > 0)
                              .map((cs, cIdx) => {
                                const letter = getColorAlphabetLetter(
                                  cs.color,
                                  item.colorMapping,
                                  item.colorsAvailable,
                                  cIdx
                                );
                                return (
                                  <div
                                    key={cIdx}
                                    className="flex items-center gap-1.5 text-xs py-0.5"
                                  >
                                    <span className="w-5 h-5 rounded bg-zinc-900 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {letter}
                                    </span>
                                    <span className="font-bold text-slate-800">
                                      {letter}: {cs.sets} {Number(cs.sets) === 1 ? "Set" : "Sets"}
                                    </span>
                                  </div>
                                );
                              })
                          ) : (
                            <span className="text-slate-400 italic">No color sets</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                          Total Sets: {item.totalSets}
                        </div>
                      </td>

                      {/* Mix Sizes (Next Column) */}
                      <td className="py-4 px-4 text-left">
                        {(() => {
                          const mixMatch = item.notes?.match(/\[Mix Sizes:\s*([^\]]+)\]/i)?.[1];
                          const formattedMix = parseMixSizesForDisplay(
                            { mixSizes: mixMatch || item.product?.mixSizes, mixPcs: item.product?.mixPcs },
                            item.product
                          );

                          if (formattedMix.length === 0) {
                            const mixInfo = getProductMixSizesInfo(
                              item.product?.setsColorwise,
                              item.product?.mixPcs || 0
                            );
                            if (mixInfo.totalMixPcs <= 0) {
                              return (
                                <div className="text-center">
                                  <span className="text-[11px] text-slate-400 font-medium italic">—</span>
                                </div>
                              );
                            }
                            const fallback = parseMixSizesForDisplay({ mixSizes: mixInfo.sizesSummary, mixPcs: mixInfo.totalMixPcs }, item.product);
                            if (fallback.length > 0) {
                              return (
                                <div className="flex flex-col gap-1.5 min-w-[100px]">
                                  {fallback.map((entry, eIdx) => (
                                    <div
                                      key={eIdx}
                                      className="bg-amber-50/80 border border-amber-300 rounded-lg p-2 font-mono text-xs shadow-2xs"
                                    >
                                      <div className="font-black text-slate-900 flex items-center gap-1">
                                        <span className="px-1.5 py-0.2 rounded bg-orange-600 text-white font-black text-[10px]">
                                          {entry.letter}
                                        </span>
                                        <span className="text-slate-400">-</span>
                                        <span className="text-amber-900 font-bold">
                                          {entry.sizes[0].size}-{entry.sizes[0].count}
                                        </span>
                                      </div>
                                      {entry.sizes.slice(1).map((sz, sIdx) => (
                                        <div key={sIdx} className="text-amber-900 font-bold pl-7 pt-0.5 text-xs">
                                          {sz.size}-{sz.count}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div className="text-center">
                                <span className="text-[11px] text-slate-400 font-medium italic">—</span>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-1.5 min-w-[100px]">
                              {formattedMix.map((entry, eIdx) => (
                                <div
                                  key={eIdx}
                                  className="bg-amber-50/80 border border-amber-300 rounded-lg p-2 font-mono text-xs shadow-2xs"
                                >
                                  <div className="font-black text-slate-900 flex items-center gap-1">
                                    <span className="px-1.5 py-0.2 rounded bg-orange-600 text-white font-black text-[10px]">
                                      {entry.letter}
                                    </span>
                                    <span className="text-slate-400">-</span>
                                    <span className="text-amber-900 font-bold">
                                      {entry.sizes[0].size}-{entry.sizes[0].count}
                                    </span>
                                  </div>
                                  {entry.sizes.slice(1).map((sz, sIdx) => (
                                    <div key={sIdx} className="text-amber-900 font-bold pl-7 pt-0.5 text-xs">
                                      {sz.size}-{sz.count}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
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
    <div className="hidden print:block py-1">
      <TaxInvoiceA4
        formatType={formatType}
        order={{
          orderNumber,
          orderDate,
          taxInvoiceNumber: formatType === "TAX_INVOICE" ? taxInvoiceNumber : null,
          taxInvoiceDate: formatType === "TAX_INVOICE" ? taxInvoiceDate : null,
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
          templateOverrides,
          items: activeItems.map((it) => ({
            id: it.id,
            productName: it.productName,
            mrp: it.mrp || it.product?.mrp,
            product: it.product,
            colorSets: it.colorSets,
            colorMapping: it.colorMapping,
            colorsAvailable: it.colorsAvailable,
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

    {/* ═══════════════════════════════════════════
        ON-SCREEN A4 TAX INVOICE PREVIEW MODAL
        ═══════════════════════════════════════════ */}
    {isPreviewModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 overflow-y-auto print:hidden">
        <div className="bg-slate-100 rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-300">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-orange-500" />
              <div>
                <span className="font-bold text-sm block">Krish Clothing Co. — A4 Tax Invoice Preview</span>
                <span className="text-[10px] text-slate-400 font-mono">Format matches physical tax invoice sample</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setTimeout(() => window.print(), 100);
                }}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Printer size={14} />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close Preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body: A4 Paper Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-300/80 flex justify-center">
            <div className="bg-white shadow-xl p-3 sm:p-5 w-full max-w-[780px] rounded-sm">
              <TaxInvoiceA4
                formatType={formatType}
                order={{
                  orderNumber,
                  orderDate,
                  taxInvoiceNumber: formatType === "TAX_INVOICE" ? taxInvoiceNumber : null,
                  taxInvoiceDate: formatType === "TAX_INVOICE" ? taxInvoiceDate : null,
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
                  templateOverrides,
                  items: activeItems.map((it) => ({
                    id: it.id,
                    productName: it.productName,
                    mrp: it.mrp || it.product?.mrp,
                    product: it.product,
                    colorSets: it.colorSets,
                    colorMapping: it.colorMapping,
                    colorsAvailable: it.colorsAvailable,
                    sizeRatio: it.sizeRatio,
                    pcsPerSet: it.pcsPerSet,
                    totalSets: it.totalSets,
                    totalPcs: it.totalPcs,
                    unitPrice: it.unitPrice,
                    itemSubtotal: it.itemSubtotal,
                  })),
                }}
                allowInlineEdit={true}
                onSaveOverrides={async (overrides) => {
                  const res = await fetch(`/api/orders/${orderId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ templateOverrides: overrides }),
                  });
                  if (!res.ok) {
                    const d = await res.json();
                    throw new Error(d.error || "Failed to save template edits");
                  }
                  toast("Invoice customization saved successfully!", "success");
                  fetchOrder();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Visiting Card Lightbox Modal */}
      <Modal
        isOpen={!!viewVisitingCard}
        onClose={() => setViewVisitingCard(null)}
        title="Visiting Card Preview"
        size="lg"
      >
        <div className="flex flex-col items-center justify-center p-2 bg-slate-100 rounded-xl">
          {viewVisitingCard && (
            <img
              src={viewVisitingCard}
              alt="Customer Visiting Card"
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-md"
            />
          )}
          <div className="mt-4 flex justify-end w-full">
            <button
              type="button"
              onClick={() => setViewVisitingCard(null)}
              className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
