"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  FileText,
  Building2,
  Calendar,
  CheckCircle,
  Percent,
  Loader2,
  MessageCircle,
  Bell,
  Clock,
  Edit,
  Edit3,
  Download,
  Check,
  X,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  Save,
  Package,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { openWhatsAppDirectly, shareOrOpenWhatsAppWithPdf, sendAutomatedWhatsAppDirect } from "@/lib/whatsapp-client";
import { getColorHex } from "@/lib/colors";
import { ORDER_STATUSES, type OrderData, type ColorSetEntry } from "@/lib/types";
import { calculateOrderedColorSetsPieces } from "@/lib/stock";
import TaxInvoiceA4 from "@/components/orders/TaxInvoiceA4";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function OrderInvoicePage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Active Format Switcher: "ORDER_FORM" vs "TAX_INVOICE"
  const [formatType, setFormatType] = useState<"ORDER_FORM" | "TAX_INVOICE">("TAX_INVOICE");

  // Tax Invoice Editing Modal State
  const [isTaxInvoiceModalOpen, setIsTaxInvoiceModalOpen] = useState(false);
  const [savingTaxInvoice, setSavingTaxInvoice] = useState(false);
  const [taxInvoiceNoInput, setTaxInvoiceNoInput] = useState("");
  const [taxInvoiceDateInput, setTaxInvoiceDateInput] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [markAsReady, setMarkAsReady] = useState(true);
  const [editableItems, setEditableItems] = useState<any[]>([]);

  // Order Form Editing Modal State (Edit customer, items, colors, sets, rates, notes, status)
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [savingOrderForm, setSavingOrderForm] = useState(false);
  const [editStatus, setEditStatus] = useState<string>("Pending");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editPlacedBy, setEditPlacedBy] = useState<string>("");
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>("");
  const [editCustomerAddress, setEditCustomerAddress] = useState<string>("");
  const [editCustomerGstPan, setEditCustomerGstPan] = useState<string>("");
  const [editOrderItems, setEditOrderItems] = useState<any[]>([]);
  const [sendWhatsAppOnSave, setSendWhatsAppOnSave] = useState<boolean>(true);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>("");

  // Load Order
  async function loadOrder() {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) {
        throw new Error(`Failed to load order invoice (Status ${res.status})`);
      }
      const data: OrderData = await res.json();
      setOrder(data);

      // Default format type: if status is Ready/Dispatched/Delivered or taxInvoiceNumber exists, default to TAX_INVOICE, else ORDER_FORM
      if (
        data.taxInvoiceNumber ||
        data.status === "Ready" ||
        data.status === "Dispatched" ||
        data.status === "Delivered"
      ) {
        setFormatType("TAX_INVOICE");
      } else {
        setFormatType("ORDER_FORM");
      }

      // Initialize Tax Invoice Form Fields
      const defaultTaxNo =
        data.taxInvoiceNumber ||
        `TI-${new Date().getFullYear().toString().slice(-2)}-${String(data.id).padStart(3, "0")}`;
      setTaxInvoiceNoInput(defaultTaxNo);

      if (data.taxInvoiceDate) {
        setTaxInvoiceDateInput(new Date(data.taxInvoiceDate).toISOString().split("T")[0]);
      }

      // Parse items for editing
      let initialItems: any[] = [];
      if (data.taxInvoiceItems) {
        try {
          initialItems = JSON.parse(data.taxInvoiceItems);
        } catch {
          initialItems = [];
        }
      }

      if (!initialItems || initialItems.length === 0) {
        initialItems = (data.items || []).map((it) => {
          let parsedColorSets = [];
          try {
            parsedColorSets = typeof it.colorSets === "string" ? JSON.parse(it.colorSets) : it.colorSets;
          } catch {
            parsedColorSets = [];
          }
          return {
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            sizeRatio: it.sizeRatio || "30 to 38",
            pcsPerSet: it.pcsPerSet || 5,
            totalSets: it.totalSets || 0,
            totalPcs: it.totalPcs || 0,
            unitPrice: it.unitPrice || 0,
            itemSubtotal: it.itemSubtotal || 0,
            colorSets: parsedColorSets || [],
          };
        });
      }
      setEditableItems(initialItems);

      // Populate Order Form Edit States
      setEditStatus(data.status);
      setEditNotes(data.notes || "");
      setEditPlacedBy(data.placedBy || "Admin");
      setEditCustomerPhone(data.customer?.phoneNumber || data.customerPhone || "");
      setEditCustomerAddress(data.customer?.address || data.customerAddress || "");
      setEditCustomerGstPan(data.customer?.gstPanNo || data.customerGstPan || "");

      const orderItemsForEdit = (data.items || []).map((it) => {
        let parsedColorSets = [];
        try {
          parsedColorSets = typeof it.colorSets === "string" ? JSON.parse(it.colorSets) : it.colorSets;
        } catch {
          parsedColorSets = [];
        }
        return {
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          sizeRatio: it.sizeRatio || "30 to 38",
          pcsPerSet: it.pcsPerSet || 5,
          totalSets: it.totalSets || 0,
          totalPcs: it.totalPcs || 0,
          unitPrice: it.unitPrice || 0,
          itemSubtotal: it.itemSubtotal || 0,
          colorSets: parsedColorSets || [],
          product: (it as any).product || null,
        };
      });
      setEditOrderItems(orderItemsForEdit);
    } catch (err: any) {
      setError(err.message || "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  useEffect(() => {
    // Check if ?edit=true was passed in the URL to open Order Form Editor immediately
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("edit") === "true") {
        setIsEditOrderModalOpen(true);
      }
    }
    // Fetch active products list for adding products to order
    fetch("/api/products?active_only=1")
      .then((res) => res.json())
      .then((prods) => {
        if (Array.isArray(prods)) setAvailableProducts(prods);
      })
      .catch(() => {});
  }, []);

  // ═══════════════════════════════════════════
  // ORDER FORM EDIT HANDLERS
  // ═══════════════════════════════════════════
  const handleEditColorSet = (itemIndex: number, colorIndex: number, newSets: number) => {
    const updated = [...editOrderItems];
    const item = { ...updated[itemIndex] };
    const colors = [...(item.colorSets || [])];
    colors[colorIndex] = { ...colors[colorIndex], sets: Math.max(0, newSets) };

    const totalSets = colors.reduce((sum, c) => sum + (Number(c.sets) || 0), 0);
    const pcsPerSet = item.pcsPerSet || 5;

    let totalPcs = 0;
    for (const c of colors) {
      const calc = calculateOrderedColorSetsPieces(
        item.product?.setsColorwise || null,
        c.color,
        c.sets,
        pcsPerSet
      );
      totalPcs += calc.totalPcs;
    }
    if (totalPcs === 0) {
      totalPcs = totalSets * pcsPerSet;
    }

    const unitPrice = item.unitPrice || 0;
    item.colorSets = colors;
    item.totalSets = totalSets;
    item.totalPcs = totalPcs;
    item.itemSubtotal = Math.round(totalPcs * unitPrice);

    updated[itemIndex] = item;
    setEditOrderItems(updated);
  };

  const handleEditUnitPrice = (itemIndex: number, newPrice: number) => {
    const updated = [...editOrderItems];
    const item = { ...updated[itemIndex] };
    item.unitPrice = Math.max(0, newPrice);
    item.itemSubtotal = Math.round((item.totalPcs || 0) * item.unitPrice);
    updated[itemIndex] = item;
    setEditOrderItems(updated);
  };

  const handleRemoveOrderItem = (itemIndex: number) => {
    if (editOrderItems.length <= 1) {
      toast("An order must have at least one product item", "error");
      return;
    }
    const updated = editOrderItems.filter((_, idx) => idx !== itemIndex);
    setEditOrderItems(updated);
  };

  const handleAddProductToOrder = (prodIdStr: string) => {
    if (!prodIdStr) return;
    const prod = availableProducts.find((p) => String(p.id) === prodIdStr);
    if (!prod) return;

    let colors: string[] = [];
    if (prod.colorsAvailable) {
      try {
        const parsed = typeof prod.colorsAvailable === "string" ? JSON.parse(prod.colorsAvailable) : prod.colorsAvailable;
        if (Array.isArray(parsed)) colors = parsed;
      } catch {
        colors = String(prod.colorsAvailable).split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
    if (colors.length === 0) colors = ["Standard"];

    const colorSets = colors.map((col: string, idx: number) => ({
      color: col,
      sets: idx === 0 ? 1 : 0,
    }));

    const pcsPerSet = prod.pcsPerSet || 5;
    const calc = calculateOrderedColorSetsPieces(prod.setsColorwise, colors[0], 1, pcsPerSet);
    const totalPcs = calc.totalPcs || pcsPerSet;
    const unitPrice = prod.retailerPrice || prod.price || 0;

    const newItem = {
      productId: prod.id,
      productName: prod.name,
      sizeRatio: prod.sizesRatio || "30 to 38",
      pcsPerSet,
      totalSets: 1,
      totalPcs,
      unitPrice,
      itemSubtotal: totalPcs * unitPrice,
      colorSets,
      product: prod,
    };

    setEditOrderItems((prev) => [...prev, newItem]);
    setSelectedProductToAdd("");
    toast(`Added "${prod.name}" to order`, "success");
  };

  const handleSaveOrderForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const mSets = editOrderItems.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
    if (mSets === 0) {
      toast("Please allocate at least 1 set across the products", "error");
      return;
    }

    try {
      setSavingOrderForm(true);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes,
          placedBy: editPlacedBy,
          customerPhone: editCustomerPhone,
          customerAddress: editCustomerAddress,
          customerGstPan: editCustomerGstPan,
          items: editOrderItems,
          notifyCustomer: sendWhatsAppOnSave,
          sendWhatsApp: sendWhatsAppOnSave,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update order");

      toast("✅ Order Form updated successfully!", "success");
      setIsEditOrderModalOpen(false);
      loadOrder();

      if (sendWhatsAppOnSave && data.whatsapp?.customerPhone && data.whatsapp?.message) {
        toast("Sending updated order details to customer WhatsApp...", "info");
        sendAutomatedWhatsAppDirect({
          phone: data.whatsapp.customerPhone,
          message: data.whatsapp.message,
          pdfUrl: data.whatsapp.pdfUrl,
          filename: data.whatsapp.filename,
          nativeUrl: data.whatsapp.nativeUrl,
          whatsappUrl: data.whatsapp.directUrl,
          onToast: toast,
        }).catch((err) => console.error("Auto WhatsApp edit error:", err));
      }
    } catch (err: any) {
      toast(err.message || "Failed to update order", "error");
    } finally {
      setSavingOrderForm(false);
    }
  };

  // Recalculate an item row in tax invoice modal
  const handleUpdateItemQty = (
    index: number,
    field: "totalSets" | "pcsPerSet" | "unitPrice",
    val: number
  ) => {
    const updated = [...editableItems];
    const item = { ...updated[index], [field]: val };
    const sets = field === "totalSets" ? val : item.totalSets || 0;
    const pcsPerSet = field === "pcsPerSet" ? val : item.pcsPerSet || 5;
    const unitPrice = field === "unitPrice" ? val : item.unitPrice || 0;

    item.totalPcs = sets * pcsPerSet;
    item.itemSubtotal = Math.round(item.totalPcs * unitPrice);
    updated[index] = item;
    setEditableItems(updated);
  };

  // Recalculate color-specific sets in tax invoice modal
  const handleUpdateColorSet = (itemIndex: number, colorIndex: number, newSets: number) => {
    const updated = [...editableItems];
    const item = { ...updated[itemIndex] };
    const colors = [...(item.colorSets || [])];
    colors[colorIndex] = { ...colors[colorIndex], sets: Math.max(0, newSets) };

    const totalSets = colors.reduce((sum, c) => sum + (Number(c.sets) || 0), 0);
    const pcsPerSet = item.pcsPerSet || 5;

    let totalPcs = 0;
    for (const c of colors) {
      const calc = calculateOrderedColorSetsPieces(
        null,
        c.color,
        c.sets,
        pcsPerSet
      );
      totalPcs += calc.totalPcs;
    }
    if (totalPcs === 0) {
      totalPcs = totalSets * pcsPerSet;
    }

    const unitPrice = item.unitPrice || 0;
    item.colorSets = colors;
    item.totalSets = totalSets;
    item.totalPcs = totalPcs;
    item.itemSubtotal = Math.round(totalPcs * unitPrice);

    updated[itemIndex] = item;
    setEditableItems(updated);
  };

  // Save Tax Invoice Details
  const handleSaveTaxInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!taxInvoiceNoInput.trim()) {
      toast("Please enter a valid Tax Invoice number", "error");
      return;
    }

    try {
      setSavingTaxInvoice(true);
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxInvoiceNumber: taxInvoiceNoInput.trim(),
          taxInvoiceDate: taxInvoiceDateInput,
          taxInvoiceItems: JSON.stringify(editableItems),
          status: markAsReady ? "Ready" : order.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update tax invoice");

      toast("✅ Tax Invoice generated with updated quantities & amount!", "success");
      setIsTaxInvoiceModalOpen(false);
      setFormatType("TAX_INVOICE");
      loadOrder();

      // Automated WhatsApp dispatch on marking as Ready
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
    } catch (err: any) {
      toast(err.message || "Failed to save tax invoice", "error");
    } finally {
      setSavingTaxInvoice(false);
    }
  };

  // Direct Status Update Handler
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const handleDirectStatusChange = async (newStatus: string) => {
    if (!order || newStatus === order.status) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast(`✅ Order status updated to "${newStatus}"!`, "success");
      loadOrder();

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
    } catch (err: any) {
      toast(err.message || "Failed to update status", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // WhatsApp Sender Handler
  const handleSendWhatsApp = async (type: "ORDER_CONFIRMATION" | "TAX_INVOICE" | "PAYMENT_REMINDER") => {
    try {
      setSendingWhatsApp(true);
      const isTax = type === "TAX_INVOICE" || (type === "ORDER_CONFIRMATION" && formatType === "TAX_INVOICE");
      const res = await fetch(`/api/orders/${id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type === "PAYMENT_REMINDER" ? "PAYMENT_REMINDER" : isTax ? "TAX_INVOICE" : "ORDER_CONFIRMATION",
          formatType: isTax ? "tax_invoice" : "order_form",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process WhatsApp");

      if (data.automated) {
        toast(
          type === "PAYMENT_REMINDER"
            ? "✅ Payment reminder sent to customer's WhatsApp!"
            : isTax
            ? "✅ Tax Invoice PDF sent directly to customer WhatsApp with updated quantities!"
            : "✅ Order Form PDF sent directly to customer WhatsApp!",
          "success"
        );
      } else if (data.whatsappUrl || data.nativeUrl) {
        await shareOrOpenWhatsAppWithPdf({
          whatsappUrl: data.whatsappUrl,
          nativeUrl: data.nativeUrl,
          pdfUrl: data.pdfUrl || `/api/orders/${id}/pdf?type=${isTax ? "tax_invoice" : "order_form"}`,
          filename: `${isTax ? "Tax_Invoice" : "Order_Form"}_${order?.orderNumber || id}.pdf`,
          text: data.message,
          onToast: toast,
        });
      }
    } catch (err: any) {
      toast(err.message || "Failed to send WhatsApp", "error");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error || "Order not found."}
      </div>
    );
  }

  // Active Format Data Calculation
  const isTaxInvoiceActive = formatType === "TAX_INVOICE";
  let activeDisplayItems = order.items || [];
  let activeTotalSets = order.totalSets;
  let activeTotalPcs = order.totalPcs;
  let activeSubtotal = order.subtotal;
  let activeGst = order.gstAmount;
  let activeGrandTotal = order.grandTotal;
  let activeDocNumber = order.orderNumber;
  let activeDate = order.orderDate;

  if (isTaxInvoiceActive && order.taxInvoiceItems) {
    try {
      const parsed = JSON.parse(order.taxInvoiceItems);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeDisplayItems = parsed;
        activeTotalSets = parsed.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
        activeTotalPcs = parsed.reduce((s, it) => s + (Number(it.totalPcs) || 0), 0);
        activeSubtotal = parsed.reduce((s, it) => s + (Number(it.itemSubtotal) || 0), 0);
        activeGst = Math.round(activeSubtotal * 0.05 * 100) / 100;
        activeGrandTotal = Math.round(activeSubtotal + activeGst);
      }
    } catch {}
  }

  if (isTaxInvoiceActive) {
    activeDocNumber = order.taxInvoiceNumber || order.orderNumber;
    activeDate = order.taxInvoiceDate || order.orderDate;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Bar with Back, Format Switcher, WhatsApp, and Print */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200 print:hidden">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Orders</span>
        </Link>

        {/* 2 FORMATS SWITCHER TABS */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFormatType("ORDER_FORM")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              formatType === "ORDER_FORM"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            1. Order Form (Booked)
          </button>
          <button
            type="button"
            onClick={() => setFormatType("TAX_INVOICE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              formatType === "TAX_INVOICE"
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>2. Tax Invoice (Ready)</span>
            {order.taxInvoiceNumber && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Order Form Button */}
          <button
            type="button"
            onClick={() => setIsEditOrderModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Edit customer order items, sets, prices, notes, or status"
          >
            <Edit3 size={14} className="text-white" />
            <span>Edit Order Form</span>
          </button>

          {/* Generate / Edit Tax Invoice Button */}
          <button
            type="button"
            onClick={() => setIsTaxInvoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Admin sets Tax Invoice number and adjusts item quantities/amounts"
          >
            <Edit size={14} className="text-orange-400" />
            <span>{order.taxInvoiceNumber ? "Edit Tax Invoice" : "Generate Tax Invoice"}</span>
          </button>

          {/* Send on WhatsApp Button */}
          <button
            type="button"
            disabled={sendingWhatsApp}
            onClick={() => handleSendWhatsApp(isTaxInvoiceActive ? "TAX_INVOICE" : "ORDER_CONFIRMATION")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title={`Send ${isTaxInvoiceActive ? "Tax Invoice PDF" : "Order Form PDF"} directly to customer on WhatsApp`}
          >
            <MessageCircle size={14} />
            <span>
              {sendingWhatsApp
                ? "Sending..."
                : isTaxInvoiceActive
                ? "Send Tax Invoice"
                : "Send Order Form"}
            </span>
          </button>

          {/* Download PDF File directly */}
          <a
            href={`/api/orders/${order.id}/pdf?type=${isTaxInvoiceActive ? "tax_invoice" : "order_form"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-xs transition-colors"
            title="Download PDF document directly"
          >
            <Download size={14} />
            <span>PDF</span>
          </a>

          {/* Print A4 Invoice */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer size={14} />
            <span>Print A4</span>
          </button>
        </div>
      </div>

      {/* Format Notice Banner */}
      <div
        className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between print:hidden ${
          isTaxInvoiceActive
            ? "bg-orange-50/70 border-orange-200 text-orange-950"
            : "bg-blue-50/70 border-blue-200 text-blue-950"
        }`}
      >
        <div className="flex items-center gap-2">
          <FileText size={16} className={isTaxInvoiceActive ? "text-orange-600" : "text-blue-600"} />
          <span>
            Currently viewing:{" "}
            <strong>{isTaxInvoiceActive ? "TAX INVOICE (Format 2)" : "ORDER FORM (Format 1)"}</strong>
            {isTaxInvoiceActive && order.taxInvoiceNumber && (
              <span className="ml-2 font-mono font-bold text-orange-700">
                (Inv No: #{order.taxInvoiceNumber})
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">
          {isTaxInvoiceActive
            ? "Reflects final dispatched quantities set by Admin"
            : "Reflects original quantities booked by employee"}
        </div>
      </div>

      {/* Interactive Container (Hidden on Print) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs space-y-6 print:hidden">
        {/* Invoice Header */}
        <div className="flex justify-between items-start border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-950 p-1 flex items-center justify-center">
                <img
                  src="/images/iq-logo.jpg"
                  alt="IQ TROUSERS"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-black text-xl tracking-tight text-gray-900">
                KRISH CLOTHING CO.
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed max-w-sm">
              Q-8, Samet Business Park, Nr Parishkar-2,<br />
              Khokhra Circle, Maninagar, Ahmedabad - 380008, Gujarat<br />
              <strong>Phone:</strong> 8128756632 • <strong>Email:</strong> krishclothingco3@gmail.com
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-gray-800">
              GSTIN: 24LAAPS9916E1ZD • PAN: LAAPS9916E
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-xs font-extrabold uppercase tracking-widest block mb-1 ${
                isTaxInvoiceActive ? "text-orange-600" : "text-blue-600"
              }`}
            >
              {isTaxInvoiceActive ? "TAX INVOICE" : "ORDER FORM"}
            </span>
            <div className="text-2xl font-black font-mono text-gray-900">
              #{activeDocNumber}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Date: <span className="font-semibold text-gray-900">{formatDate(activeDate)}</span>
            </div>
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status:</span>
              <select
                value={order.status}
                disabled={updatingStatus}
                onChange={(e) => handleDirectStatusChange(e.target.value)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:border-slate-400 text-slate-800 shadow-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none cursor-pointer"
                title="Change status and automatically dispatch WhatsApp message to customer"
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              {updatingStatus && <Loader2 size={13} className="animate-spin text-orange-600" />}
            </div>
          </div>
        </div>

        {/* Billed To / Client Retailer Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-zinc-50/80 p-4 rounded-xl border border-gray-200 text-xs">
          <div>
            <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1 text-[11px]">
              Billed To (Customer Shop):
            </span>
            <div className="font-bold text-gray-900 text-sm uppercase">
              {order.customer?.shopName || order.customerName || "Walk-in Retailer"}
            </div>
            <div className="text-gray-600 mt-1 leading-relaxed uppercase">
              {order.customer?.address || "Address on record"}
            </div>
            <div className="text-gray-700 mt-1">
              <strong>Phone:</strong> {order.customer?.phoneNumber || "—"}
            </div>
          </div>

          <div className="sm:text-right">
            <span className="font-bold text-gray-500 uppercase tracking-wider block mb-1 text-[11px]">
              Tax &amp; Wholesale Terms:
            </span>
            <div className="font-mono font-bold text-gray-900 text-sm">
              GST/PAN: {(order.customer?.gstPanNo || order.customerGstPan || "UNREGISTERED").toUpperCase()}
            </div>
            <div className="text-gray-600 mt-1">
              Placed By: <span className="font-semibold text-gray-800">{order.placedBy || "Admin"}</span>
            </div>
            <div className="text-gray-600 mt-1">
              Credit Terms: <span className="font-semibold text-gray-800">{order.creditDays || 45} Days</span>
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100/80 text-[11px] font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200">
                <th className="p-3 border-r border-gray-200 w-12 text-center">#</th>
                <th className="p-3 border-r border-gray-200">Garment Product &amp; Colors</th>
                <th className="p-3 border-r border-gray-200">Size Ratio</th>
                <th className="p-3 border-r border-gray-200 text-center">Sets</th>
                <th className="p-3 border-r border-gray-200 text-center">PCS</th>
                <th className="p-3 border-r border-gray-200 text-right">Rate / Pc</th>
                <th className="p-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeDisplayItems.map((it: any, idx: number) => {
                let colorSetsParsed: ColorSetEntry[] = [];
                try {
                  colorSetsParsed = typeof it.colorSets === "string" ? JSON.parse(it.colorSets) : it.colorSets;
                } catch {}

                return (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="p-3 border-r border-gray-200 text-center font-mono">{idx + 1}</td>
                    <td className="p-3 border-r border-gray-200">
                      <div className="font-bold text-gray-900 text-sm">{it.productName}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {colorSetsParsed
                          ?.filter((cs) => cs.sets > 0)
                          .map((cs, cIdx) => {
                            const colorInfo = getColorHex(cs.color);
                            return (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-medium text-gray-800 border border-gray-200"
                              >
                                <span
                                  className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                                  style={{ backgroundColor: colorInfo.hex }}
                                />
                                <span>
                                  {cs.color}: <strong>{cs.sets} sets</strong>
                                </span>
                              </span>
                            );
                          })}
                      </div>
                    </td>
                    <td className="p-3 border-r border-gray-200">
                      <span className="font-semibold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {it.sizeRatio || "30 to 38"}
                      </span>
                      <div className="text-[10px] text-gray-500 mt-1">({it.pcsPerSet || 5} pcs/set)</div>
                    </td>
                    <td className="p-3 border-r border-gray-200 text-center font-bold font-mono">
                      {it.totalSets}
                    </td>
                    <td className="p-3 border-r border-gray-200 text-center font-bold font-mono text-blue-700">
                      {it.totalPcs}
                    </td>
                    <td className="p-3 border-r border-gray-200 text-right font-mono">
                      {formatCurrency(it.unitPrice)}
                    </td>
                    <td className="p-3 text-right font-bold font-mono">
                      {formatCurrency(it.itemSubtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Calculation Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
          {/* Bank Details */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-1 w-full sm:w-80">
            <span className="font-bold text-gray-800 uppercase tracking-wider block mb-1 text-[11px]">
              Bank Account for RTGS / NEFT:
            </span>
            <div><strong>Bank:</strong> ICICI BANK</div>
            <div><strong>Account Number:</strong> 750705000692</div>
            <div><strong>IFSC Code:</strong> ICIC0007507</div>
            <div><strong>Branch:</strong> KHOKHRA BRANCH, AHMEDABAD</div>
          </div>

          {/* Amount Calculation */}
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Total Sets / PCS:</span>
              <span className="font-mono font-semibold">{activeTotalSets} Sets ({activeTotalPcs} Pcs)</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">{formatCurrency(activeSubtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Percent size={12} /> CGST (2.5%):
              </span>
              <span className="font-mono font-semibold">
                +{formatCurrency(Math.round(activeGst / 2))}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span className="flex items-center gap-1">
                <Percent size={12} /> SGST (2.5%):
              </span>
              <span className="font-mono font-semibold">
                +{formatCurrency(Math.round(activeGst / 2))}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
              <span>Total Payable:</span>
              <span className="font-mono text-emerald-700">{formatCurrency(activeGrandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          EXACT A4 TAX INVOICE PRINT VIEW
          ═══════════════════════════════════════════ */}
      <div className="hidden print:block py-2">
        <TaxInvoiceA4
          formatType={formatType}
          order={{
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            taxInvoiceNumber: isTaxInvoiceActive ? order.taxInvoiceNumber : null,
            taxInvoiceDate: isTaxInvoiceActive ? order.taxInvoiceDate : null,
            status: order.status,
            customerName: order.customer?.shopName || order.customerName,
            customerGstPan: order.customer?.gstPanNo || order.customerGstPan,
            customerPhone: order.customer?.phoneNumber || order.customerPhone,
            customerAddress: order.customer?.address || order.customerAddress,
            customerCity: order.customer?.city,
            customerState: order.customer?.state,
            businessType: order.businessType || order.customer?.businessType,
            creditDays: order.creditDays !== undefined ? order.creditDays : order.customer?.creditDays || 45,
            subtotal: activeSubtotal,
            gstRate: order.gstRate,
            gstAmount: activeGst,
            grandTotal: activeGrandTotal,
            totalPcs: activeTotalPcs,
            totalSets: activeTotalSets,
            placedBy: order.placedBy,
            notes: order.notes,
            items: activeDisplayItems.map((it: any) => ({
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

      {/* ═══════════════════════════════════════════
          GENERATE / EDIT TAX INVOICE MODAL
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isTaxInvoiceModalOpen}
        onClose={() => setIsTaxInvoiceModalOpen(false)}
        title="Generate / Edit Tax Invoice"
        size="xl"
      >
        <form onSubmit={handleSaveTaxInvoice} className="space-y-5">
          <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl text-xs text-orange-950">
            Set the official <strong>Tax Invoice Number</strong> and adjust the final delivered sets/pcs for each product. The Tax Invoice will automatically recalculate total pieces, GST (5%), and grand total.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tax Invoice Number*
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TI-2026-001"
                value={taxInvoiceNoInput}
                onChange={(e) => setTaxInvoiceNoInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-orange-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tax Invoice Date*
              </label>
              <input
                type="date"
                required
                value={taxInvoiceDateInput}
                onChange={(e) => setTaxInvoiceDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={markAsReady}
                  onChange={(e) => setMarkAsReady(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                />
                <span>Update status to &quot;Ready for Dispatch&quot;</span>
              </label>
            </div>
          </div>

          {/* Editable Products & Quantities */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Adjust Dispatched Quantities &amp; Sets
            </label>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {editableItems.map((item, itIdx) => (
                <div
                  key={itIdx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span className="text-sm font-black">{item.productName}</span>
                    <span className="font-mono text-orange-600">
                      {item.totalSets} Sets ({item.totalPcs} Pcs) = {formatCurrency(item.itemSubtotal)}
                    </span>
                  </div>

                  {/* Color-wise sets edit */}
                  {item.colorSets && item.colorSets.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/80">
                      {item.colorSets.map((cs: any, cIdx: number) => (
                        <div key={cIdx} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded-lg">
                          <span className="truncate text-[11px] font-medium text-slate-700">
                            {cs.color}:
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={cs.sets}
                            onChange={(e) =>
                              handleUpdateColorSet(itIdx, cIdx, parseInt(e.target.value, 10) || 0)
                            }
                            className="w-14 px-1 py-0.5 border border-slate-300 rounded text-center text-xs font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold">Total Sets</label>
                        <input
                          type="number"
                          min="0"
                          value={item.totalSets}
                          onChange={(e) =>
                            handleUpdateItemQty(itIdx, "totalSets", parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold">Rate/Pc (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleUpdateItemQty(itIdx, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold">Total Pcs</label>
                        <span className="block py-1 text-xs font-mono font-bold text-slate-700">
                          {item.totalPcs} PCS
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Modal Summary Totals */}
          {(() => {
            const mSets = editableItems.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
            const mPcs = editableItems.reduce((s, it) => s + (Number(it.totalPcs) || 0), 0);
            const mSub = editableItems.reduce((s, it) => s + (Number(it.itemSubtotal) || 0), 0);
            const mGst = Math.round(mSub * 0.05 * 100) / 100;
            const mTotal = Math.round(mSub + mGst);

            return (
              <div className="flex items-center justify-between p-3.5 bg-orange-50 border border-orange-200 rounded-xl text-xs font-bold">
                <div className="space-x-2 text-slate-700">
                  <span>Total Sets: <strong>{mSets}</strong></span>
                  <span>•</span>
                  <span>Total Pcs: <strong>{mPcs}</strong></span>
                  <span>•</span>
                  <span>GST: <strong>{formatCurrency(mGst)}</strong></span>
                </div>
                <div className="text-right">
                  <span className="text-slate-600 mr-2">New Grand Total:</span>
                  <span className="text-base font-black font-mono text-orange-600">
                    {formatCurrency(mTotal)}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTaxInvoiceModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTaxInvoice}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={14} />
              <span>{savingTaxInvoice ? "Saving..." : "Save Tax Invoice"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
