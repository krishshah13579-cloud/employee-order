"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  Building2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Save,
  Loader2,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hash,
  Lock,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import { getAllProductColors } from "@/lib/stock";
import type { CustomerData, ProductData } from "@/lib/types";

interface BillItem {
  productId: number;
  productName: string;
  sizesRatio: string;
  sizesList: string;
  pcsPerSet: number;
  sets: number;
  totalPcs: number;
  unitPrice: number;
  selectedShades: string[];
  availableColors: string[];
  notes?: string;
}

interface BillFormViewProps {
  employee?: { id: number; name: string; designation?: string } | null;
  isAdmin?: boolean;
}

export default function BillFormView({ employee, isAdmin }: BillFormViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [billNumber, setBillNumber] = useState("");
  const [handwrittenOrderNumber, setHandwrittenOrderNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderNotes, setOrderNotes] = useState("");
  const [items, setItems] = useState<BillItem[]>([]);
  const [customShadeInputs, setCustomShadeInputs] = useState<Record<number, string>>({});

  // Helper to determine customer price (Wholesale vs Retailer)
  const getProductPriceForCustomer = (prod: ProductData, cust?: CustomerData | null): number => {
    if (!cust) return prod.price || 0;
    const isWholesaler = (cust.businessType || "").toUpperCase().includes("WHOLESAL");
    const splDisc = Number(cust.specialDiscount) || 0;
    const isSpecialDiscount = splDisc > 0 || cust.businessType === "RETAILER WITH SPECIAL DISCOUNT";

    const baseRetail = prod.retailerPrice || prod.price;
    const baseWhole = prod.wholesalerPrice || Math.max(0, baseRetail - 100);

    if (isWholesaler) {
      return isSpecialDiscount ? Math.max(0, baseWhole - splDisc) : baseWhole;
    }
    return isSpecialDiscount ? Math.max(0, baseRetail - splDisc) : baseRetail;
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [cRes, pRes, numRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/products?active_only=1"),
          fetch("/api/order-numbers"),
        ]);

        let loadedProducts: ProductData[] = [];
        if (cRes.ok) setCustomers(await cRes.json());
        if (pRes.ok) {
          loadedProducts = await pRes.json();
          setProducts(loadedProducts);
        }

        if (numRes.ok) {
          const numData = await numRes.json();
          if (numData?.nextBillNumber) {
            const numMatch = String(numData.nextBillNumber).match(/\d+/);
            setBillNumber(numMatch ? numMatch[0] : String(numData.nextBillNumber));
          } else {
            setBillNumber("1");
          }
        }

        // Initialize with first product if available
        if (loadedProducts.length > 0) {
          const first = loadedProducts[0];
          const colors = getAllProductColors(
            first.colorsAvailable,
            first.setsColorwise,
            first.colorMapping
          );
          const pcs = (first.pcsPerSet || 5) * 1;
          setItems([
            {
              productId: first.id,
              productName: first.name,
              sizesRatio: first.sizesRatio || "30 to 38",
              sizesList: first.sizesList || "30, 32, 34, 36, 38",
              pcsPerSet: first.pcsPerSet || 5,
              sets: 1,
              totalPcs: pcs,
              unitPrice: first.price || 0,
              selectedShades: colors.slice(0, 1),
              availableColors: colors,
              notes: "",
            },
          ]);
        }
      } catch (err: any) {
        toast("Failed to load bill setup data: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Automatically update prices when Customer changes
  useEffect(() => {
    if (!activeCustomer || products.length === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const newRate = getProductPriceForCustomer(prod, activeCustomer);
        return {
          ...item,
          unitPrice: newRate,
        };
      })
    );
  }, [selectedCustomerId]);

  const handleAddProduct = () => {
    if (products.length === 0) return;
    const prod = products[0];
    const colors = getAllProductColors(
      prod.colorsAvailable,
      prod.setsColorwise,
      prod.colorMapping
    );
    const initialPrice = getProductPriceForCustomer(prod, activeCustomer);
    const pcs = (prod.pcsPerSet || 5) * 1;

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        sizesRatio: prod.sizesRatio || "30 to 38",
        sizesList: prod.sizesList || "30, 32, 34, 36, 38",
        pcsPerSet: prod.pcsPerSet || 5,
        sets: 1,
        totalPcs: pcs,
        unitPrice: initialPrice,
        selectedShades: colors.slice(0, 1),
        availableColors: colors,
        notes: "",
      },
    ]);
  };

  const handleRemoveProduct = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, newProductId: number) => {
    const prod = products.find((p) => p.id === newProductId);
    if (!prod) return;
    const colors = getAllProductColors(
      prod.colorsAvailable,
      prod.setsColorwise,
      prod.colorMapping
    );
    const newPrice = getProductPriceForCustomer(prod, activeCustomer);

    setItems((prev) => {
      const copy = [...prev];
      const currentSets = copy[index].sets || 1;
      const pcs = (prod.pcsPerSet || 5) * currentSets;
      copy[index] = {
        ...copy[index],
        productId: prod.id,
        productName: prod.name,
        sizesRatio: prod.sizesRatio || "30 to 38",
        sizesList: prod.sizesList || "",
        pcsPerSet: prod.pcsPerSet || 5,
        totalPcs: pcs,
        unitPrice: newPrice,
        availableColors: colors,
        selectedShades: colors.slice(0, 1),
      };
      return copy;
    });
  };

  // Direct Sets change -> updates totalPcs = sets * pcsPerSet
  const handleSetsChange = (index: number, val: number) => {
    const cleanSets = Math.max(0, val);
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      item.sets = cleanSets;
      item.totalPcs = cleanSets * item.pcsPerSet;
      copy[index] = item;
      return copy;
    });
  };

  // Direct Pieces change -> user can enter exact pieces (e.g. 15, 20, 37 pcs)
  const handlePiecesChange = (index: number, val: number) => {
    const cleanPcs = Math.max(0, val);
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      item.totalPcs = cleanPcs;
      item.sets = Math.max(1, Math.round(cleanPcs / item.pcsPerSet));
      copy[index] = item;
      return copy;
    });
  };

  // Direct Unit Price change
  const handlePriceChange = (index: number, val: number) => {
    const cleanPrice = Math.max(0, val);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], unitPrice: cleanPrice };
      return copy;
    });
  };

  // Toggle optional shade reference (Never changes pieces or price!)
  const handleToggleShade = (index: number, shade: string) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      const exists = item.selectedShades.includes(shade);
      item.selectedShades = exists
        ? item.selectedShades.filter((s) => s !== shade)
        : [...item.selectedShades, shade];
      copy[index] = item;
      return copy;
    });
  };

  const handleAddCustomShade = (index: number) => {
    const shade = (customShadeInputs[index] || "").trim();
    if (!shade) return;
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };
      if (!item.availableColors.includes(shade)) {
        item.availableColors = [...item.availableColors, shade];
      }
      if (!item.selectedShades.includes(shade)) {
        item.selectedShades = [...item.selectedShades, shade];
      }
      copy[index] = item;
      return copy;
    });
    setCustomShadeInputs((prev) => ({ ...prev, [index]: "" }));
  };

  // Grand Totals
  const totalSets = items.reduce((sum, it) => sum + (it.sets || 0), 0);
  const totalPcs = items.reduce((sum, it) => sum + (it.totalPcs || 0), 0);
  const subtotal = Math.round(
    items.reduce((sum, it) => sum + (it.totalPcs || 0) * (it.unitPrice || 0), 0)
  );
  const grandTotal = subtotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast("Please select a customer shop for this bill", "error");
      return;
    }

    if (!billNumber.trim()) {
      toast("Please specify a Bill Number", "error");
      return;
    }

    if (!handwrittenOrderNumber.trim()) {
      toast("Please enter your handwritten Order Number", "error");
      return;
    }

    if (items.length === 0 || totalPcs === 0) {
      toast("Please add at least 1 item with quantity greater than 0", "error");
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = items.map((it) => {
        const itemSub = Math.round((it.totalPcs || 0) * (it.unitPrice || 0));
        const colorSetsPayload =
          it.selectedShades.length > 0
            ? it.selectedShades.map((col) => ({ color: col, sets: Math.max(1, Math.round(it.sets / it.selectedShades.length)) }))
            : [{ color: "Standard", sets: it.sets }];

        return {
          productId: it.productId,
          productName: it.productName,
          sizeRatio: it.sizesRatio,
          sizesList: it.sizesList,
          pcsPerSet: it.pcsPerSet,
          totalSets: it.sets,
          totalPcs: it.totalPcs,
          unitPrice: it.unitPrice,
          subtotal: itemSub,
          colorSets: colorSetsPayload,
          notes: it.selectedShades.length > 0 ? `Colors: ${it.selectedShades.join(", ")}` : "",
        };
      });

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          orderNumber: handwrittenOrderNumber.trim(),
          manualBillNumber: billNumber.trim(),
          taxInvoiceNumber: billNumber.trim(),
          isBillWithoutGst: true,
          billType: "BILL_WITHOUT_GST",
          isPreviousBill: true,
          previousBillDate: billDate,
          orderDate: billDate,
          skipStockDeduction: true,
          placedBy: employee?.name || "Krish Sandip Shah",
          notes: orderNotes.trim() || undefined,
          items: itemsPayload,
          subtotal,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: grandTotal,
          status: "Ready",
        }),
      });

      if (res.ok) {
        toast(`Bill ${billNumber.trim()} generated successfully!`, "success");
        router.push("/orders?tab=bills");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to generate bill", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-slate-500" />
        <p className="text-xs font-semibold text-slate-500">Setting up bill generator...</p>
      </div>
    );
  }

  const isWholesaler = (activeCustomer?.businessType || "").toUpperCase().includes("WHOLESAL");

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-emerald-600" />
            <span>Generate Bill</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sequential bill numbering starting from 1, custom handwritten order number, and direct quantity entry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-950 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save & Generate Bill</span>
          </button>
        </div>
      </div>

      {/* 2. Customer & Bill Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Customer Shop & Bill Details</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Customer Shop *
            </label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 cursor-pointer"
            >
              <option value="">-- Choose Customer Shop --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shopName} — {c.city || "Gujarat"} ({c.phoneNumber}) [{c.businessType || "RETAILER"}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-slate-500" /> Bill Date *
            </label>
            <input
              type="date"
              required
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Selected Customer Card with Price Mode Badge */}
        {activeCustomer && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{activeCustomer.shopName}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isWholesaler
                      ? "bg-purple-100 text-purple-900 border-purple-300"
                      : "bg-blue-100 text-blue-900 border-blue-300"
                  }`}
                >
                  {isWholesaler ? "Wholesale Pricing Applied" : "Retailer Pricing Applied"}
                </span>
                {Number(activeCustomer.specialDiscount) > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-900 border border-teal-300">
                    Spl Disc: -₹{activeCustomer.specialDiscount}/pc
                  </span>
                )}
              </div>
              <div className="text-slate-500 mt-1">
                {activeCustomer.address} • Contact: {activeCustomer.contactPerson || "Owner"} ({activeCustomer.phoneNumber})
              </div>
            </div>
            <div className="font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 font-bold text-slate-800 shrink-0 text-xs">
              GST/PAN: {activeCustomer.gstPanNo || "Unregistered"}
            </div>
          </div>
        )}

        {/* Bill No. & Handwritten Order No. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hash size={13} className="text-emerald-600" />
                <span>Bill No. *</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                <Lock size={10} className="text-slate-400" /> Auto-Assigned
              </span>
            </label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={billNumber || "1"}
              className="w-full px-3.5 py-2.5 bg-slate-100/90 border border-slate-300 rounded-xl text-sm font-mono font-black text-slate-800 cursor-not-allowed select-none focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Auto starts from 1 sequentially (re-fills missing numbers if any bill is deleted).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>Order No. (Handwritten Book #) *</span>
            </label>
            <input
              type="text"
              required
              value={handwrittenOrderNumber}
              onChange={(e) => setHandwrittenOrderNumber(e.target.value)}
              placeholder="Enter written order book number (e.g. 45, B-12)..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Custom order number written in physical order book.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Special Packing / Delivery Notes
          </label>
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="e.g. Transport details, packaging instructions..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* 3. Items & Direct Quantity Input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Bill Items & Quantity</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter sets or pieces directly. Color selection is for reference and will not alter pieces or rate.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddProduct}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Item</span>
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => {
            const itemTotal = (item.totalPcs || 0) * (item.unitPrice || 0);

            return (
              <div
                key={idx}
                className="p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4 relative"
              >
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(idx)}
                    className="absolute right-4 top-4 text-slate-400 hover:text-red-600 text-xs font-bold cursor-pointer"
                  >
                    ✕ Remove
                  </button>
                )}

                {/* Garment Design & Unit Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Garment Product Design *
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductChange(idx, Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.sizesRatio} ({isWholesaler ? `₹${p.wholesalerPrice || p.price}/pc` : `₹${p.retailerPrice || p.price}/pc`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Price per Pc (₹) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sizing & Direct Quantity Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Sizing Info
                    </span>
                    <div className="text-xs font-bold text-slate-800">
                      {item.sizesRatio}{" "}
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({item.pcsPerSet} pcs/set)
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Sets Count
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={item.sets}
                        onChange={(e) => handleSetsChange(idx, parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-slate-900 outline-none"
                      />
                      <span className="text-xs text-slate-500 font-semibold">Sets</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Total Pieces (PCS) *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={item.totalPcs}
                        onChange={(e) => handlePiecesChange(idx, parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-600 outline-none"
                      />
                      <span className="text-xs text-slate-500 font-semibold">PCS</span>
                    </div>
                  </div>
                </div>

                {/* Color Shades (Reference only - never mutates pieces or rate) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Color Shades (Optional Reference for Packing / Dispatch)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Selecting shades does not alter pieces or price
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.availableColors.map((col) => {
                      const colorInfo = getColorHex(col);
                      const isSelected = item.selectedShades.includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => handleToggleShade(idx, col)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: colorInfo.hex }}
                          />
                          <span>{col}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Shade */}
                  <div className="mt-2.5 flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add custom shade (e.g. Wine, Olive)..."
                      value={customShadeInputs[idx] || ""}
                      onChange={(e) =>
                        setCustomShadeInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomShade(idx);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomShade(idx)}
                      disabled={!(customShadeInputs[idx] || "").trim()}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Item Math Bar */}
                <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-950 font-semibold">
                  <div>
                    {item.sets} Sets • <strong>{item.totalPcs} PCS</strong>
                  </div>
                  <div className="font-mono font-bold text-sm">
                    {item.totalPcs} PCS × ₹{item.unitPrice} = {formatCurrency(itemTotal)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Total Calculation */}
      <div className="bg-slate-950 text-white p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="font-bold text-sm tracking-wider uppercase text-slate-300">
            Bill Total Summary
          </div>
          <div className="text-xs text-slate-400">
            Total {items.length} Products • {totalSets} Sets • {totalPcs} PCS
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Wholesale Goods Subtotal:</span>
            <span className="font-mono text-sm">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-lg font-black pt-3 border-t border-slate-800 text-white">
            <span>Grand Total (Payable):</span>
            <span className="font-mono text-emerald-400">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* 5. Bottom Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => router.push("/orders")}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-950 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Save & Generate Bill ({formatCurrency(grandTotal)})</span>
        </button>
      </div>
    </form>
  );
}
