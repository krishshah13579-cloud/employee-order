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
  Lock,
  Edit3,
  X,
  Plus,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, getColorAlphabetLetter, formatProductNameWithMrp } from "@/lib/utils";
import { openWhatsAppDirectly, shareOrOpenWhatsAppWithPdf } from "@/lib/whatsapp-client";
import { getColorHex } from "@/lib/colors";
import { STATUS_COLORS, type OrderStatus, type ColorSetEntry } from "@/lib/types";
import TaxInvoiceA4 from "@/components/orders/TaxInvoiceA4";
import { getProductMixSizesInfo, getColorShadeLetter, parseMixSizesForDisplay, sanitizeMixSize } from "@/lib/stock";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { sanitizePositiveInt } from "@/lib/navigation";

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
  mixSizes?: string | null;
  mixPcs?: number;
  colorMixPcs?: any;
}

export default function OrderEditPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { employee } = useEmployee();
  const orderId = params?.id as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

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
      const res = await fetch(`/api/orders/${orderNumber || orderId}/whatsapp`, {
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
            ? `✅ Payment reminder & PDF sent directly to ${data.customerName || "customer"} (${data.customerPhone || ""}) via WhatsApp!`
            : isTax
            ? `✅ Tax Invoice PDF generated & sent directly to ${data.customerName || "customer"} (${data.customerPhone || ""}) via WhatsApp!`
            : `✅ Order Form PDF generated & sent directly to ${data.customerName || "customer"} (${data.customerPhone || ""}) via WhatsApp!`,
          "success"
        );
      } else {
        toast(data.error || "Could not dispatch WhatsApp message. Please check WhatsApp Gateway.", "error");
      }
    } catch (err: any) {
      toast(err.message || "Failed to send WhatsApp message", "error");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Fetch Order
  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(null);

      const rawParam = String(orderId || "").trim();
      const safeId = sanitizePositiveInt(rawParam) ? String(sanitizePositiveInt(rawParam)) : rawParam;
      if (!safeId) {
        setError("Invalid order ID or document number.");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/orders/${encodeURIComponent(safeId)}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setAccessDenied(
          errData.error ||
            "Access Denied: You do not have permission to view this order. Customer/order belongs to another employee."
        );
        setLoading(false);
        return;
      }
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

        const mixMatch = it.notes?.match(/\[Mix Sizes:\s*([^\]]+)\]/i)?.[1];
        const rawMix = it.mixSizes || mixMatch || null;
        let parsedColorMixPcs = it.colorMixPcs || null;
        if (typeof parsedColorMixPcs === "string") {
          try {
            parsedColorMixPcs = JSON.parse(parsedColorMixPcs);
          } catch {
            parsedColorMixPcs = null;
          }
        }

        const setsCount = Number(it.totalSets) || 0;
        const pcsPerSet = it.pcsPerSet || it.product?.pcsPerSet || 5;
        const totalPcs = Number(it.totalPcs) || 0;
        const looseDiff = Math.max(0, totalPcs - setsCount * pcsPerSet);
        const effectiveMixPcs = Number(it.mixPcs) > 0 ? Number(it.mixPcs) : looseDiff;

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
          pcsPerSet,
          totalSets: setsCount,
          totalPcs,
          unitPrice: it.unitPrice || 0,
          itemSubtotal: it.itemSubtotal || 0,
          notes: it.notes || "",
          mixSizes: rawMix,
          mixPcs: effectiveMixPcs,
          colorMixPcs: parsedColorMixPcs,
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
  const isWithoutGst =
    businessType === "WHOLESALER WITHOUT GST" ||
    businessType === "WHOLESALE WITHOUT GST" ||
    businessType === "RETAILER WITHOUT GST" ||
    businessType === "RETAILER (WITHOUT GST)" ||
    businessType.toUpperCase().includes("WITHOUT GST") ||
    businessType.toUpperCase().includes("NO GST");
  const gstRate = isWithoutGst ? 0 : 5.0; // 5% GST or 0% for Wholesaler Without GST
  const gstAmount = isWithoutGst ? 0 : Math.round(subtotal * 0.05 * 100) / 100;
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

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Portfolio Access Restricted</h2>
          <p className="text-xs text-slate-600 mt-2">{accessDenied}</p>
          <Link
            href="/orders"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>Return to My Orders</span>
          </Link>
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

            <div className="flex items-center gap-2">
              {/* Edit Order Form Button (Visible if Pending AND approved by Admin) */}
              {status === "Pending" && (
                isAdmin || Boolean(employee?.canEditOrders) || employee?.name?.trim().toLowerCase() === "krish shah" ? (
                  <Link
                    href={`/orders/new?orderId=${orderNumber || orderId}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-900/20 cursor-pointer"
                    title="Edit items, products, size ratios, sets and prices on order form"
                  >
                    <Edit3 size={15} />
                    <span>Edit Order Form</span>
                  </Link>
                ) : (
                  <div
                    className="px-3.5 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 select-none cursor-not-allowed"
                    title="Order form editing requires Administrator approval"
                  >
                    <Lock size={14} className="text-slate-400" />
                    <span>Editing Locked (Admin Approval Required)</span>
                  </div>
                )
              )}

              <button
                type="button"
                onClick={() => handleSendWhatsApp("ORDER_CONFIRMATION")}
                disabled={sendingWhatsApp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/20 cursor-pointer disabled:opacity-50"
                title="Resend WhatsApp with PDF attached directly to customer"
              >
                <MessageCircle size={15} />
                <span>{sendingWhatsApp ? "Sending..." : "Resend WhatsApp (PDF)"}</span>
              </button>

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
          </div>

          {/* Locked Order Notice */}
          {status !== "Pending" && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-3 text-xs text-amber-900 shadow-2xs">
              <Lock size={18} className="text-amber-700 shrink-0" />
              <div>
                <span className="font-bold">Order Confirmed &amp; Locked:</span>{" "}
                <span>This order has been confirmed by administration. The order form is locked and cannot be edited.</span>
              </div>
            </div>
          )}

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

            {status === "Pending" && (
              <Link
                href={`/products?orderId=${orderNumber || orderId}&returnTo=${encodeURIComponent(`/orders/${orderNumber || orderId}`)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs cursor-pointer print:hidden"
                title="Browse store to add another product or mix sizes to this order"
              >
                <Plus size={14} />
                <span>+ Add Product / Mix Size</span>
              </Link>
            )}
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
                        <div className="text-[10px] text-slate-500 flex items-center justify-between gap-2 mt-0.5">
                          <span>Ratio: {item.sizeRatio} ({item.pcsPerSet || 5} pcs/set)</span>
                          {status === "Pending" && (
                            <Link
                              href={`/products/${item.productId || item.product?.id || 1}?orderId=${orderNumber || orderId}&returnTo=${encodeURIComponent(`/orders/${orderNumber || orderId}`)}`}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline print:hidden cursor-pointer"
                              title="Edit this product or add mix sizes on product page"
                            >
                              Edit Product (Mix/Sets) →
                            </Link>
                          )}
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
                          const rawMix = (item as any).mixSizes || mixMatch || null;
                          const pcsPerSet = item.pcsPerSet || item.product?.pcsPerSet || 5;
                          const setsPcs = (Number(item.totalSets) || 0) * pcsPerSet;
                          const totalPcs = Number(item.totalPcs) || 0;
                          const looseDiff = Math.max(0, totalPcs - setsPcs);

                          const hasMix =
                            Boolean(rawMix && rawMix !== "None" && rawMix !== "—") ||
                            Boolean((item as any).colorMixPcs) ||
                            looseDiff > 0 ||
                            Boolean((item as any).mixPcs && Number((item as any).mixPcs) > 0);

                          if (!hasMix) {
                            return (
                              <div className="text-center">
                                <span className="text-[11px] text-slate-400 font-medium italic">—</span>
                              </div>
                            );
                          }

                          const formattedMix = parseMixSizesForDisplay(
                            {
                              mixSizes: rawMix,
                              colorMixPcs: (item as any).colorMixPcs,
                              mixPcs: (item as any).mixPcs || looseDiff,
                              notes: item.notes,
                              totalPcs,
                              totalSets: item.totalSets,
                              pcsPerSet,
                            },
                            item.product
                          );

                          if (formattedMix.length === 0) {
                            return (
                              <div className="flex flex-col gap-1 min-w-[100px]">
                                <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-2 font-mono text-xs shadow-2xs">
                                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white font-black text-[10px]">
                                      MIX
                                    </span>
                                    <span>{looseDiff > 0 ? `${looseDiff} Loose Pcs` : (rawMix || "Mix Sizes")}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-1.5 min-w-[110px]">
                              {formattedMix.map((entry, eIdx) => (
                                <div
                                  key={eIdx}
                                  className="bg-amber-50/90 border border-amber-300 rounded-lg p-2 font-mono text-xs shadow-2xs"
                                >
                                  <div className="font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                                    {entry.letter && entry.letter !== "Mix" && (
                                      <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white font-black text-[10px]">
                                        {entry.letter}
                                      </span>
                                    )}
                                    {entry.colorName && (
                                      <span className="text-slate-800 font-bold text-[11px]">
                                        {entry.colorName}:
                                      </span>
                                    )}
                                    {entry.sizes.map((sz, sIdx) => {
                                      const cleanSz = sanitizeMixSize(sz.size, entry.colorName, item.product);
                                      const isMixLabel = !cleanSz || cleanSz === "Mix";
                                      return (
                                        <span
                                          key={sIdx}
                                          className="inline-flex items-center gap-1 bg-amber-100/90 border border-amber-400/80 px-2 py-0.5 rounded text-[11px] text-amber-900 font-bold"
                                        >
                                          <span>{isMixLabel ? "Mix" : `Size ${cleanSz}`}</span>
                                          <span className="text-orange-700 font-black">
                                            ({sz.count} {sz.count === 1 ? "pc" : "pcs"})
                                          </span>
                                        </span>
                                      );
                                    })}
                                  </div>
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
                <span>{isWithoutGst ? "GST (0%):" : "GST (5%):"}</span>
                <span className="font-bold text-slate-900 text-sm">
                  {isWithoutGst ? "₹0.00" : formatCurrency(gstAmount)}
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
            notes: it.notes,
            mixSizes: (it as any).mixSizes,
            mixPcs: (it as any).mixPcs,
            colorMixPcs: (it as any).colorMixPcs,
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3.5 bg-slate-900 text-white shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={18} className="text-orange-500 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-xs sm:text-sm block truncate">Krish Clothing Co. — A4 Tax Invoice Preview</span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:block">Format matches physical tax invoice sample</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleSendWhatsApp("ORDER_CONFIRMATION")}
                disabled={sendingWhatsApp}
                className="px-2.5 sm:px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                title="Resend WhatsApp with PDF attached directly to customer"
              >
                <MessageCircle size={14} />
                <span className="hidden sm:inline">{sendingWhatsApp ? "Sending..." : "Resend WhatsApp (PDF)"}</span>
                <span className="sm:hidden">{sendingWhatsApp ? "..." : "WhatsApp"}</span>
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

          {/* Modal Body: A4 Paper Preview (mobile-responsive with CSS scale) */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-300/80 flex justify-center">
            <div
              className="bg-white shadow-xl rounded-sm w-full"
              style={{ maxWidth: "780px" }}
            >
              <div
                className="invoice-scale-wrapper"
                style={{
                  /* On mobile, the 780px content is scaled down to fit the container.
                     We use CSS container query via inline style to scale proportionally. */
                  transformOrigin: "top left",
                }}
                ref={(el) => {
                  if (!el) return;
                  const parent = el.parentElement;
                  if (!parent) return;
                  const resizeObserver = new ResizeObserver(() => {
                    const parentWidth = parent.clientWidth;
                    if (parentWidth < 760) {
                      const scale = parentWidth / 780;
                      el.style.transform = `scale(${scale})`;
                      el.style.width = "780px";
                      el.style.height = "auto";
                      // Adjust parent height to match scaled content
                      const contentHeight = el.scrollHeight * scale;
                      parent.style.height = `${contentHeight}px`;
                      parent.style.overflow = "hidden";
                      parent.style.padding = "0";
                    } else {
                      el.style.transform = "none";
                      el.style.width = "100%";
                      parent.style.height = "auto";
                      parent.style.overflow = "visible";
                      parent.style.padding = "";
                    }
                  });
                  resizeObserver.observe(parent);
                  // Cleanup when element is removed
                  (el as any).__resizeObserver = resizeObserver;
                  return () => resizeObserver.disconnect();
                }}
              >
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
                    notes: it.notes,
                    mixSizes: (it as any).mixSizes,
                    mixPcs: (it as any).mixPcs,
                    colorMixPcs: (it as any).colorMixPcs,
                  })),
                }}
                allowInlineEdit={false}
              />
              </div>
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
