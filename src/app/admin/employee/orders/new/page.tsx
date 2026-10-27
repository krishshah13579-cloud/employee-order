"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Layers,
  Percent,
  Save,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import { getAllProductColors } from "@/lib/stock";
import type { CustomerData, ProductData, ColorSetEntry } from "@/lib/types";

interface NewOrderItem {
  productId: number;
  productName: string;
  colorsAvailable: string[];
  colorSets: ColorSetEntry[];
  sizesRatio: string;
  sizesList: string;
  pcsPerSet: number;
  unitPrice: number;
  notes?: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [customOrderNumber, setCustomOrderNumber] = useState("");
  const [customTaxInvoiceNumber, setCustomTaxInvoiceNumber] = useState("");
  const [customTaxInvoiceDate, setCustomTaxInvoiceDate] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [placedBy, setPlacedBy] = useState("Krish Sandip Shah (Admin)");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<NewOrderItem[]>([]);
  const [customShadeInputs, setCustomShadeInputs] = useState<Record<number, string>>({});

  // Option to move Customer Without GST to Bill (Without GST) vs Tax Invoice (with 5% GST)
  const [moveToBillWithoutGst, setMoveToBillWithoutGst] = useState<boolean>(true);
  const [manualBillNumber, setManualBillNumber] = useState<string>("");
  const [isBillMode, setIsBillMode] = useState<boolean>(false);
  const [skipStockDeduction, setSkipStockDeduction] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const isBill = p.get("billType") === "non_gst" || p.get("type") === "bill_without_gst";
      if (isBill) {
        setIsBillMode(true);
        setMoveToBillWithoutGst(true);
      }
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/products?active_only=1"),
        ]);
        if (cRes.ok) setCustomers(await cRes.json());
        if (pRes.ok) {
          const prods: ProductData[] = await pRes.json();
          setProducts(prods);

          // Fetch next order form number starting from 1
          fetch("/api/order-numbers")
            .then((r) => r.json())
            .then((numData) => {
              if (numData?.nextOrderNumber) {
                setCustomOrderNumber(numData.nextOrderNumber);
              }
            })
            .catch(() => {});

          // Pre-populate with first product if available
          if (prods.length > 0) {
            const first = prods[0];
            const colors = getAllProductColors(
              first.colorsAvailable,
              first.setsColorwise,
              first.colorMapping
            );
            setOrderItems([
              {
                productId: first.id,
                productName: first.name,
                colorsAvailable: colors,
                colorSets: colors.map((col, idx) => ({ color: col, sets: idx === 0 ? 2 : 1 })),
                sizesRatio: first.sizesRatio,
                sizesList: first.sizesList,
                pcsPerSet: first.pcsPerSet,
                unitPrice: first.price,
                notes: "",
              },
            ]);
          }
        }
      } catch (err: any) {
        toast("Failed to load initial data: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleAddProductToOrder = () => {
    if (products.length === 0) return;
    const prod = products[0];
    const colors = getAllProductColors(
      prod.colorsAvailable,
      prod.setsColorwise,
      prod.colorMapping
    );

    const isWholesaler = (activeCustomer?.businessType || "").toUpperCase().includes("WHOLESAL");
    const splDisc = Number(activeCustomer?.specialDiscount) || 0;
    const isSpecialDiscount = splDisc > 0 || activeCustomer?.businessType === "RETAILER WITH SPECIAL DISCOUNT";
    const baseRetail = prod.retailerPrice || prod.price;
    const baseWhole = prod.wholesalerPrice || Math.max(0, baseRetail - 100);
    const initialPrice = isWholesaler
      ? (isSpecialDiscount ? Math.max(0, baseWhole - splDisc) : baseWhole)
      : (isSpecialDiscount ? Math.max(0, baseRetail - splDisc) : baseRetail);

    setOrderItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        colorsAvailable: colors,
        colorSets: colors.map((col, idx) => ({ color: col, sets: idx === 0 ? 2 : 1 })),
        sizesRatio: prod.sizesRatio,
        sizesList: prod.sizesList,
        pcsPerSet: prod.pcsPerSet,
        unitPrice: initialPrice,
        notes: "",
      },
    ]);
  };

  const handleRemoveOrderItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateColorSet = (itemIndex: number, colorName: string, setsVal: number) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      item.colorSets = item.colorSets.map((cs) =>
        cs.color === colorName ? { ...cs, sets: Math.max(0, setsVal) } : cs
      );
      copy[itemIndex] = item;
      return copy;
    });
  };

  const handleAddCustomShade = (itemIndex: number) => {
    const input = (customShadeInputs[itemIndex] || "").trim();
    if (!input) return;

    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      const exists = item.colorSets.some(
        (cs) => cs.color.toLowerCase() === input.toLowerCase()
      );
      if (exists) {
        toast(`Shade "${input}" is already in this garment item`, "info");
        return prev;
      }
      item.colorSets = [...item.colorSets, { color: input, sets: 1 }];
      if (!item.colorsAvailable.some((c) => c.toLowerCase() === input.toLowerCase())) {
        item.colorsAvailable = [...item.colorsAvailable, input];
      }
      copy[itemIndex] = item;
      return copy;
    });

    setCustomShadeInputs((prev) => ({ ...prev, [itemIndex]: "" }));
    toast(`Added shade "${input}" with 1 set`);
  };

  const handleRemoveColorFromItem = (itemIndex: number, colorName: string) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      item.colorSets = item.colorSets.filter(
        (cs) => cs.color.toLowerCase() !== colorName.toLowerCase()
      );
      item.colorsAvailable = item.colorsAvailable.filter(
        (c) => c.toLowerCase() !== colorName.toLowerCase()
      );
      copy[itemIndex] = item;
      return copy;
    });
  };

  const getItemTotalSets = (item: NewOrderItem): number =>
    item.colorSets.reduce((sum, cs) => sum + (cs.sets || 0), 0);

  const getItemTotalPcs = (item: NewOrderItem): number =>
    getItemTotalSets(item) * item.pcsPerSet;

  const getItemSubtotal = (item: NewOrderItem): number =>
    getItemTotalPcs(item) * item.unitPrice;

  const orderTotalSets = orderItems.reduce((acc, it) => acc + getItemTotalSets(it), 0);
  const orderTotalPcs = orderItems.reduce((acc, it) => acc + getItemTotalPcs(it), 0);
  const rawSubtotal = Math.round(orderItems.reduce((acc, it) => acc + getItemSubtotal(it), 0));
  const isWithoutGst =
    isBillMode ||
    (activeCustomer?.businessType || "").toUpperCase().includes("WITHOUT GST") ||
    (activeCustomer?.businessType || "").toUpperCase().includes("NO GST");
  const isCashCustomer = Boolean(
    (activeCustomer?.shopName || "").toUpperCase().includes("CASH") ||
    (activeCustomer?.businessType || "").toUpperCase().includes("CASH")
  );

  const effectiveIsBillWithoutGst = isWithoutGst ? moveToBillWithoutGst : false;

  let orderSubtotal = rawSubtotal;
  let orderGst = 0;
  let orderGrandTotal = rawSubtotal;

  if (isCashCustomer) {
    // For Cash Customer: GST is inclusive (e.g. 600 includes 5% GST)
    orderSubtotal = Math.round(rawSubtotal / 1.05);
    orderGst = rawSubtotal - orderSubtotal;
    orderGrandTotal = rawSubtotal;
  } else if (!effectiveIsBillWithoutGst) {
    // Standard GST or Customer Without GST where Admin chose NO (Add 5% GST to invoice)
    orderSubtotal = rawSubtotal;
    orderGst = Math.round(orderSubtotal * 0.05);
    orderGrandTotal = orderSubtotal + orderGst;
  } else {
    // Without GST (Moved to Bill Without GST)
    orderSubtotal = rawSubtotal;
    orderGst = 0;
    orderGrandTotal = rawSubtotal;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast("Please select a customer shop for this order", "error");
      return;
    }

    if (orderItems.length === 0) {
      toast("Please add at least 1 garment item to the order", "error");
      return;
    }

    if (orderTotalSets === 0 || orderTotalPcs === 0) {
      toast("Total sets cannot be 0. Please specify sets against color variants.", "error");
      return;
    }

    if (isWithoutGst && moveToBillWithoutGst && !manualBillNumber.trim()) {
      toast("Mandatory: Please enter the Manual Bill Number for Bill (Without GST)", "error");
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = orderItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sizeRatio: item.sizesRatio,
        pcsPerSet: item.pcsPerSet,
        colorSets: item.colorSets,
        totalSets: getItemTotalSets(item),
        totalPcs: getItemTotalPcs(item),
        unitPrice: item.unitPrice,
        subtotal: getItemSubtotal(item),
        notes: item.notes || "",
      }));

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          orderNumber: customOrderNumber.trim() || undefined,
          taxInvoiceNumber: effectiveIsBillWithoutGst
            ? (manualBillNumber.trim() || undefined)
            : (customTaxInvoiceNumber.trim() || undefined),
          manualBillNumber: effectiveIsBillWithoutGst ? manualBillNumber.trim() : undefined,
          isBillWithoutGst: effectiveIsBillWithoutGst,
          billType: effectiveIsBillWithoutGst ? "BILL_WITHOUT_GST" : "TAX_INVOICE",
          taxInvoiceDate: customTaxInvoiceDate || orderDate || undefined,
          orderDate,
          skipStockDeduction,
          placedBy,
          notes: orderNotes,
          items: itemsPayload,
          subtotal: orderSubtotal,
          gstRate: effectiveIsBillWithoutGst ? 0 : 5.0,
          gstAmount: effectiveIsBillWithoutGst ? 0 : orderGst,
          totalAmount: orderGrandTotal,
          status: effectiveIsBillWithoutGst || customTaxInvoiceNumber.trim() ? "Ready" : "Confirmed",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (effectiveIsBillWithoutGst) {
          toast(`Wholesale Bill (Without GST) #${manualBillNumber.trim() || data.orderNumber} generated successfully!`, "success");
          router.push("/admin/employee/bills");
        } else {
          toast(`Wholesale order ${data.orderNumber} booked successfully!`, "success");
          router.push("/admin/employee/orders");
        }
      } else {
        const err = await res.json();
        toast(err.error || "Failed to book order", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Loading order form data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <Link
            href={isBillMode ? "/admin/employee/bills" : "/admin/employee/orders"}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors mb-1.5"
          >
            <ArrowLeft size={14} />
            <span>{isBillMode ? "Back to Bills (Without GST)" : "Back to Orders"}</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-700" />
            <span>{isBillMode ? "Generate Bill (Wholesale Without GST)" : "Book New Wholesale Garment Order"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isBillMode
              ? "Direct billing without 5% GST. Supports past-dated and post-dated bills with manual bill numbering."
              : "Select retailer shop, allocate color-wise sets (e.g. A-2, B-3), mandatory sizes, rate per pc, and generate 5% GST invoice."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={isBillMode ? "/admin/employee/bills" : "/admin/employee/orders"}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isBillMode ? "Save & Generate Bill" : "Book & Confirm Order"}</span>
          </button>
        </div>
      </div>

      {/* 1. Retailer Client & Date Details */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Customer Shop & Order Info</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Select Retailer Customer Shop *
            </label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900 cursor-pointer"
            >
              <option value="">-- Choose Customer Shop --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shopName} — GST/PAN: {c.gstPanNo} ({c.phoneNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-gray-500" /> {effectiveIsBillWithoutGst ? "Bill Date (Past / Post-Dated) *" : "Order Date *"}
            </label>
            <input
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Selected Customer Snapshot Card */}
        {activeCustomer && (
          <div className="p-3.5 bg-zinc-50 rounded-xl border border-gray-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-gray-900">{activeCustomer.shopName}</span>
              <span className="text-gray-500 ml-2">
                • Contact: {activeCustomer.contactPerson || "Owner"} ({activeCustomer.phoneNumber})
              </span>
              <div className="text-gray-500 mt-0.5">{activeCustomer.address}</div>
            </div>
            <div className="font-mono bg-white px-2.5 py-1 rounded-lg border border-gray-200 font-bold text-gray-800 shrink-0">
              GST/PAN: {activeCustomer.gstPanNo}
            </div>
          </div>
        )}

        {/* Customer Without GST: Move to Bill Without GST vs Add 5% GST to Invoice */}
        {isWithoutGst && (
          <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-amber-950 uppercase tracking-wide block">
                  Move to Bill (Without GST)?
                </span>
                <span className="text-[11px] text-amber-800">
                  Customer registered Without GST ({activeCustomer?.businessType})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMoveToBillWithoutGst(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    moveToBillWithoutGst
                      ? "bg-emerald-600 text-white shadow-xs font-black"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  YES (Bill No GST)
                </button>
                <button
                  type="button"
                  onClick={() => setMoveToBillWithoutGst(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    !moveToBillWithoutGst
                      ? "bg-amber-600 text-white shadow-xs font-black"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  NO (Add 5% GST)
                </button>
              </div>
            </div>

            {moveToBillWithoutGst ? (
              <div className="space-y-3 pt-2 border-t border-amber-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                      Manual Bill Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualBillNumber}
                      onChange={(e) => setManualBillNumber(e.target.value.toUpperCase())}
                      placeholder="Enter manual bill number (e.g. B-01, 101, etc.)..."
                      className="w-full px-3.5 py-2 bg-white border border-emerald-400 rounded-xl text-xs font-bold font-mono text-emerald-950 focus:ring-2 focus:ring-emerald-500 uppercase placeholder:normal-case placeholder:font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1 flex items-center gap-1">
                      <Calendar size={12} className="text-emerald-700" /> Bill Date (Past / Post-Dated)
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-emerald-400 rounded-xl text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-white/80 rounded-xl border border-emerald-200">
                  <input
                    type="checkbox"
                    id="skipStockCheck"
                    checked={skipStockDeduction}
                    onChange={(e) => setSkipStockDeduction(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="skipStockCheck" className="text-[11px] font-medium text-emerald-950 cursor-pointer">
                    Do not deduct from live inventory stock (Recommended for past-dated & post-dated bills)
                  </label>
                </div>

                <p className="text-[10px] text-emerald-800 font-medium">
                  0% GST applied. This bill will be saved with this manual bill number in "Bill (Without GST)".
                </p>
              </div>
            ) : (
              <div className="pt-2 border-t border-amber-200">
                <p className="text-[11px] text-amber-900 font-semibold">
                  5% GST (₹{Math.round(rawSubtotal * 0.05).toLocaleString("en-IN")}) will be added to the invoice and routed to the Tax Invoice register.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Order Placed By (Sales Agent / Staff)
            </label>
            <input
              type="text"
              value={placedBy}
              onChange={(e) => setPlacedBy(e.target.value)}
              placeholder="e.g. Ramesh Patel (Field Staff)"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Special Packing / Delivery Notes
            </label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="e.g. Transport via Shreeji Logistics, urgent dispatch"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Custom Order No. & Tax Invoice No. based on previous accounting bills & written order forms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Order No. (Written Book #)
            </label>
            <input
              type="text"
              value={customOrderNumber}
              onChange={(e) => setCustomOrderNumber(e.target.value)}
              placeholder="e.g. 1, 2, 3 (Auto-generates sequentially from 1)"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Order Form starts from 1, or enter custom handwritten order book #
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Tax Invoice No. (Accounting Bill #)
            </label>
            <input
              type="text"
              value={customTaxInvoiceNumber}
              onChange={(e) => setCustomTaxInvoiceNumber(e.target.value.toUpperCase())}
              placeholder="e.g. 42 (Leave blank if Order Form only)"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-mono font-bold uppercase focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Invoice starts from 1 (Leave blank to generate later when transferring)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Tax Invoice Date
            </label>
            <input
              type="date"
              value={customTaxInvoiceDate}
              onChange={(e) => setCustomTaxInvoiceDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Date on accounting software invoice bill
            </p>
          </div>
        </div>
      </div>

      {/* 2. Itemized Wholesale Garments Builder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Wholesale Garment Items & Color Sets</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select garments, allocate sets color-wise (A-2, B-3), and verify piece calculations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddProductToOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Item</span>
          </button>
        </div>

        <div className="space-y-4">
          {orderItems.map((item, itemIdx) => {
            const itemSets = getItemTotalSets(item);
            const itemPcs = getItemTotalPcs(item);
            const itemTotal = getItemSubtotal(item);

            return (
              <div
                key={itemIdx}
                className="p-4 bg-zinc-50/60 rounded-2xl border border-gray-200 space-y-4 relative"
              >
                {orderItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOrderItem(itemIdx)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-red-600 text-xs font-semibold cursor-pointer"
                  >
                    ✕ Remove
                  </button>
                )}

                {/* Garment Selection & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Garment Design *
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const newProd = products.find((p) => p.id === Number(e.target.value));
                        if (newProd) {
                          const colors = getAllProductColors(
                            newProd.colorsAvailable,
                            newProd.setsColorwise,
                            newProd.colorMapping
                          );
                          setOrderItems((prev) => {
                            const updated = [...prev];
                            updated[itemIdx] = {
                              ...updated[itemIdx],
                              productId: newProd.id,
                              productName: newProd.name,
                              colorsAvailable: colors,
                              colorSets: colors.map((col, idx) => ({ color: col, sets: idx === 0 ? 2 : 1 })),
                              sizesRatio: newProd.sizesRatio,
                              sizesList: newProd.sizesList,
                              pcsPerSet: newProd.pcsPerSet,
                              unitPrice: newProd.price,
                            };
                            return updated;
                          });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.sizesRatio} (₹{p.price}/pc)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                      Price per Pc (₹) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOrderItems((prev) => {
                          const updated = [...prev];
                          updated[itemIdx].unitPrice = val;
                          return updated;
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sizing Info Badge */}
                <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-900">Mandatory Sizing:</span>
                    <span className="px-2 py-0.5 bg-white font-mono rounded text-blue-800 font-bold border border-blue-200 text-[11px]">
                      {item.sizesRatio}
                    </span>
                    <span className="text-gray-500 text-[11px]">[{item.sizesList}]</span>
                  </div>
                  <div className="font-bold text-blue-800 text-[11px]">
                    1 Set = {item.pcsPerSet} Pieces
                  </div>
                </div>

                {/* Colorwise Sets Inputs (A-2, B-3, C-2) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      SET (Color Wise) — Allocate Sets against shades
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {item.colorSets.map((cs) => {
                      const colorInfo = getColorHex(cs.color);
                      return (
                        <div
                          key={cs.color}
                          className="bg-white p-2.5 rounded-xl border border-gray-200 flex flex-col justify-between shadow-2xs relative group"
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 shadow-2xs"
                                style={{ backgroundColor: colorInfo.hex }}
                                title={`Palette: ${colorInfo.hex}`}
                              />
                              <span className="text-xs font-semibold text-gray-800 truncate" title={cs.color}>
                                {cs.color}
                              </span>
                            </div>
                            {item.colorSets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveColorFromItem(itemIdx, cs.color)}
                                className="text-gray-300 hover:text-red-500 text-xs px-1"
                                title={`Remove ${cs.color}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={cs.sets}
                              onChange={(e) =>
                                handleUpdateColorSet(itemIdx, cs.color, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-full px-2 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold text-center font-mono focus:ring-2 focus:ring-zinc-900 outline-none"
                            />
                            <span className="text-[11px] text-gray-400 font-semibold">Sets</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Add Custom Shade with live swatch */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                      <input
                        type="text"
                        placeholder="Add custom shade (e.g. Dark Indigo, Olive, Wine, #1a2538)..."
                        value={customShadeInputs[itemIdx] || ""}
                        onChange={(e) =>
                          setCustomShadeInputs((prev) => ({
                            ...prev,
                            [itemIdx]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomShade(itemIdx);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 pl-8 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                      />
                      <span
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-gray-300"
                        style={{
                          backgroundColor: (customShadeInputs[itemIdx] || "").trim()
                            ? getColorHex(customShadeInputs[itemIdx]).hex
                            : "#e2e8f0",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddCustomShade(itemIdx)}
                      disabled={!(customShadeInputs[itemIdx] || "").trim()}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg transition disabled:opacity-40 shrink-0"
                    >
                      + Add Shade
                    </button>
                    {(customShadeInputs[itemIdx] || "").trim() && (
                      <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">
                        Palette: {getColorHex(customShadeInputs[itemIdx]).hex}
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Item Math Bar */}
                <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-900 gap-2">
                  <div className="flex items-center gap-3">
                    <span>
                      Total Sets: <strong>{itemSets} Sets</strong>
                    </span>
                    <span>•</span>
                    <span>
                      PCS: {itemSets} Sets × {item.pcsPerSet} Sizes ={" "}
                      <strong>{itemPcs} PCS</strong>
                    </span>
                  </div>
                  <div className="font-bold font-mono text-sm">
                    {itemPcs} PCS × ₹{item.unitPrice} = {formatCurrency(itemTotal)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Order Summary & Tax Calculation */}
      <div className="bg-zinc-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="font-bold text-sm tracking-wider uppercase text-zinc-300">
            Order Total Calculation
          </div>
          <div className="text-xs text-zinc-400">
            Total {orderItems.length} Products • {orderTotalSets} Sets • {orderTotalPcs} PCS
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-zinc-300">
            <span>Wholesale Goods Subtotal:</span>
            <span className="font-mono text-sm">{formatCurrency(orderSubtotal)}</span>
          </div>
          <div className="flex justify-between text-amber-400 font-semibold">
            <span className="flex items-center gap-1">
              <Percent size={13} /> Output CGST (2.5%) + SGST (2.5%) — 5% GST:
            </span>
            <span className="font-mono text-sm">+{formatCurrency(orderGst)}</span>
          </div>
          <div className="flex justify-between text-lg font-black pt-3 border-t border-zinc-800 text-white">
            <span>Grand Total (Payable):</span>
            <span className="font-mono text-emerald-400">{formatCurrency(orderGrandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <Link
          href="/admin/employee/orders"
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Book Wholesale Order ({formatCurrency(orderGrandTotal)})</span>
        </button>
      </div>
    </form>
  );
}
