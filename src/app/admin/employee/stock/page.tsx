"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Search,
  RefreshCw,
  Edit,
  Save,
  X,
  Package,
  Layers,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Tag,
  Plus,
  Trash2,
  ArrowUpRight,
  ShieldAlert,
  FileText,
  Upload,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatExactRate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { getColorHex } from "@/lib/colors";
import { cleanColorName } from "@/lib/stock";

interface StockItem {
  id: number;
  name: string;
  category: string;
  imageUrl: string;
  colorsAvailable: string;
  colorMapping?: string | null;
  colors: string[];
  sizesRatio: string;
  pcsPerSet: number;
  mrp?: number | null;
  retailerPrice?: number | null;
  wholesalerPrice?: number | null;
  price: number;
  costPrice?: number | null;
  mixPcs: number;
  totalSets: number;
  totalSetPcs: number;
  totalPcs: number;
  totalDamagePcs?: number;
  damageStock?: string | null;
  totalValuation: number;
  setsColorwise?: string | null;
  detailedRatioSets?: Record<string, Record<string, number>>;
  isActive: boolean;
}

interface SoldProfitBreakdownItem {
  productId: number;
  productName: string;
  category: string;
  unitsSold: number;
  sellingRevenue: number;
  avgSellingPrice: number;
  costPrice: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
}

interface BillProfitBreakdownItem {
  billNo: string;
  orderId: number;
  customerName: string;
  date: string;
  totalPcs: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

interface StockMetrics {
  totalStyles: number;
  activeInStock: number;
  grandTotalSets: number;
  grandTotalMixPcs: number;
  grandTotalPcs: number;
  grandTotalDamagePcs?: number;
  grandTotalValuation: number;
  grandTotalSoldUnits?: number;
  grandTotalSalesRevenue?: number;
  grandTotalCostOfSold?: number;
  grandTotalSoldProfit?: number;
  overallMarginPercent?: number;
  soldProfitBreakdown?: SoldProfitBreakdownItem[];
  billProfitBreakdown?: BillProfitBreakdownItem[];
}

interface AccessoryItemData {
  id: number;
  name: string;
  category: string;
  imageUrl?: string | null;
  quantity: number;
  unit: string;
  minAlertQty: number;
  costPerUnit: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AccessorySummary {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  totalValuation: number;
}

const ACCESSORY_CATEGORIES = [
  "All",
  "Buttons",
  "Tags",
  "Size Label",
  "Flag Label",
  "Zippers",
  "Pocketing",
  "Care Label",
  "Others",
];

export default function AdminStockPage() {
  const { toast } = useToast();

  // Active view tab
  const [activeTab, setActiveTab] = useState<"GARMENT_STOCK" | "ACCESSORIES">("GARMENT_STOCK");

  // Garment Stock state
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Edit Stock Modal
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editMixPcs, setEditMixPcs] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<string>("");
  const [editColorRatios, setEditColorRatios] = useState<Record<string, Record<string, number>>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncingStore, setSyncingStore] = useState(false);
  const [modalCustomRatio, setModalCustomRatio] = useState("");

  // Admin Damage Cash Sale Modal
  const [isDamageSaleOpen, setIsDamageSaleOpen] = useState(false);
  const [damageSaleProduct, setDamageSaleProduct] = useState<StockItem | null>(null);
  const [damageSaleColor, setDamageSaleColor] = useState<string>("");
  const [damageSalePcs, setDamageSalePcs] = useState<string>("");
  const [damageSaleRate, setDamageSaleRate] = useState<string>("");
  const [damageSaleBuyer, setDamageSaleBuyer] = useState<string>("");
  const [damageSaleNotes, setDamageSaleNotes] = useState<string>("");
  const [sellingDamage, setSellingDamage] = useState(false);

  const handleOpenDamageSale = (item?: StockItem) => {
    if (item) {
      setDamageSaleProduct(item);
      let firstColor = "";
      if (item.damageStock) {
        try {
          const parsed = JSON.parse(item.damageStock);
          const cols = Object.keys(parsed).filter((c) => (parsed[c]?.pcs || 0) > 0);
          if (cols.length > 0) firstColor = cols[0];
        } catch {}
      }
      setDamageSaleColor(firstColor);
    } else {
      const withDamage = stockItems.find((p) => (p.totalDamagePcs || 0) > 0);
      setDamageSaleProduct(withDamage || stockItems[0] || null);
      setDamageSaleColor("");
    }
    setDamageSalePcs("");
    setDamageSaleRate("");
    setDamageSaleBuyer("");
    setDamageSaleNotes("");
    setIsDamageSaleOpen(true);
  };

