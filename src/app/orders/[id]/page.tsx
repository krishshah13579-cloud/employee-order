"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Printer,
  Save,
  Trash2,
  Plus,
  Edit3,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  CreditCard,
  Phone,
  Layers,
  ShoppingBag,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import { ORDER_STATUSES, STATUS_COLORS, type OrderStatus } from "@/lib/types";
import type { CustomerData, ProductData, ColorSetEntry } from "@/lib/types";

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
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Order Details
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>("");
  const [status, setStatus] = useState<OrderStatus>("Pending");
  const [placedBy, setPlacedBy] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState<string>("");

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

  // Customers list for customer switcher
  const [customers, setCustomers] = useState<CustomerData[]>([]);

  // Items
  const [items, setItems] = useState<EditableOrderItem[]>([]);

  // Add Product Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [allProducts, setAllProducts] = useState<ProductData[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<ProductData | null>(null);
  const [colorSetsToAdd, setColorSetsToAdd] = useState<Record<string, number>>({});

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
    // Load customers
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(() => {});

    // Load active products for quick adding
    fetch("/api/products?active_only=1")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllProducts(data);
      })
      .catch(() => {});
  }, [orderId]);

  // Recalculate item totals
  const recalculateItem = (item: EditableOrderItem): EditableOrderItem => {
    const totalSets = item.colorSets.reduce((sum, cs) => sum + (cs.sets || 0), 0);
    const pcsPerSet = item.pcsPerSet || 5;
    const totalPcs = totalSets * pcsPerSet;
    const itemSubtotal = totalPcs * (item.unitPrice || 0);

    return {
      ...item,
      totalSets,
      totalPcs,
      itemSubtotal,
    };
  };

  // Handle color set count update for an item
  const handleColorSetChange = (
    itemIndex: number,
    color: string,
    newSets: number
  ) => {
    const updatedItems = [...items];
    const targetItem = { ...updatedItems[itemIndex] };
    const validCount = Math.max(0, newSets);

    const existingIndex = targetItem.colorSets.findIndex(
      (cs) => cs.color.toLowerCase() === color.toLowerCase()
    );

    if (existingIndex >= 0) {
      if (validCount === 0) {
        targetItem.colorSets = targetItem.colorSets.filter((_, idx) => idx !== existingIndex);
      } else {
        targetItem.colorSets[existingIndex] = { color, sets: validCount };
      }
    } else if (validCount > 0) {
      targetItem.colorSets.push({ color, sets: validCount });
    }

    updatedItems[itemIndex] = recalculateItem(targetItem);
    setItems(updatedItems);
  };

  // Handle unit price change for an item
  const handlePriceChange = (itemIndex: number, newPrice: number) => {
    const updatedItems = [...items];
    const targetItem = { ...updatedItems[itemIndex], unitPrice: Math.max(0, newPrice) };
    updatedItems[itemIndex] = recalculateItem(targetItem);
    setItems(updatedItems);
  };

  // Handle Remove Item
  const handleRemoveItem = (itemIndex: number) => {
    if (confirm("Remove this product item from the order form?")) {
      const updated = items.filter((_, idx) => idx !== itemIndex);
      setItems(updated);
      toast("Item removed");
    }
  };

  // Switch Customer
  const handleCustomerChange = (newCustId: number) => {
    const cust = customers.find((c) => c.id === newCustId);
    if (cust) {
      setCustomerId(cust.id);
      setCustomerName(cust.shopName);
      setCustomerGstPan(cust.gstPanNo);
      setCustomerPhone(cust.phoneNumber);
      setCustomerAddress(cust.address);
      setCustomerContactPerson(cust.contactPerson || "");
      setCustomerCity(cust.city || "");
      setCustomerState(cust.state || "");
      setCustomerVisitingCardUrl(cust.visitingCardUrl || "");
      toast(`Customer updated to ${cust.shopName}`);
    }
  };

  // Open Add Product Modal
  const handleOpenAddProduct = () => {
    if (allProducts.length > 0) {
      setSelectedProductToAdd(allProducts[0]);
      const initial: Record<string, number> = {};
      const colors = (allProducts[0].colorsAvailable || "").split(",").map((c) => c.trim()).filter(Boolean);
      colors.forEach((c) => (initial[c] = 0));
      setColorSetsToAdd(initial);
    }
    setIsAddModalOpen(true);
  };

  // Switch product in modal
  const handleModalProductSelect = (p: ProductData) => {
    setSelectedProductToAdd(p);
    const initial: Record<string, number> = {};
    const colors = (p.colorsAvailable || "").split(",").map((c) => c.trim()).filter(Boolean);
    colors.forEach((c) => (initial[c] = 0));
    setColorSetsToAdd(initial);
  };

  // Add product from modal to order items
  const handleAddProductSubmit = () => {
    if (!selectedProductToAdd) return;

    const entries: ColorSetEntry[] = Object.entries(colorSetsToAdd)
      .filter(([_, sets]) => sets > 0)
      .map(([color, sets]) => ({ color, sets }));

    if (entries.length === 0) {
      toast("Please select at least 1 set of any color", "error");
      return;
    }

    const pcsPerSet = selectedProductToAdd.pcsPerSet || 5;
    const totalSets = entries.reduce((sum, cs) => sum + cs.sets, 0);
    const totalPcs = totalSets * pcsPerSet;
    const unitPrice = selectedProductToAdd.price || 0;
    const itemSubtotal = totalPcs * unitPrice;

    const newItem: EditableOrderItem = {
      productId: selectedProductToAdd.id,
      productName: selectedProductToAdd.name,
      category: selectedProductToAdd.category,
      colorSets: entries,
      sizeRatio: selectedProductToAdd.sizesRatio,
      sizesList: selectedProductToAdd.sizesList,
      pcsPerSet: pcsPerSet,
      totalSets: totalSets,
      totalPcs: totalPcs,
      unitPrice: unitPrice,
      itemSubtotal: itemSubtotal,
    };

    setItems([...items, newItem]);
    setIsAddModalOpen(false);
    toast(`Added ${selectedProductToAdd.name} (${totalSets} sets, ${totalPcs} pcs)`);
  };

  // Order Totals Calculations
  const totalSets = items.reduce((sum, it) => sum + (it.totalSets || 0), 0);
  const totalPcs = items.reduce((sum, it) => sum + (it.totalPcs || 0), 0);
  const subtotal = items.reduce((sum, it) => sum + (it.itemSubtotal || 0), 0);
  const gstRate = 0.0;
  const gstAmount = 0.0;
  const roundOff = Math.round(subtotal) - subtotal;
  const grandTotal = Math.round(subtotal);

  // Save Order Changes (`PUT /api/orders/[id]`)
  const handleSaveChanges = async () => {
    if (!customerName.trim() || !customerGstPan.trim()) {
      toast("Customer Shop Name and GST/PAN are mandatory", "error");
      return;
    }

    if (items.length === 0) {
      toast("Order must contain at least 1 product item", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        customerId,
        status,
        placedBy: placedBy.trim() || "Employee",
        notes: orderNotes.trim(),
        items: items.map((it) => ({
          productId: it.productId,
          colorSets: it.colorSets,
          sizeRatio: it.sizeRatio,
          sizesList: it.sizesList,
          pcsPerSet: it.pcsPerSet,
          totalSets: it.totalSets,
          unitPrice: it.unitPrice,
          notes: it.notes,
        })),
      };

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to update order (${res.status})`);
      }

      toast("Order form updated successfully!");
      fetchOrder();
    } catch (err: any) {
      console.error("Save order error:", err);
      toast(err.message || "Failed to update order", "error");
    } finally {
      setSaving(false);
    }
  };

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
              Review, edit product items/colors, adjust quantities, update status, and print order slips.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={16} />
              <span>Print Order Slip</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveChanges}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center gap-1.5"
            >
              <Save size={16} />
              <span>{saving ? "Saving Changes..." : "Save Order Changes"}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ═══════════════════════════════════════════
            PRINTABLE SLIP HEADER (visible only on print)
            ═══════════════════════════════════════════ */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                IQ TROUSERS
              </h1>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">
                Wholesale Garment Order Slip &amp; Tax Invoice
              </p>
              <p className="text-xs text-slate-500 mt-1">
                GSTIN: 24AAACI1357Q1Z2 • Ring Road Textile Tower, Surat, Gujarat
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-black text-slate-900">
                {orderNumber}
              </div>
              <div className="text-xs text-slate-500">
                Date: {formatDate(orderDate)}
              </div>
              <div className="text-xs text-slate-500">
                Status: <strong>{status}</strong>
              </div>
            </div>
          </div>
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

            {/* Switch customer dropdown */}
            <div className="flex items-center gap-2 print:hidden">
              <label className="text-xs font-semibold text-slate-500">
                Switch Customer:
              </label>
              <select
                value={customerId || ""}
                onChange={(e) => handleCustomerChange(parseInt(e.target.value, 10))}
                className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shopName} ({c.gstPanNo})
                  </option>
                ))}
              </select>
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
            {/* Order Status Selector */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block font-semibold text-[10px] uppercase mb-1">
                Order Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 print:hidden"
              >
                {ORDER_STATUSES.map((st: string) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <div className="hidden print:block font-bold text-sm text-slate-900">
                {status}
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
                Adjust sets for any color or edit prices directly in this order form.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddProduct}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center gap-1.5 print:hidden self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>+ Add More Product</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">GST NO. / PAN NO.</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Colors &amp; Sets</th>
                  <th className="py-3.5 px-4 text-center">PCS</th>
                  <th className="py-3.5 px-4 text-right">Price (₹/pc)</th>
                  <th className="py-3.5 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-3.5 px-4 text-center print:hidden">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No items currently in this order. Click &quot;+ Add More Product&quot; to add.
                    </td>
                  </tr>
                ) : (
                  items.map((item, itemIdx) => (
                    <tr key={itemIdx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer Name */}
                      <td className="py-4 px-4 font-bold text-slate-900 max-w-[140px] truncate">
                        {customerName}
                      </td>

                      {/* GST / PAN No. */}
                      <td className="py-4 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {customerGstPan || "—"}
                      </td>

                      {/* Product Name */}
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900 text-sm">
                          {item.productName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Ratio: {item.sizeRatio} ({item.pcsPerSet || 5} pcs/set)
                        </div>
                      </td>

                      {/* Colors & Sets Editable */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          {item.colorSets && item.colorSets.length > 0 ? (
                            item.colorSets.map((cs) => (
                              <div
                                key={cs.color}
                                className="inline-flex items-center gap-2 mr-2 mb-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: getColorHex(cs.color).hex }}
                                />
                                <span className="font-bold text-slate-800">{cs.color}:</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={cs.sets}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    handleColorSetChange(itemIdx, cs.color, isNaN(val) ? 0 : val);
                                  }}
                                  className="w-12 px-1.5 py-0.5 text-center font-bold text-orange-600 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 print:border-none print:w-auto"
                                />
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

                      {/* Price (Editable) */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-slate-500">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              handlePriceChange(itemIdx, isNaN(val) ? 0 : val);
                            }}
                            className="w-16 px-1.5 py-0.5 text-right font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:bg-white print:border-none print:w-auto print:bg-transparent"
                          />
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        {formatCurrency(item.itemSubtotal)}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-center print:hidden">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(itemIdx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove product item"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Placed By (Employee Name)
              </label>
              <input
                type="text"
                value={placedBy}
                onChange={(e) => setPlacedBy(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Order Notes
              </label>
              <textarea
                rows={3}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              />
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
                <span>Order Subtotal:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {Math.abs(roundOff) > 0.001 && (
                <div className="flex justify-between text-slate-600">
                  <span>Round Off:</span>
                  <span className="font-bold text-slate-700">
                    {roundOff > 0 ? `+${formatCurrency(roundOff)}` : `-${formatCurrency(Math.abs(roundOff))}`}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-3 border-t-2 border-slate-900 text-sm">
                <span className="font-black text-slate-900 text-base">Grand Total (Rounded):</span>
                <span className="font-black text-2xl text-orange-600">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              disabled={saving || items.length === 0}
              onClick={handleSaveChanges}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-40 text-white font-black text-sm rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 print:hidden"
            >
              <Save size={18} />
              <span>{saving ? "Saving Changes..." : "Save Order Changes"}</span>
            </button>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════
          ADD PRODUCT MODAL (Quick Add to Existing Order)
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Product to Order"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddProductSubmit}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              Add to Order Form
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Select Product */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select Product Style
            </label>
            <select
              value={selectedProductToAdd?.id || ""}
              onChange={(e) => {
                const prod = allProducts.find((p) => p.id === parseInt(e.target.value, 10));
                if (prod) handleModalProductSelect(prod);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
            >
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.category} ({formatCurrency(p.price)}/pc)
                </option>
              ))}
            </select>
          </div>

          {selectedProductToAdd && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-700">
                Pick Sets for Available Colors (5 pcs / set):
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(selectedProductToAdd.colorsAvailable || "")
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .map((color) => {
                    const currentSets = colorSetsToAdd[color] || 0;
                    return (
                      <div
                        key={color}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 inline-block"
                            style={{ backgroundColor: getColorHex(color).hex }}
                          />
                          <span className="font-bold text-slate-900">{color}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={currentSets === 0 ? "" : currentSets}
                            placeholder="0"
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                              setColorSetsToAdd((prev) => ({
                                ...prev,
                                [color]: isNaN(val) ? 0 : Math.max(0, val),
                              }));
                            }}
                            className="w-16 px-2 py-1 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                          <span className="text-[11px] text-slate-500">Sets</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
