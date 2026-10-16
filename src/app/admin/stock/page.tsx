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

interface StockMetrics {
  totalStyles: number;
  activeInStock: number;
  grandTotalSets: number;
  grandTotalMixPcs: number;
  grandTotalPcs: number;
  grandTotalValuation: number;
}

export default function AdminStockPage() {
  const { toast } = useToast();
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

  useEffect(() => {
    fetchStock();
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

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setEditMixPcs(item.mixPcs || 0);
    setEditCostPrice(item.costPrice !== null && item.costPrice !== undefined ? String(item.costPrice) : "");
    const initialRatios = item.detailedRatioSets ? JSON.parse(JSON.stringify(item.detailedRatioSets)) : {};
    // Ensure all colors have at least one ratio entry
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

  return (
    <div className="space-y-6">
          {/* Top Header & Breadcrumbs */}
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
                Monitor available sets per color, loose mix pieces, garment costing, and total valuation.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchStock}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh Stock</span>
            </button>
          </div>

          {/* ═══════════════════════════════════════════
              METRIC KPI CARDS
              ═══════════════════════════════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Package size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Styles
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {metrics?.totalStyles ?? 0}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Boxes size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Sets
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {metrics?.grandTotalSets ?? 0}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Pieces (Sets + Mix)
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {metrics?.grandTotalPcs ?? 0}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <DollarSign size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Inventory Valuation
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                  {formatCurrency(metrics?.grandTotalValuation ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              FILTER & SEARCH TOOLBAR
              ═══════════════════════════════════════════ */}
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

          {/* ═══════════════════════════════════════════
              STOCK TABLE
              Columns: Product Name, Colors, Set, Mix Pcs, Costing, Total Price
              ═══════════════════════════════════════════ */}
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

                              {/* Multi-ratio tags if present */}
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

      {/* ═══════════════════════════════════════════
          EDIT STOCK & RATIO SETS MODAL
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
                  Used to calculate total inventory stock valuation.
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

                        {/* Add another ratio dropdown */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "30 to 38")}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded-md"
                          >
                            + 30 to 38
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "32 to 38")}
                            className="text-[10px] font-bold text-purple-600 hover:text-purple-800 bg-white border border-purple-200 px-2 py-0.5 rounded-md"
                          >
                            + 32 to 38
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddRatioToColor(clean, "28 to 36")}
                            className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md"
                          >
                            + 28 to 36
                          </button>
                        </div>
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
    </div>
  );
}