  const handleConfirmDamageCashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageSaleProduct) {
      toast("Please select a product", "error");
      return;
    }
    if (!damageSaleColor) {
      toast("Please select a color", "error");
      return;
    }
    const numPcs = parseInt(damageSalePcs, 10);
    const numRate = parseFloat(damageSaleRate);
    if (!numPcs || numPcs <= 0) {
      toast("Please enter a valid pieces count (> 0)", "error");
      return;
    }
    if (isNaN(numRate) || numRate <= 0) {
      toast("Please enter a valid cash rate per piece (₹/pc)", "error");
      return;
    }

    try {
      setSellingDamage(true);
      const res = await fetch("/api/admin/damage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": "krish_clothing_admin_2026",
        },
        body: JSON.stringify({
          productId: damageSaleProduct.id,
          color: damageSaleColor,
          pcs: numPcs,
          ratePerPc: numRate,
          buyerName: damageSaleBuyer.trim() || "Cash Buyer",
          notes: damageSaleNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record damage cash sale");
      }

      toast(
        `Sold ${numPcs} damage pcs of ${damageSaleProduct.name} (${damageSaleColor}) for ₹${data.damageSale?.totalAmount || Math.round(numPcs * numRate)} Cash!`,
        "success"
      );
      setIsDamageSaleOpen(false);
      fetchStock();
    } catch (err: any) {
      toast(err.message || "Failed to record cash sale", "error");
    } finally {
      setSellingDamage(false);
    }
  };

  // Accessories state
  const [accessories, setAccessories] = useState<AccessoryItemData[]>([]);
  const [accessorySummary, setAccessorySummary] = useState<AccessorySummary | null>(null);
  const [accessoriesLoading, setAccessoriesLoading] = useState(false);
  const [selectedAccessoryCategory, setSelectedAccessoryCategory] = useState("All");
  const [accessorySearch, setAccessorySearch] = useState("");
  const [isAddAccessoryOpen, setIsAddAccessoryOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<AccessoryItemData | null>(null);
  const [savingAccessory, setSavingAccessory] = useState(false);
  const [accessoryForm, setAccessoryForm] = useState({
    name: "",
    category: "Buttons",
    imageUrl: "",
    quantity: "1000",
    unit: "Pcs",
    minAlertQty: "200",
    costPerUnit: "1.00",
    notes: "",
  });
  const [accessoryTypes, setAccessoryTypes] = useState<string[]>([
    "Buttons", "Tags", "Size Label", "Flag Label", "Zippers", "Pocketing", "Care Label", "Others"
  ]);
  const [newTypeName, setNewTypeName] = useState("");
  const [isAddingType, setIsAddingType] = useState(false);
  const [isManagingTypes, setIsManagingTypes] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

  const handleSyncStore = async () => {
    try {
      setSyncingStore(true);
      const res = await fetch("/api/admin/stock/sync-ecommerce", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to synchronize storefront stock");
      }
      toast(
        data?.message || `Synced products with E-Commerce Storefront! Out-of-stock items hidden automatically.`,
        "success"
      );
      fetchStock();
    } catch (e: any) {
      toast("Storefront sync error: " + e.message, "error");
    } finally {
      setSyncingStore(false);
    }
  };

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stock", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load stock data");
      const data = await res.json();
      setStockItems(data.stockItems || []);
      setMetrics(data.metrics || null);
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Failed to load stock data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccessories = async () => {
    try {
      setAccessoriesLoading(true);
      const res = await fetch("/api/admin/stock/accessories", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load accessories");
      const data = await res.json();
      setAccessories(data.items || []);
      setAccessorySummary(data.summary || null);
      if (Array.isArray(data.types) && data.types.length > 0) {
        setAccessoryTypes(data.types);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setAccessoriesLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchAccessories();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    stockItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      const matchSearch =
        search.trim() === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase()) ||
        item.colors.some((c) => c.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        selectedCategory === "ALL" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [stockItems, search, selectedCategory]);


  // Accessories filtered
  const filteredAccessories = useMemo(() => {
    return accessories.filter((it) => {
      const matchCat =
        selectedAccessoryCategory === "All" ||
        it.category.toLowerCase() === selectedAccessoryCategory.toLowerCase();
      const matchSearch =
        !accessorySearch.trim() ||
        it.name.toLowerCase().includes(accessorySearch.toLowerCase()) ||
        it.category.toLowerCase().includes(accessorySearch.toLowerCase()) ||
        (it.notes && it.notes.toLowerCase().includes(accessorySearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [accessories, selectedAccessoryCategory, accessorySearch]);

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setEditMixPcs(item.mixPcs || 0);
    setEditCostPrice(item.costPrice !== null && item.costPrice !== undefined ? String(item.costPrice) : "");
    const initialRatios = item.detailedRatioSets ? JSON.parse(JSON.stringify(item.detailedRatioSets)) : {};
    for (const c of item.colors) {
      const clean = cleanColorName(c);
      if (!initialRatios[clean] || Object.keys(initialRatios[clean]).length === 0) {
        initialRatios[clean] = { [item.sizesRatio || "30 to 38"]: 4 };
      }
    }
    setEditColorRatios(initialRatios);
  };

  const handleRatioCountChange = (color: string, ratio: string, count: number) => {
    setEditColorRatios((prev) => {
      const updated = { ...prev };
      if (!updated[color]) updated[color] = {};
      updated[color] = { ...updated[color], [ratio]: Math.max(0, count) };
      return updated;
    });
  };

  const handleAddRatioToColor = (color: string, newRatio: string) => {
    if (!newRatio.trim()) return;
    setEditColorRatios((prev) => {
      const updated = { ...prev };
      if (!updated[color]) updated[color] = {};
      if (updated[color][newRatio] === undefined) {
        updated[color] = { ...updated[color], [newRatio]: 1 };
      }
      return updated;
    });
  };

  const handleRemoveRatioFromColor = (color: string, ratio: string) => {
    setEditColorRatios((prev) => {
      const updated = { ...prev };
      if (updated[color]) {
        const copy = { ...updated[color] };
        delete copy[ratio];
        updated[color] = copy;
      }
      return updated;
    });
  };

  const saveStockEdit = async () => {
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const res = await fetch("/api/admin/stock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingItem.id,
          mixPcs: editMixPcs,
          costPrice: editCostPrice === "" ? null : parseFloat(editCostPrice),
          setsColorwise: JSON.stringify(editColorRatios),
          sizesRatio: editingItem.sizesRatio,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stock");
      }

      toast(`Stock updated for ${editingItem.name}!`, "success");
      setEditingItem(null);
      fetchStock();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // Accessories management
  const handleOpenAddAccessory = () => {
    setEditingAccessory(null);
    setAccessoryForm({
      name: "",
      category: accessoryTypes[0] || "Buttons",
      imageUrl: "",
      quantity: "1000",
      unit: "Pcs",
      minAlertQty: "200",
      costPerUnit: "1.00",
      notes: "",
    });
    setIsManagingTypes(false);
    setIsAddAccessoryOpen(true);
  };

  const handleOpenEditAccessory = (item: AccessoryItemData) => {
    setEditingAccessory(item);
    setAccessoryForm({
      name: item.name,
      category: item.category,
      imageUrl: item.imageUrl || "",
      quantity: String(item.quantity),
      unit: item.unit,
      minAlertQty: String(item.minAlertQty),
      costPerUnit: String(item.costPerUnit),
      notes: item.notes || "",
    });
    setIsManagingTypes(false);
    setIsAddAccessoryOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAccessoryForm((prev) => ({ ...prev, imageUrl: data.url }));
      toast("Trim photo uploaded successfully!", "success");
    } catch (err: any) {
      toast(err.message || "Failed to upload photo", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddAccessoryType = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/admin/stock/accessories/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add trim type");
      setAccessoryTypes(data.types || [...accessoryTypes, trimmed]);
      setAccessoryForm((prev) => ({ ...prev, category: trimmed }));
      setNewTypeName("");
      setIsAddingType(false);
      toast(`Added trim type: "${trimmed}"`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to add trim type", "error");
    }
  };

  const handleDeleteAccessoryType = async (typeName: string) => {
    if (!confirm(`Are you sure you want to delete trim type "${typeName}"?`)) return;
    try {
      const res = await fetch(`/api/admin/stock/accessories/types?name=${encodeURIComponent(typeName)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete trim type");
      setAccessoryTypes(data.types || accessoryTypes.filter((t) => t !== typeName));
      if (accessoryForm.category === typeName) {
        setAccessoryForm((prev) => ({ ...prev, category: data.types?.[0] || "Buttons" }));
      }
      toast(`Deleted trim type "${typeName}"`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to delete trim type", "error");
    }
  };

  const handleSaveAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAccessory(true);
      const isEdit = !!editingAccessory;
      const url = "/api/admin/stock/accessories";
      const method = isEdit ? "PUT" : "POST";
      const payload: any = {
        name: accessoryForm.name.trim(),
        category: accessoryForm.category.trim(),
        imageUrl: accessoryForm.imageUrl.trim() || null,
        quantity: parseInt(accessoryForm.quantity, 10) || 0,
        unit: accessoryForm.unit.trim() || "Pcs",
        minAlertQty: parseInt(accessoryForm.minAlertQty, 10) || 0,
        costPerUnit: parseFloat(accessoryForm.costPerUnit) || 0,
        notes: accessoryForm.notes.trim() || null,
      };
      if (isEdit) {
        payload.id = editingAccessory.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save trim/accessory item");
      }

      toast(`${accessoryForm.name} saved successfully!`, "success");
      setIsAddAccessoryOpen(false);
      setEditingAccessory(null);
      fetchAccessories();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingAccessory(false);
    }
  };

  const handleAdjustAccessoryQty = async (id: number, delta: number) => {
    try {
      const it = accessories.find((a) => a.id === id);
      if (!it) return;
      const newQty = Math.max(0, it.quantity + delta);

      const res = await fetch("/api/admin/stock/accessories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quantity: newQty }),
      });

      if (!res.ok) throw new Error("Failed to adjust quantity");
      fetchAccessories();
    } catch (err: any) {
      toast(err.message || "Failed to adjust", "error");
    }
  };

  const handleDeleteAccessory = async (id: number, name: string) => {
    if (!confirm(`Delete accessory "${name}" from stock tracking?`)) return;
    try {
      const res = await fetch(`/api/admin/stock/accessories?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete accessory");
      toast(`Deleted ${name}`, "success");
      fetchAccessories();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            <Boxes size={14} className="text-blue-600" />
            <span>Inventory & Valuation Control</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Stock Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor available sets, loose stock, sold unit profit, and trims (buttons, tags & labels).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenDamageSale()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            title="Admin Only: Sell damaged pieces in cash at custom rate"
          >
            <AlertTriangle size={13} />
            <span>Sell Damage (Cash)</span>
          </button>

          <button
            type="button"
            onClick={handleSyncStore}
            disabled={syncingStore}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            title="Sync live pieces with E-Commerce Storefront (iqtrousers.in)"
          >
            <RefreshCw size={13} className={syncingStore ? "animate-spin" : ""} />
            <span>{syncingStore ? "Syncing Storefront..." : "Sync Storefront"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchStock();
              fetchAccessories();
            }}
            disabled={loading || accessoriesLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading || accessoriesLoading ? "animate-spin" : ""} />
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MAIN TABS SWITCHER
          ═══════════════════════════════════════════ */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("GARMENT_STOCK")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === "GARMENT_STOCK"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Boxes size={14} />
          <span>Garment Inventory ({stockItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ACCESSORIES")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
            activeTab === "ACCESSORIES"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Tag size={14} className={activeTab === "ACCESSORIES" ? "text-white" : "text-blue-600"} />
          <span>Buttons, Tags, Size & Flag Labels ({accessories.length})</span>
          {accessorySummary && accessorySummary.lowStockCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {accessorySummary.lowStockCount} Low
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          VIEW 1: GARMENT INVENTORY (RATIO SETS & MIX PCS)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "GARMENT_STOCK" && (
        <div className="space-y-4">
          {/* ═══════════════════════════════════════════
              5 METRIC KPI CARDS (INSIDE GARMENT INVENTORY)
              ═══════════════════════════════════════════ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* 1. Total Styles */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-all">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Package size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">
                  Total Styles
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight block truncate">
                  {metrics?.totalStyles ?? 0}
                </span>
              </div>
            </div>

            {/* 2. Total Sets */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-all">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Boxes size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">
                  Total Sets
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight block truncate">
                  {metrics?.grandTotalSets ?? 0}
                </span>
              </div>
            </div>

            {/* 3. Total Pieces */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-all">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">
                  Total Pieces
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight block truncate">
                  {metrics?.grandTotalPcs ?? 0}
                </span>
              </div>
            </div>

            {/* 4. Total Damage Pieces (Cash Pool Only) */}
            <div
              onClick={() => handleOpenDamageSale()}
              className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-2xs flex items-center gap-3.5 hover:border-amber-300 hover:bg-amber-100/60 transition-all cursor-pointer"
              title="Click to sell damage pieces in Cash (Admin Only)"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block truncate">
                  Damage Pcs (Cash)
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono tracking-tight block truncate">
                  {metrics?.grandTotalDamagePcs ?? 0} Pcs
                </span>
              </div>
            </div>

            {/* 5. Inventory Valuation */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5 hover:border-slate-300 transition-all col-span-2 sm:col-span-1">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">
                  Valuation
                </span>
                <span
                  className="text-lg sm:text-xl font-black text-emerald-700 font-mono tracking-tight block truncate"
                  title={formatCurrency(metrics?.grandTotalValuation ?? 0)}
                >
                  {formatCurrency(metrics?.grandTotalValuation ?? 0)}
                </span>
              </div>
            </div>
          </div>
          {/* Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search style name, color shade, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 transition"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter size={14} className="text-slate-400 shrink-0 hidden sm:block" />
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Garments Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Colors</th>
                    <th className="py-3 px-4">Set (Ratio Wise)</th>
                    <th className="py-3 px-4 text-center">Mix Pcs</th>
                    <th className="py-3 px-4 text-right">Costing</th>
                    <th className="py-3 px-4 text-right">Total Price</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-300" />
                        <span>Loading inventory stock data...</span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Boxes size={32} className="mx-auto mb-2 text-slate-300" />
                        <span>No stock styles found matching your filter.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const detailed = item.detailedRatioSets || {};

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* 1. Product Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' fill='%23e2e8f0'><rect width='80' height='80'/></svg>";
                                  }}
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block text-sm">
                                  {item.name}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium flex-wrap">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-700">
                                    {item.category}
                                  </span>
                                  {item.mrp && (
                                    <span className="line-through text-slate-400 font-mono text-[10px]">
                                      MRP {formatCurrency(item.mrp)}
                                    </span>
                                  )}
                                  {(item.totalDamagePcs || 0) > 0 && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      ⚠️ {item.totalDamagePcs} Damage Pcs
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Colors */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                              {item.colors.map((c) => {
                                const hex = getColorHex(c).hex;
                                return (
                                  <span
                                    key={c}
                                    title={c}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700"
                                  >
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                                      style={{ backgroundColor: hex }}
                                    />
                                    <span>{c}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* 3. Set (Ratio Wise Breakdown) */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                                <span>{item.totalSets} Sets</span>
                                <span className="text-[10px] font-semibold text-slate-500 font-sans">
                                  ({item.totalSetPcs} pcs)
                                </span>
                              </div>

                              {/* Multi-ratio tags */}
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                {Object.entries(detailed).map(([col, ratios]) => {
                                  const ratioParts = Object.entries(ratios)
                                    .filter(([_, s]) => s > 0)
                                    .map(([r, s]) => `${r}: ${s}`);
                                  if (ratioParts.length === 0) return null;

                                  return (
                                    <span
                                      key={col}
                                      className="bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                                    >
                                      <strong>{col}:</strong> {ratioParts.join(", ")}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </td>

                          {/* 4. Mix Pcs */}
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                            {item.mixPcs > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                                {item.mixPcs} pcs
                              </span>
                            ) : (
                              <span className="text-slate-400">0 pcs</span>
                            )}
                          </td>

                          {/* 5. Costing */}
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-800">
                            {item.costPrice !== null && item.costPrice !== undefined ? (
                              formatCurrency(item.costPrice)
                            ) : (
                              <span className="text-slate-400 italic">Not set</span>
                            )}
                          </td>

                          {/* 6. Total Price */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                            {formatCurrency(item.totalValuation)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Edit size={12} />
                                <span>Edit</span>
                              </button>
                              {(item.totalDamagePcs || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDamageSale(item)}
                                  className="px-2 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                  title="Admin Cash Sale for Damage Pieces"
                                >
                                  <AlertTriangle size={11} />
                                  <span>Sell Damage ({item.totalDamagePcs})</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* ═══════════════════════════════════════════════════════════════════
          VIEW 3: BUTTONS, TAGS, SIZE LABEL, FLAG LABEL & ACCESSORIES
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "ACCESSORIES" && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Trim Types</span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {accessorySummary?.totalItems ?? accessories.length}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Units In Stock</span>
              <span className="text-xl font-black text-blue-700 font-mono">
                {(accessorySummary?.totalQuantity ?? 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Low Stock Alerts</span>
              <span className={`text-xl font-black font-mono ${
                (accessorySummary?.lowStockCount ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
              }`}>
                {accessorySummary?.lowStockCount ?? 0}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Trims Valuation</span>
              <span className="text-xl font-black text-amber-700 font-mono">
                {formatCurrency(accessorySummary?.totalValuation ?? 0)}
              </span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search buttons, hangtags, labels, zippers..."
                value={accessorySearch}
                onChange={(e) => setAccessorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 overflow-x-auto">
                {["All", ...accessoryTypes].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedAccessoryCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      selectedAccessoryCategory === cat
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleOpenAddAccessory}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0 ml-auto"
              >
                <Plus size={14} />
                <span>Add Trim / Accessory</span>
              </button>
            </div>
          </div>

          {/* Accessories Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-14 text-center">Photo</th>
                    <th className="py-3 px-4">Trim / Accessory Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Min Alert Level</th>
                    <th className="py-3 px-4 text-right">Cost / Unit</th>
                    <th className="py-3 px-4 text-right">Total Valuation</th>
                    <th className="py-3 px-4 text-center">Quick Adjust</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {accessoriesLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-300" />
                        <span>Loading accessories stock...</span>
                      </td>
                    </tr>
                  ) : filteredAccessories.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Tag size={32} className="mx-auto mb-2 text-slate-300" />
                        <span>No trims or accessories found. Click &quot;Add Trim / Accessory&quot; above to add buttons, labels, tags, etc.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredAccessories.map((item) => {
                      const isLow = item.quantity <= item.minAlertQty;
                      const itemValuation = Math.round(item.quantity * item.costPerUnit);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-center">
                            {item.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => setViewingImage({ url: item.imageUrl!, title: item.name })}
                                className="w-10 h-10 mx-auto rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:scale-105 transition-transform cursor-pointer shadow-2xs block"
                                title="Click to view full photo"
                              >
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-10 h-10 mx-auto rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                                <ImageIcon size={16} />
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block text-xs">
                              {item.name}
                            </span>
                            {item.notes && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {item.notes}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              <Tag size={10} className="text-slate-500" />
                              <span>{item.category}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-sm">
                            <span className={isLow ? "text-red-600" : "text-slate-900"}>
                              {item.quantity.toLocaleString("en-IN")} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                <ShieldAlert size={11} />
                                <span>Low &le; {item.minAlertQty}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">&ge; {item.minAlertQty} {item.unit}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            {formatExactRate(item.costPerUnit)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                            {formatCurrency(itemValuation)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleAdjustAccessoryQty(item.id, -100)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs cursor-pointer"
                                title="Deduct 100"
                              >
                                -100
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustAccessoryQty(item.id, 100)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs cursor-pointer"
                                title="Add 100"
                              >
                                +100
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustAccessoryQty(item.id, 500)}
                                className="px-1.5 h-6 rounded bg-blue-50 hover:bg-blue-100 font-bold text-blue-700 flex items-center justify-center text-[10px] cursor-pointer"
                                title="Add 500"
                              >
                                +500
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAccessory(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Edit"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccessory(item.id, item.name)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          EDIT STOCK & RATIO SETS MODAL (GARMENTS)
          ═══════════════════════════════════════════ */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Update Stock: {editingItem.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Adjust ratio sets per color, loose mix pieces, and costing rate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metrics: Costing & Mix Pcs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Costing Rate per PC (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 420"
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Used to calculate total inventory stock valuation and sold unit profits.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Mix Pcs (Loose / Single Pieces)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editMixPcs}
                  onChange={(e) => setEditMixPcs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Individual extra trousers not packed in sets.
                </span>
              </div>
            </div>

            {/* Multi-Ratio Sets per Color Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                  Colorwise Ratio Sets
                </label>
                <span className="text-[11px] text-slate-500 font-semibold">
                  e.g. 30 to 38: 5 sets, 32 to 38: 1 set
                </span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {editingItem.colors.map((color) => {
                  const clean = cleanColorName(color);
                  const ratios = editColorRatios[clean] || {};
                  const hex = getColorHex(color).hex;

                  return (
                    <div
                      key={color}
                      className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="font-bold text-slate-900 text-xs">{color}</span>
                        </div>

                        {/* Add ratio packs */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {editingItem.sizesRatio && (
                            <button
                              type="button"
                              onClick={() => handleAddRatioToColor(clean, editingItem.sizesRatio)}
                              className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md"
                            >
                              + {editingItem.sizesRatio} (Primary)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "38 to 40")}
                            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md"
                            title="2 Size Set Ratio (2 pcs: 38, 40)"
                          >
                            + 38 to 40 (2 pcs)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "28 to 36")}
                            className="text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md"
                          >
                            + 28 to 36
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "30 to 38")}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded-md"
                          >
                            + 30 to 38
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "28 to 40")}
                            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md"
                            title="7 Size Set Ratio (7 pcs: 28 to 40)"
                          >
                            + 28 to 40 (7 pcs)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "28 to 42")}
                            className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md"
                            title="8 Size Set Ratio (8 pcs: 28 to 42)"
                          >
                            + 28 to 42 (8 pcs)
                          </button>
                        </div>
                      </div>

                      {/* Custom Ratio Add for this color */}
                      <div className="flex items-center gap-2 pt-1 pb-1">
                        <input
                          type="text"
                          placeholder="Or Custom Ratio: e.g. 26 to 40, 38 to 40"
                          value={modalCustomRatio}
                          onChange={(e) => setModalCustomRatio(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && modalCustomRatio.trim()) {
                              e.preventDefault();
                              handleAddRatioToColor(clean, modalCustomRatio.trim());
                              setModalCustomRatio("");
                            }
                          }}
                          className="flex-1 px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (modalCustomRatio.trim()) {
                              handleAddRatioToColor(clean, modalCustomRatio.trim());
                              setModalCustomRatio("");
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-semibold rounded-lg transition shrink-0"
                        >
                          + Add Ratio
                        </button>
                      </div>

                      {/* Ratios list for this color */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(ratios).map(([rKey, rCount]) => (
                          <div
                            key={rKey}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200"
                          >
                            <span className="text-xs font-mono font-semibold text-slate-700">
                              {rKey}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleRatioCountChange(clean, rKey, Math.max(0, rCount - 1))
                                }
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={rCount}
                                onChange={(e) =>
                                  handleRatioCountChange(
                                    clean,
                                    rKey,
                                    Math.max(0, parseInt(e.target.value, 10) || 0)
                                  )
                                }
                                className="w-12 text-center py-0.5 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleRatioCountChange(clean, rKey, rCount + 1)
                                }
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRatioFromColor(clean, rKey)}
                                className="text-red-400 hover:text-red-600 ml-1"
                                title="Remove this ratio"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveStockEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Save size={13} />
                <span>{savingEdit ? "Saving Stock..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          ADD / EDIT TRIM OR ACCESSORY MODAL
          ═══════════════════════════════════════════ */}
      {isAddAccessoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingAccessory ? "Edit Trim / Accessory" : "Add Trim or Accessory"}
                </h3>
                <p className="text-xs text-slate-500">
                  Track buttons, hangtags, size & flag labels, zippers, and pocketing materials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAccessoryOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAccessory} className="space-y-4">
              {/* Photo Upload & Preview */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Trim Photo
                </label>
                <div className="flex items-center gap-3">
                  {accessoryForm.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-xl border border-slate-300 overflow-hidden bg-slate-100 shrink-0 shadow-2xs group">
                      <img src={accessoryForm.imageUrl} alt="Trim Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAccessoryForm({ ...accessoryForm, imageUrl: "" })}
                        className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-bl-lg hover:bg-red-700 transition cursor-pointer"
                        title="Remove photo"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 flex flex-col items-center justify-center cursor-pointer transition text-slate-400 hover:text-blue-600 shrink-0">
                      {uploadingImage ? (
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                      ) : (
                        <>
                          <Upload size={18} />
                          <span className="text-[9px] font-bold mt-0.5">Upload</span>
                        </>
                      )}
                      <input type="file" accept="image/*" disabled={uploadingImage} onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                  <div className="text-xs text-slate-500">
                    {uploadingImage ? (
                      <span className="text-blue-600 font-bold flex items-center gap-1">
                        <Loader2 size={13} className="animate-spin" /> Uploading image...
                      </span>
                    ) : (
                      <>
                        <span className="font-medium text-slate-700 block">Photo of Button, Tag, or Trim Piece</span>
                        <span className="text-[11px] text-slate-400">JPG, PNG, or WEBP (Max 10MB)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IQ Shank Button 24L, Trouser Hangtag, Woven Size Label, ID"
                  value={accessoryForm.name}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              {/* Category / Type Selector & Management */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Type / Category *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsManagingTypes(!isManagingTypes)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        {isManagingTypes ? "Done" : "+ Add / Manage Types"}
                      </button>
                    </div>
                    <select
                      value={accessoryForm.category}
                      onChange={(e) => {
                        if (e.target.value === "__NEW__") {
                          setIsManagingTypes(true);
                          setIsAddingType(true);
                        } else {
                          setAccessoryForm({ ...accessoryForm, category: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      {accessoryTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value="__NEW__">+ Add New Type...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Unit (e.g. Pcs, Meters)
                    </label>
                    <input
                      type="text"
                      value={accessoryForm.unit}
                      onChange={(e) => setAccessoryForm({ ...accessoryForm, unit: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>
                </div>

                {/* Manage / Add Types Drawer inside Modal */}
                {isManagingTypes && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                        Manage Trim Types (Button, Tag, ID, etc.)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsManagingTypes(false)}
                        className="text-[11px] text-blue-600 font-bold hover:underline"
                      >
                        Close
                      </button>
                    </div>

                    {/* Inline Add Type Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Type name (e.g. ID, Rivet, Patch)..."
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAccessoryType();
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAccessoryType()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        + Add Type
                      </button>
                    </div>

                    {/* List of existing types with delete */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-blue-200">
                      {accessoryTypes.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-white text-slate-800 border border-blue-200 shadow-2xs"
                        >
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAccessoryType(t)}
                            className="text-slate-400 hover:text-red-600 transition cursor-pointer p-0.5 rounded hover:bg-red-50"
                            title={`Delete type "${t}"`}
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={accessoryForm.quantity}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Min Alert Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={accessoryForm.minAlertQty}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, minAlertQty: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Cost / Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={accessoryForm.costPerUnit}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, costPerUnit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Notes / Supplier Specs (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sourced from TrimEx Mumbai, metallic antique brass finish"
                  value={accessoryForm.notes}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddAccessoryOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccessory}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <Save size={13} />
                  <span>{savingAccessory ? "Saving..." : editingAccessory ? "Update Trim" : "Add to Stock"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          ADMIN DAMAGE CASH SALE MODAL
          ═══════════════════════════════════════════ */}
      {isDamageSaleOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Sell Damage Pieces (Cash Only)
                  </h3>
                  <span className="text-[11px] text-amber-700 font-bold">
                    Admin Exclusive • Instant Cash Transaction
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDamageSaleOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDamageCashSale} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  1. Product Style *
                </label>
                <select
                  value={damageSaleProduct?.id || ""}
                  onChange={(e) => {
                    const selected = stockItems.find((p) => p.id === parseInt(e.target.value, 10));
                    setDamageSaleProduct(selected || null);
                    if (selected?.damageStock) {
                      try {
                        const parsed = JSON.parse(selected.damageStock);
                        const cols = Object.keys(parsed).filter((c) => (parsed[c]?.pcs || 0) > 0);
                        setDamageSaleColor(cols[0] || "");
                      } catch {
                        setDamageSaleColor("");
                      }
                    } else {
                      setDamageSaleColor("");
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- Select Product --</option>
                  {stockItems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.totalDamagePcs ? `(${p.totalDamagePcs} damage pcs available)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color & Available Damage Breakdown */}
              {damageSaleProduct && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    2. Damaged Color Shade *
                  </label>
                  {(() => {
                    let damageOptions: Array<{ color: string; pcs: number; reason: string }> = [];
                    if (damageSaleProduct.damageStock) {
                      try {
                        const parsed = JSON.parse(damageSaleProduct.damageStock);
                        for (const [col, info] of Object.entries(parsed)) {
                          const pcs = Number((info as any)?.pcs) || 0;
                          if (pcs > 0) {
                            damageOptions.push({
                              color: col,
                              pcs,
                              reason: (info as any)?.reason || "Damage",
                            });
                          }
                        }
                      } catch {}
                    }

                    if (damageOptions.length === 0) {
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
                          No damaged pieces recorded for this product yet. You can add them in <strong>Edit Product</strong>.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        <select
                          value={damageSaleColor}
                          onChange={(e) => setDamageSaleColor(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                          <option value="">-- Select Color --</option>
                          {damageOptions.map((opt) => (
                            <option key={opt.color} value={opt.color}>
                              {opt.color} — {opt.pcs} pcs ({opt.reason})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Pieces & Cash Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    3. Pieces to Sell *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 10 or 100"
                    value={damageSalePcs}
                    onChange={(e) => setDamageSalePcs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    4. Cash Rate (₹/Piece) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      placeholder="e.g. 250"
                      value={damageSaleRate}
                      onChange={(e) => setDamageSaleRate(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Total Calculation */}
              {parseInt(damageSalePcs, 10) > 0 && parseFloat(damageSaleRate) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase">
                    Total Cash Received:
                  </span>
                  <span className="text-lg font-black font-mono text-amber-950">
                    ₹{(parseInt(damageSalePcs, 10) * parseFloat(damageSaleRate)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Buyer & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Buyer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Local Scrap / Cash Buyer"
                    value={damageSaleBuyer}
                    onChange={(e) => setDamageSaleBuyer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full color clearance"
                    value={damageSaleNotes}
                    onChange={(e) => setDamageSaleNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDamageSaleOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sellingDamage}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <DollarSign size={13} />
                  <span>{sellingDamage ? "Recording..." : "Confirm Cash Sale & Deduct"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TRIM PHOTO VIEWER MODAL
          ═══════════════════════════════════════════ */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 animate-in fade-in duration-150 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900 truncate">
                {viewingImage.title}
              </span>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="w-full max-h-[70vh] flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="w-full h-auto max-h-[68vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
