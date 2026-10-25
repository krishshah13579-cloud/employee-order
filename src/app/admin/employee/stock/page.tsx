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
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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
    quantity: "1000",
    unit: "Pcs",
    minAlertQty: "200",
    costPerUnit: "1.00",
    notes: "",
  });

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
      category: "Buttons",
      quantity: "1000",
      unit: "Pcs",
      minAlertQty: "200",
      costPerUnit: "1.00",
      notes: "",
    });
    setIsAddAccessoryOpen(true);
  };

  const handleOpenEditAccessory = (item: AccessoryItemData) => {
    setEditingAccessory(item);
    setAccessoryForm({
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit,
      minAlertQty: String(item.minAlertQty),
      costPerUnit: String(item.costPerUnit),
      notes: item.notes || "",
    });
    setIsAddAccessoryOpen(true);
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
          5 METRIC KPI CARDS (CLEAN & SUBTLE PHOTO 3 STYLING)
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Total Styles */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
            <Package size={22} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Total Styles
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {metrics?.totalStyles ?? 0}
            </span>
          </div>
        </div>

        {/* 2. Total Sets */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
            <Boxes size={22} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Total Sets
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {metrics?.grandTotalSets ?? 0}
            </span>
          </div>
        </div>

        {/* 3. Total Pieces */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-xs">
            <Layers size={22} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Total Pieces
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {metrics?.grandTotalPcs ?? 0}
            </span>
          </div>
        </div>

        {/* 4. Inventory Valuation */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Valuation
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-700 font-mono tracking-tight">
              {formatCurrency(metrics?.grandTotalValuation ?? 0)}
            </span>
          </div>
        </div>

        {/* 5. Sold Units Profit Card (Beside Inventory Valuation -> Links to /admin/employee/profit) */}
        <Link
          href="/admin/employee/profit"
          className="bg-white p-5 rounded-3xl border border-emerald-200/90 shadow-xs flex items-center gap-4 cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block truncate">
                Sold Profit
              </span>
              <ArrowUpRight size={13} className="text-emerald-600 shrink-0" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight block">
              {formatCurrency(metrics?.grandTotalSoldProfit ?? 0)}
            </span>
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-0.5 border border-emerald-100">
              +{metrics?.overallMarginPercent ?? 0}% (Bill 1–{metrics?.billProfitBreakdown?.length || 39})
            </span>
          </div>
        </Link>
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
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-700">
                                    {item.category}
                                  </span>
                                  {item.mrp && (
                                    <span className="line-through text-slate-400 font-mono text-[10px]">
                                      MRP {formatCurrency(item.mrp)}
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
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Edit size={12} />
                              <span>Edit Stock</span>
                            </button>
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
                {ACCESSORY_CATEGORIES.map((cat) => (
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
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-300" />
                        <span>Loading accessories stock...</span>
                      </td>
                    </tr>
                  ) : filteredAccessories.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
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
                            {formatCurrency(item.costPerUnit)}
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
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IQ Shank Button 24L, Trouser Hangtag, Woven Size Label"
                  value={accessoryForm.name}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={accessoryForm.category}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="Buttons">Buttons</option>
                    <option value="Tags">Tags</option>
                    <option value="Size Label">Size Label</option>
                    <option value="Flag Label">Flag Label</option>
                    <option value="Zippers">Zippers</option>
                    <option value="Pocketing">Pocketing</option>
                    <option value="Care Label">Care Label</option>
                    <option value="Others">Others</option>
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
    </div>
  );
}
