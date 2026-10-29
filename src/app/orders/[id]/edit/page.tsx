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
  Lock,
  Scissors,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { formatCurrency, formatProductNameWithMrp } from "@/lib/utils";
import {
  STANDARD_SIZE_RATIOS,
  type ProductData,
} from "@/lib/types";
import { getColorHex } from "@/lib/colors";
import {
  calculateOrderedColorSetsPieces,
  getAllProductColors,
  getSizesFromRatio,
  getPcsFromRatio,
  sortSizeRatioKeys,
  parseDetailedColorRatioSets,
  parseMixSizesForDisplay,
} from "@/lib/stock";
import { useToast } from "@/components/ui/Toast";
import { useEmployee } from "@/components/providers/EmployeeProvider";
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
  mixSizes?: string | null;
  mixPcs?: number;
  colorMixPcs?: any;
  notes?: string;
}

export default function EmployeeEditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // Seamlessly redirect to the unified Order Form page with full customer details & items loaded
  useEffect(() => {
    if (id) {
      router.replace(`/orders/new?orderId=${encodeURIComponent(id)}`);
    }
  }, [id, router]);

  const { toast } = useToast();
  const { employee, loading: empLoading } = useEmployee();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form Fields
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

    STANDARD_SIZE_RATIOS.forEach((std) => ratioSet.add(std.value));
    return sortSizeRatioKeys(Array.from(ratioSet));
  };

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Order
        const orderRes = await fetch(`/api/orders/${id}`);
        if (!orderRes.ok) {
          const errData = await orderRes.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to load order #${id} (${orderRes.status})`);
        }
        const orderData = await orderRes.json();
        setOrder(orderData);

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

        // Fetch Products Catalog
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

          const mixMatch = it.notes?.match(/\[Mix Sizes:\s*([^\]]+)\]/i)?.[1];
          const itemMix = it.mixSizes || mixMatch || null;
          let itemMixPcs = Number(it.mixPcs) || 0;
          if (itemMix && itemMixPcs === 0) {
            const formatted = parseMixSizesForDisplay({ mixSizes: itemMix, colorMixPcs: it.colorMixPcs }, matchedProd);
            const sumPcs = formatted.reduce((acc, f) => acc + f.sizes.reduce((sAcc, s) => sAcc + s.count, 0), 0);
            if (sumPcs > 0) {
              itemMixPcs = sumPcs;
            } else if (Number(it.totalPcs) > (Number(it.totalSets) * pcsPerSet)) {
              itemMixPcs = Number(it.totalPcs) - (Number(it.totalSets) * pcsPerSet);
            }
          }

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
            unitPrice: Number(it.unitPrice) || Number(matchedProd?.price) || 0,
            itemSubtotal: Number(it.itemSubtotal) || 0,
            colorSets: colorSetsArray,
            product: matchedProd,
            availableRatios: ratios,
            mixSizes: itemMix,
            mixPcs: itemMixPcs,
            colorMixPcs: it.colorMixPcs || null,
            notes: it.notes || "",
          };
        });

        setOrderItems(initialItems);
      } catch (err: any) {
        setError(err.message || "Failed to load order data");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [id]);

  // Handle Mix Sizes Removal
  const handleRemoveMixSizes = (itemIndex: number) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      item.mixSizes = null;
      item.mixPcs = 0;
      item.colorMixPcs = null;
      if (item.notes) {
        item.notes = item.notes
          .replace(/\[Mix Sizes:\s*[^\]]+\]/gi, "")
          .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
          .trim();
      }

      // Recalculate pieces for this item from colorSets
      let calculatedPcs = 0;
      for (const cs of item.colorSets) {
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
        calculatedPcs = item.totalSets * item.pcsPerSet;
      }

      item.totalPcs = calculatedPcs;
      item.itemSubtotal = calculatedPcs * item.unitPrice;

      copy[itemIndex] = item;
      return copy;
    });
    toast("Mix sizes removed from this product", "info");
  };

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

  const handleRatioChange = (itemIndex: number, newRatio: string) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[itemIndex] };
      const sizes = getSizesFromRatio(newRatio);
      const newPcsPerSet = getPcsFromRatio(newRatio, sizes.length || 5);

      item.sizeRatio = newRatio;
      item.sizesList = sizes.join(", ");
      item.pcsPerSet = newPcsPerSet;

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

  const handleRemoveItem = (index: number) => {
    if (orderItems.length <= 1) {
      toast("An order must have at least one product item", "error");
      return;
    }
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
    toast("Item removed from order", "info");
  };

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

  const totalSets = orderItems.reduce((s, it) => s + (Number(it.totalSets) || 0), 0);
  const totalPcs = orderItems.reduce((s, it) => s + (Number(it.totalPcs) || 0), 0);
  const subtotal = orderItems.reduce((s, it) => s + (Number(it.itemSubtotal) || 0), 0);

  const businessType = (order?.businessType || order?.customer?.businessType || "RETAILER").trim().toUpperCase();
  const isWithoutGst =
    businessType === "WHOLESALER WITHOUT GST" ||
    businessType === "WHOLESALE WITHOUT GST" ||
    businessType === "RETAILER WITHOUT GST" ||
    businessType === "RETAILER (WITHOUT GST)" ||
    businessType.includes("WITHOUT GST") ||
    businessType.includes("NO GST");

  const gstRate = isWithoutGst ? 0 : 5.0;
  const gstAmount = isWithoutGst ? 0 : Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round(subtotal + gstAmount);

  // Authorization check
  const isSpecialTL = employee?.name?.trim().toLowerCase() === "krish shah";
  const hasEditApproval = isAdmin || isSpecialTL || Boolean(employee?.canEditOrders);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order) return;

    if (order.status && order.status !== "Pending") {
      toast(`Order #${order.orderNumber} is ${order.status} and locked. Only Pending orders can be edited.`, "error");
      return;
    }

    if (!hasEditApproval) {
      toast("You do not have Administrator approval to edit order forms.", "error");
      return;
    }

    if (totalSets === 0) {
      toast("Please allocate at least 1 set across the products", "error");
      return;
    }

    try {
      setSaving(true);

      const sanitizedItems = orderItems.map((it) => {
        let cleanNotes = it.notes || "";
        if (!it.mixSizes || it.mixSizes === "None") {
          cleanNotes = cleanNotes
            .replace(/\[Mix Sizes:\s*[^\]]+\]/gi, "")
            .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
            .trim();
        } else if (!cleanNotes.includes("[Mix Sizes:")) {
          cleanNotes = [cleanNotes, `[Mix Sizes: ${it.mixSizes}]`].filter(Boolean).join(" | ");
        }

        return {
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
          mixSizes: it.mixSizes || null,
          mixPcs: Number(it.mixPcs) || 0,
          colorMixPcs: it.colorMixPcs || null,
          removeMixSizes: !it.mixSizes || it.mixSizes === "None" || Number(it.mixPcs) === 0,
          notes: cleanNotes || null,
        };
      });

      const res = await fetch(`/api/orders/${order.orderNumber || order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Pending",
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

      toast("✅ Order Form & Products saved successfully!", "success");

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

      router.push(`/orders/${order.orderNumber || order.id}`);
    } catch (err: any) {
      toast(err.message || "Failed to update order", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || empLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-600">Loading Order #{id} &amp; Products...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm space-y-3">
            <div className="font-bold text-base flex items-center gap-2">
              <AlertCircle size={18} />
              <span>Order Not Found</span>
            </div>
            <p>{error || "Could not retrieve order details."}</p>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black"
            >
              <ArrowLeft size={14} />
              <span>Return to Orders</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!hasEditApproval) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-lg mx-auto py-16 px-4 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mx-auto mb-4 shadow-xs">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Order Form Editing Locked</h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Order form editing is locked for your account. Administrator approval is required before you can edit booked orders.
            Please ask the Administrator to approve <strong>Order Form Edit Access</strong> from the Admin Panel under the Employees tab.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href={`/orders/${order.id}`}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-xs"
            >
              ← Back to Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (order.status !== "Pending") {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-lg mx-auto py-16 px-4 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mx-auto mb-4 shadow-xs">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Order Locked ({order.status})</h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            This order has been confirmed by administration ({order.status}). The order form cannot be edited once confirmed.
            If edits are needed, please request the Administrator to change the status back to <strong>Pending</strong>.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href={`/orders/${order.id}`}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-xs"
            >
              ← Back to Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <UserHeader showBack />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Top Header Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Link
              href={`/orders/${order.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
            >
              <ArrowLeft size={14} />
              <span>Back to Order</span>
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Edit Order Form #{order.orderNumber}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Pending (Unlocked)
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Customer: <strong>{order.customer?.shopName || order.customerName}</strong> • Placed By: <strong>{order.placedBy || "Staff"}</strong>
              </p>
            </div>
          </div>

          {/* Top Save / Cancel Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Link
              href={`/orders/${order.id}`}
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

        {/* Info Banner */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-start gap-2.5 shadow-2xs">
          <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Order Form Editor (Admin Approved):</strong> You have approved access to modify products, size ratios, color-wise sets, and quantities for this Pending order. Changes update live and calculate total pieces and GST automatically.
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
                  <span>Add</span>
                </button>
              </div>
            )}
          </div>

          {/* Items List */}
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
                    {/* Unit Price Input */}
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Rate (₹):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitPrice}
                        onChange={(e) => handleEditUnitPrice(itIdx, parseFloat(e.target.value) || 0)}
                        className="w-16 text-xs font-bold text-slate-900 font-mono text-right outline-none bg-transparent"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(itIdx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Remove product from order"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Size Ratio Selector Row */}
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
                          <div className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                            {getPcsFromRatio(ratioKey)} pcs / set
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color-wise Sets Matrix */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Color-wise Set Allocation:
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      Subtotal: <strong>{item.totalSets} Sets</strong> ({item.totalPcs} Pcs)
                    </span>
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
                              style={{ backgroundColor: typeof cHex === "string" ? cHex : cHex.hex }}
                            />
                            <span className="truncate text-xs font-bold text-slate-800" title={cs.color}>
                              {cs.color}
                            </span>
                          </div>

                          {/* Stepper with - / input / + */}
                          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shrink-0 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleEditColorSet(itIdx, cIdx, (Number(cs.sets) || 0) - 1)}
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-black text-xs font-black transition cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={cs.sets ?? 0}
                              onChange={(e) =>
                                handleEditColorSet(itIdx, cIdx, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-10 text-center text-xs font-black py-1 border-x border-slate-200 outline-none text-slate-900 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleEditColorSet(itIdx, cIdx, (Number(cs.sets) || 0) + 1)}
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

                {/* Mix Sizes Section with Remove Button */}
                {(item.mixSizes || (item.mixPcs && item.mixPcs > 0)) && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-black text-[11px] uppercase tracking-wider">
                          Mix Sizes
                        </span>
                        <span className="text-xs font-bold text-amber-900">
                          +{item.mixPcs || 0} Pcs Included
                        </span>
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-800 bg-white/80 border border-amber-200 px-2.5 py-1 rounded-lg">
                        {item.mixSizes}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMixSizes(itIdx)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                      title="Remove mix sizes from this product"
                    >
                      <Trash2 size={13} />
                      <span>Remove Mix Sizes</span>
                    </button>
                  </div>
                )}

                {/* Item Footer Summary */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200 text-xs font-bold text-slate-600">
                  <div>
                    {item.totalSets} Sets × {item.pcsPerSet} pcs = <span className="font-mono text-slate-900">{item.totalPcs} Pieces</span>
                  </div>
                  <div className="font-mono text-sm text-blue-700">
                    {formatCurrency(item.itemSubtotal)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 2: CUSTOMER CONTACT & DELIVERY
            ═══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
            Customer Contact &amp; Delivery Notes
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer Phone Number
              </label>
              <input
                type="text"
                value={editCustomerPhone}
                onChange={(e) => setEditCustomerPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                GST / PAN Number
              </label>
              <input
                type="text"
                value={editCustomerGstPan}
                onChange={(e) => setEditCustomerGstPan(e.target.value)}
                placeholder="GSTIN or PAN"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Delivery Address
            </label>
            <textarea
              rows={2}
              value={editCustomerAddress}
              onChange={(e) => setEditCustomerAddress(e.target.value)}
              placeholder="Shop address..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Special Order Notes &amp; Transport Instructions
            </label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Transport name, packing instructions..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={sendWhatsAppOnSave}
                onChange={(e) => setSendWhatsAppOnSave(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span>Send updated Order Form automatically to customer on WhatsApp</span>
            </label>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            SECTION 3: SUMMARY & SAVE
            ═══════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              Updated Order Summary
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-black font-mono text-white">
                {formatCurrency(grandTotal)}
              </span>
              <span className="text-xs text-slate-300">
                (Subtotal: {formatCurrency(subtotal)} {isWithoutGst ? "+ 0% GST (Without GST)" : `+ 5% GST (${formatCurrency(gstAmount)})`})
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Total: <strong>{totalSets} Sets</strong> ({totalPcs} pieces) across {orderItems.length} products
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/orders/${order.id}`}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-500/30 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Order Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
