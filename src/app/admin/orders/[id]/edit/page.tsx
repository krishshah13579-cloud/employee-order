"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Package,
  Check,
  Loader2,
  MessageCircle,
  Scissors,
} from "lucide-react";
import { formatCurrency, formatProductNameWithMrp } from "@/lib/utils";
import {
  ORDER_STATUSES,
  STANDARD_SIZE_RATIOS,
  type OrderStatus,
  type ProductData,
} from "@/lib/types";
import { getColorHex } from "@/lib/colors";
import {
  calculateOrderedColorSetsPieces,
  getAllProductColors,
  getSizesFromRatio,
  getPcsFromRatio,
  sortSizeRatioKeys,
  cleanColorName,
  parseDetailedColorRatioSets,
} from "@/lib/stock";
import { useToast } from "@/components/ui/Toast";
import { sendAutomatedWhatsAppDirect } from "@/lib/whatsapp-client";

interface EditColorSet {
  color: string;
  sets: number;
}

interface EditOrderItem {
  id?: number;
  productId: number;
  productName: string;
  mrp?: number | null;
  sizeRatio: string;
  sizesList?: string;
  pcsPerSet: number;
  totalSets: number;
  totalPcs: number;
  unitPrice: number;
  itemSubtotal: number;
  colorSets: EditColorSet[];
  product?: ProductData | null;
  availableRatios: string[];
}

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [editOrderNumber, setEditOrderNumber] = useState("");
  const [editTaxInvoiceNumber, setEditTaxInvoiceNumber] = useState("");
  const [editTaxInvoiceDate, setEditTaxInvoiceDate] = useState("");
  const [editStatus, setEditStatus] = useState<OrderStatus>("Pending");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerGstPan, setEditCustomerGstPan] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPlacedBy, setEditPlacedBy] = useState("");
  const [sendWhatsAppOnSave, setSendWhatsAppOnSave] = useState(true);

  // Items State
  const [orderItems, setOrderItems] = useState<EditOrderItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductData[]>([]);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState("");

  // Helper to extract and sort available ratios for a product
  const getProductAvailableRatios = (prod: ProductData | null | undefined): string[] => {
    const ratioSet = new Set<string>();

    if (prod?.sizesRatio) {
      ratioSet.add(prod.sizesRatio.trim());
    }

    if (prod?.setsColorwise) {
      try {
        const detailed = parseDetailedColorRatioSets(prod.setsColorwise);
        for (const rMap of Object.values(detailed)) {
          for (const rKey of Object.keys(rMap)) {
            if (rKey.trim()) ratioSet.add(rKey.trim());
          }
        }
      } catch {}
    }

    // Always ensure standard presets are accessible
    STANDARD_SIZE_RATIOS.forEach((std) => ratioSet.add(std.value));

    // Sort ratios strictly: "28 to 36" (5 pcs) FIRST, then "28 to 34" (4 pc set) SECOND
    return sortSizeRatioKeys(Array.from(ratioSet));
  };

  useEffect(() => {
    if (!id) return;

    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Order
        const orderRes = await fetch(`/api/orders/${id}`);
        if (!orderRes.ok) {
          throw new Error(`Failed to load order #${id} (${orderRes.status})`);
        }
        const orderData = await orderRes.json();
        setOrder(orderData);

        setEditOrderNumber(orderData.orderNumber || "");
        setEditTaxInvoiceNumber(orderData.taxInvoiceNumber || "");
        setEditTaxInvoiceDate(
          orderData.taxInvoiceDate ? new Date(orderData.taxInvoiceDate).toISOString().slice(0, 10) : ""
        );
        setEditStatus(orderData.status || "Pending");
        setEditCustomerPhone(
          orderData.customer?.phoneNumber || orderData.customerPhone || ""
        );
        setEditCustomerGstPan(
          orderData.customer?.gstPanNo || orderData.customerGstPan || ""
        );
        setEditCustomerAddress(
          orderData.customer?.address || orderData.customerAddress || ""
        );
        setEditNotes(orderData.notes || "");
        setEditPlacedBy(orderData.placedBy || "");

        // Fetch Products Catalog for adding/replacing items
        const prodsRes = await fetch("/api/products?active_only=1");
        let prodsList: ProductData[] = [];
        if (prodsRes.ok) {
          prodsList = await prodsRes.json();
          setAvailableProducts(prodsList);
        }

        // Initialize Order Items
        const initialItems: EditOrderItem[] = (orderData.items || []).map((it: any) => {
          let colorSetsArray: EditColorSet[] = [];
          if (Array.isArray(it.colorSets)) {
            colorSetsArray = it.colorSets;
          } else if (typeof it.colorSets === "string") {
            try {
              const p = JSON.parse(it.colorSets);
              if (Array.isArray(p)) colorSetsArray = p;
            } catch {
              colorSetsArray = [];
            }
          }

          const matchedProd =
            prodsList.find((p) => p.id === it.productId) ||
            prodsList.find((p) => p.name === it.productName) ||
            it.product ||
            null;

          const ratios = getProductAvailableRatios(matchedProd);
          const currentRatio = it.sizeRatio || ratios[0] || "28 to 36";
          const pcsPerSet = it.pcsPerSet || getPcsFromRatio(currentRatio, 5);

          return {
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            mrp: it.mrp || matchedProd?.mrp,
            sizeRatio: currentRatio,
            sizesList: it.sizesList || getSizesFromRatio(currentRatio).join(", "),
            pcsPerSet,
            totalSets: Number(it.totalSets) || 0,
            totalPcs: Number(it.totalPcs) || 0,
            unitPrice: Number(it.unitPrice) || matchedProd?.retailerPrice || matchedProd?.price || 0,
            itemSubtotal: Number(it.itemSubtotal) || 0,
            colorSets: colorSetsArray,
            product: matchedProd,
            availableRatios: ratios,
          };
        });

        setOrderItems(initialItems);
      } catch (err: any) {
        setError(err.message || "Failed to load order details");
        toast(err.message || "Failed to load order", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [id]);

  // Recalculate totals whenever items change
  const totalSets = orderItems.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
  const totalPcs = orderItems.reduce((s, it) => s + (Number(it.totalPcs) || 0), 0);
  const subtotal = orderItems.reduce((s, it) => s + (Number(it.itemSubtotal) || 0), 0);
  const gstAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round(subtotal + gstAmount);

  // Handle color set value edit
  const handleEditColorSet = (itemIndex: number, colorIndex: number, newSets: number) => {
    const val = Math.max(0, newSets);
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      const cSets = [...item.colorSets];

      cSets[colorIndex] = { ...cSets[colorIndex], sets: val };
      item.colorSets = cSets;

      const sumSets = cSets.reduce((sum, cs) => sum + (Number(cs.sets) || 0), 0);
      item.totalSets = sumSets;

      // Recalculate pieces for this item
      let calculatedPcs = 0;
      for (const cs of cSets) {
        const requested = Number(cs.sets) || 0;
        const pcsCalc = calculateOrderedColorSetsPieces(
          item.product?.setsColorwise || null,
          cs.color,
          requested,
          item.pcsPerSet
        );
        calculatedPcs += pcsCalc.totalPcs;
      }
      if (calculatedPcs === 0) {
        calculatedPcs = sumSets * item.pcsPerSet;
      }

      item.totalPcs = calculatedPcs;
      item.itemSubtotal = calculatedPcs * item.unitPrice;

      copy[itemIndex] = item;
      return copy;
    });
  };

  // Handle Size Ratio Change
  // Logic: "if the selected product has below given sizes as 28 to 34 and 28 to 36 give 28 to 36 first and then 4 pc set."
  const handleRatioChange = (itemIndex: number, newRatio: string) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      const sizes = getSizesFromRatio(newRatio);
      const newPcsPerSet = getPcsFromRatio(newRatio, sizes.length || 5);

      item.sizeRatio = newRatio;
      item.sizesList = sizes.join(", ");
      item.pcsPerSet = newPcsPerSet;

      // Recalculate total pieces with new pcsPerSet
      let calculatedPcs = 0;
      for (const cs of item.colorSets) {
        const requested = Number(cs.sets) || 0;
        const pcsCalc = calculateOrderedColorSetsPieces(
          item.product?.setsColorwise || null,
          cs.color,
          requested,
          newPcsPerSet
        );
        calculatedPcs += pcsCalc.totalPcs;
      }
      if (calculatedPcs === 0) {
        calculatedPcs = item.totalSets * newPcsPerSet;
      }

      item.totalPcs = calculatedPcs;
      item.itemSubtotal = calculatedPcs * item.unitPrice;

      copy[itemIndex] = item;
      return copy;
    });
    toast(`Ratio updated to ${newRatio} (${getPcsFromRatio(newRatio)} pcs/set)`, "info");
  };

  // Handle Unit Price Change
  const handleEditUnitPrice = (itemIndex: number, newPrice: number) => {
    const price = Math.max(0, newPrice);
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      item.unitPrice = price;
      item.itemSubtotal = item.totalPcs * price;
      copy[itemIndex] = item;
      return copy;
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    if (orderItems.length <= 1) {
      toast("An order must have at least one product item", "error");
      return;
    }
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
    toast("Item removed from order", "info");
  };

  // Add Product to Order
  const handleAddProduct = (prodIdStr: string) => {
    const pId = parseInt(prodIdStr, 10);
    const prod = availableProducts.find((p) => p.id === pId);
    if (!prod) return;

    let colors = getAllProductColors(prod.colorsAvailable, prod.setsColorwise, prod.colorMapping);
    if (colors.length === 0) colors = ["Standard"];

    const colorSets: EditColorSet[] = colors.map((col, idx) => ({
      color: col,
      sets: idx === 0 ? 1 : 0,
    }));

    const ratios = getProductAvailableRatios(prod);
    // Prioritize 28 to 36 first, then 28 to 34
    const initialRatio = ratios[0] || prod.sizesRatio || "28 to 36";
    const pcsPerSet = getPcsFromRatio(initialRatio, prod.pcsPerSet || 5);
    const totalPcs = pcsPerSet * 1;
    const unitPrice = prod.retailerPrice || prod.price || 0;

    const newItem: EditOrderItem = {
      productId: prod.id,
      productName: prod.name,
      mrp: prod.mrp,
      sizeRatio: initialRatio,
      sizesList: getSizesFromRatio(initialRatio).join(", "),
      pcsPerSet,
      totalSets: 1,
      totalPcs,
      unitPrice,
      itemSubtotal: totalPcs * unitPrice,
      colorSets,
      product: prod,
      availableRatios: ratios,
    };

    setOrderItems((prev) => [...prev, newItem]);
    setSelectedProductToAdd("");
    toast(`Added "${prod.name}" to order`, "success");
  };

  // Save changes
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order) return;

    if (totalSets === 0) {
      toast("Please allocate at least 1 set across the products", "error");
      return;
    }

    try {
      setSaving(true);

      const sanitizedItems = orderItems.map((it) => ({
        id: it.id,
        productId: Number(it.productId) || 0,
        productName: it.productName || "Garment",
        sizeRatio: it.sizeRatio || "28 to 36",
        sizesList: it.sizesList || "Standard",
        pcsPerSet: Number(it.pcsPerSet) || 5,
        totalSets: Number(it.totalSets) || 0,
        totalPcs: Number(it.totalPcs) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        itemSubtotal: Number(it.itemSubtotal) || 0,
        colorSets: Array.isArray(it.colorSets) ? it.colorSets : [],
      }));

      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: editOrderNumber.trim() || undefined,
          taxInvoiceNumber: editTaxInvoiceNumber.trim() || null,
          taxInvoiceDate: editTaxInvoiceDate || null,
          status: editStatus,
          notes: editNotes,
          placedBy: editPlacedBy,
          customerPhone: editCustomerPhone,
          customerAddress: editCustomerAddress,
          customerGstPan: editCustomerGstPan,
          items: sanitizedItems,
          notifyCustomer: sendWhatsAppOnSave,
          sendWhatsApp: sendWhatsAppOnSave,
        }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Invalid server response format"
            : `Server error (${res.status}): ${text.slice(0, 120) || "Failed to update order"}`
        );
      }

      if (!res.ok) throw new Error(data.error || `Failed to update order (${res.status})`);

      toast("✅ Order & Products saved successfully!", "success");

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

      // Navigate back to the order page
      router.push(`/admin/orders/${order.id}`);
    } catch (err: any) {
      toast(err.message || "Failed to update order", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold text-slate-600">Loading Order #{id} &amp; Products...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm space-y-3">
          <div className="font-bold text-base flex items-center gap-2">
            <AlertCircle size={18} />
            <span>Order Not Found</span>
          </div>
          <p>{error || "Could not retrieve order details."}</p>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black"
          >
            <ArrowLeft size={14} />
            <span>Return to Orders List</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/orders/${order.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Back to Order</span>
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>
                {order.taxInvoiceNumber
                  ? `Edit Invoice #${order.taxInvoiceNumber}`
                  : `Edit Order #${order.orderNumber}`}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Product &amp; Ratio Editor
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Customer: <strong>{order.customer?.shopName || order.customerName}</strong> • Date:{" "}
              {new Date(order.orderDate).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>

        {/* Top Save / Cancel Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Link
            href={`/admin/orders/${order.id}`}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save Order Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-start gap-2.5 shadow-2xs">
        <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Full-Page Product &amp; Order Editor:</strong> Directly configure garment products, size ratios, color-wise sets, and piece rates.
          If both <strong>28 to 36</strong> and <strong>28 to 34 (4 pc set)</strong> exist, 28 to 36 is prioritized first.
          Total pieces, piece counts per set, and 5% GST automatically recalculate live.
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 1: PRODUCTS & ITEMS LIST
          ═══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              Garment Products in Order ({orderItems.length})
            </h2>
          </div>

          {/* Add Product Dropdown */}
          {availableProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedProductToAdd}
                onChange={(e) => setSelectedProductToAdd(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-700 cursor-pointer max-w-[280px] truncate font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">+ Add Product from Catalogue...</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category}) — ₹{p.retailerPrice || p.price}/pc
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedProductToAdd}
                onClick={() => handleAddProduct(selectedProductToAdd)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 transition"
              >
                <Plus size={14} />
                <span>Add Product</span>
              </button>
            </div>
          )}
        </div>

        {/* Product Items List */}
        <div className="space-y-4">
          {orderItems.map((item, itIdx) => (
            <div
              key={itIdx}
              className="p-4 sm:p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4 text-xs transition hover:border-slate-300 shadow-2xs"
            >
              {/* Product Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {itIdx + 1}
                  </span>
                  <div>
                    <span className="text-base font-black text-slate-900">
                      {formatProductNameWithMrp(
                        item.productName,
                        item.mrp || item.product?.mrp,
                        item.unitPrice
                      )}
                    </span>
                    <span className="ml-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {item.product?.category || "Apparel"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono font-bold">
                    <span className="text-blue-700 font-extrabold text-sm">
                      {item.totalSets} Sets ({item.totalPcs} Pcs)
                    </span>
                    <span className="text-slate-400 mx-2">=</span>
                    <span className="text-emerald-700 font-extrabold text-sm">
                      {formatCurrency(item.itemSubtotal)}
                    </span>
                  </div>

                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(itIdx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Remove product from order"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Size Ratio Selector Row */}
              {/* Prioritizing: 28 to 36 first, then 28 to 34 (4 pc set) */}
              <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors size={13} className="text-blue-600" />
                    <span>Select Size Ratio / Pack:</span>
                  </label>
                  <span className="text-[11px] font-mono font-semibold text-blue-700">
                    1 Set = {item.pcsPerSet} Pcs [{item.sizesList}]
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {item.availableRatios.map((ratioKey) => {
                    const isSelected = item.sizeRatio === ratioKey;
                    const pcs = getPcsFromRatio(ratioKey);
                    const isFourPcSet = ratioKey.includes("28 to 34") || pcs === 4;

                    return (
                      <button
                        key={ratioKey}
                        type="button"
                        onClick={() => handleRatioChange(itIdx, ratioKey)}
                        className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-50 hover:bg-blue-50 text-slate-800 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="font-black text-xs flex items-center justify-between">
                          <span>{ratioKey}</span>
                          {isSelected && <Check size={13} className="text-white shrink-0" />}
                        </div>
                        <div
                          className={`text-[10px] font-medium mt-0.5 ${
                            isSelected ? "text-blue-100" : "text-slate-500"
                          }`}
                        >
                          {pcs} pcs/set {isFourPcSet ? "• 4 pc set" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color-wise Sets Stepper Grid */}
              {item.colorSets && item.colorSets.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Color-Wise Sets:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {item.colorSets.map((cs, cIdx) => {
                      const cHex = getColorHex(cs.color);
                      return (
                        <div
                          key={cIdx}
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1.5">
                            <span
                              className="w-4 h-4 rounded-full border border-black/15 shrink-0 shadow-2xs"
                              style={{ backgroundColor: cHex.hex }}
                            />
                            <span
                              className="truncate text-xs font-bold text-slate-800"
                              title={cs.color}
                            >
                              {cs.color}
                            </span>
                          </div>

                          {/* Stepper with - / input / + */}
                          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shrink-0 shadow-2xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleEditColorSet(
                                  itIdx,
                                  cIdx,
                                  (Number(cs.sets) || 0) - 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-black text-xs font-black transition cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={cs.sets === 0 ? "" : cs.sets}
                              placeholder="0"
                              onChange={(e) =>
                                handleEditColorSet(
                                  itIdx,
                                  cIdx,
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-10 h-7 border-x border-slate-300 text-center text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-blue-50/50"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleEditColorSet(
                                  itIdx,
                                  cIdx,
                                  (Number(cs.sets) || 0) + 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-black text-xs font-black transition cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Row */}
              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200/80 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Price / Piece (₹):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleEditUnitPrice(itIdx, parseFloat(e.target.value) || 0)
                    }
                    className="w-28 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400 text-[11px]">per PC</span>
                </div>

                <div className="text-slate-600 text-xs">
                  Rate per Set: <strong>₹{(item.unitPrice * item.pcsPerSet).toLocaleString("en-IN")}</strong>
                  <span className="text-slate-400 mx-1.5">•</span>
                  Subtotal: <strong className="text-emerald-700">{formatCurrency(item.itemSubtotal)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 2: CUSTOMER & ORDER DETAILS
          ═══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
          Customer &amp; Delivery Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Order Status*
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Phone (WhatsApp)*
            </label>
            <input
              type="text"
              value={editCustomerPhone}
              onChange={(e) => setEditCustomerPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              GST / PAN Number
            </label>
            <input
              type="text"
              value={editCustomerGstPan}
              onChange={(e) => setEditCustomerGstPan(e.target.value.toUpperCase())}
              placeholder="GSTIN / PAN"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Customer Delivery Address
            </label>
            <input
              type="text"
              value={editCustomerAddress}
              onChange={(e) => setEditCustomerAddress(e.target.value)}
              placeholder="Shop address, city, state"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transport / Order Notes
            </label>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="e.g. [TRANSPORT: Patel Transport] urgent parcel"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Order No. & Tax Invoice No. based on previous accounting bills & written order forms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Order No. (Written Book #)*
            </label>
            <input
              type="text"
              required
              value={editOrderNumber}
              onChange={(e) => setEditOrderNumber(e.target.value)}
              placeholder="e.g. 101, ORD-45"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Based on your handwritten order form book
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tax Invoice No. (Accounting Bill #)
            </label>
            <input
              type="text"
              value={editTaxInvoiceNumber}
              onChange={(e) => setEditTaxInvoiceNumber(e.target.value.toUpperCase())}
              placeholder="e.g. INV-2425-001 (Optional)"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Based on previous bill in your accounting software
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tax Invoice Date
            </label>
            <input
              type="date"
              value={editTaxInvoiceDate}
              onChange={(e) => setEditTaxInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Date on accounting software invoice bill
            </p>
          </div>
        </div>

        {/* WhatsApp Notification Option */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 mt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-950">
            <input
              type="checkbox"
              checked={sendWhatsAppOnSave}
              onChange={(e) => setSendWhatsAppOnSave(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} className="text-emerald-700" />
              <span>Send updated Order Form / Invoice directly to customer on WhatsApp</span>
            </span>
          </label>
          <p className="text-[11px] text-emerald-700 pl-6">
            When status is <strong>Confirmed</strong>, the customer receives the official Confirmed Order Form PDF.
            When status is <strong>Ready</strong> or <strong>Dispatched</strong>, the customer receives the Ready Order / Tax Invoice PDF.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 3: LIVE RECALCULATION & SUMMARY
          ═══════════════════════════════════════════ */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="text-xs text-slate-400 font-mono">ORDER SUMMARY CALCULATION</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200">
            <span>Total Sets: <strong className="text-white text-sm">{totalSets}</strong></span>
            <span>•</span>
            <span>Total Pieces: <strong className="text-white text-sm">{totalPcs}</strong></span>
            <span>•</span>
            <span>Subtotal: <strong className="text-white text-sm">{formatCurrency(subtotal)}</strong></span>
            <span>•</span>
            <span>5% GST: <strong className="text-amber-400 text-sm">+{formatCurrency(gstAmount)}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Grand Total Payable</div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {formatCurrency(grandTotal)}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-md transition cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
