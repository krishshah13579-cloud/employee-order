"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Search,
  Package,
  Layers,
  Edit,
  Save,
  X,
  Check,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  Scissors,
  DollarSign,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, getProductCoverImage, sortProductsByImpSequence } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  cleanColorName,
  getPcsFromRatio,
  getSizesFromRatio,
  sortSizeRatioKeys,
  calculateOrderedColorSetsPieces,
} from "@/lib/stock";
import { STANDARD_SIZE_RATIOS, type ProductData } from "@/lib/types";

interface StockProduct {
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
  setsColorwise?: string | null;
  detailedRatioSets?: Record<string, Record<string, number>>;
  isActive: boolean;
}

export default function UpdateStockPage() {
  const router = useRouter();
  const { employee, loading: sessionLoading } = useEmployee();
  const { toast } = useToast();

  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Edit Stock Modal State
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [modalRatio, setModalRatio] = useState<string>("30 to 38");
  const [modalColorSets, setModalColorSets] = useState<Record<string, number>>({});
  const [modalCostPrice, setModalCostPrice] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const isAuthorized = Boolean(
    employee?.canUpdateStock ||
    employee?.isTeamLeader ||
    employee?.designation === "Administrator" ||
    employee?.id === 0
  );

  const fetchStockProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stock", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load stock data (${res.status})`);
      }
      const data = await res.json();
      setProducts(data.stockItems || []);
    } catch (err: any) {
      toast("Error loading stock: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (employee && !isAuthorized) {
        toast("Access Denied: You do not have permission to update stock.", "error");
        router.replace("/");
        return;
      }
      fetchStockProducts();
    }
  }, [sessionLoading, employee, isAuthorized]);

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim().toUpperCase());
      }
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const matchCat =
        selectedCategory === "All" ||
        p.category.toUpperCase() === selectedCategory.toUpperCase();
      const term = search.toLowerCase().trim();
      const matchSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.colorsAvailable && p.colorsAvailable.toLowerCase().includes(term)) ||
        (p.sizesRatio && p.sizesRatio.toLowerCase().includes(term));
      return matchCat && matchSearch;
    });
    return sortProductsByImpSequence(list);
  }, [products, selectedCategory, search]);

  const handleOpenEdit = (p: StockProduct) => {
    setEditingProduct(p);
    setModalRatio(p.sizesRatio || "30 to 38");
    setModalCostPrice(p.costPrice !== null && p.costPrice !== undefined ? String(p.costPrice) : "");

    // Pre-populate color sets from detailedRatioSets or setsColorwise
    const colorCounts: Record<string, number> = {};
    const primaryRatio = p.sizesRatio || "30 to 38";

    if (p.detailedRatioSets) {
      for (const [col, rMap] of Object.entries(p.detailedRatioSets)) {
        const clean = cleanColorName(col);
        const count = rMap[primaryRatio] !== undefined ? rMap[primaryRatio] : Object.values(rMap).reduce((a, b) => a + b, 0);
        colorCounts[clean] = count || 0;
      }
    }

    // Ensure all product colors have an entry
    p.colors.forEach((col) => {
      const clean = cleanColorName(col);
      if (colorCounts[clean] === undefined) {
        colorCounts[clean] = 0;
      }
    });

    setModalColorSets(colorCounts);
  };

  const handleColorCountChange = (color: string, val: number) => {
    setModalColorSets((prev) => ({
      ...prev,
      [color]: Math.max(0, val),
    }));
  };

  const handleQuickAddAll = (delta: number) => {
    setModalColorSets((prev) => {
      const next: Record<string, number> = {};
      for (const [col, count] of Object.entries(prev)) {
        next[col] = Math.max(0, count + delta);
      }
      return next;
    });
  };

  const handleResetAll = () => {
    setModalColorSets((prev) => {
      const next: Record<string, number> = {};
      for (const col of Object.keys(prev)) {
        next[col] = 0;
      }
      return next;
    });
  };

  const modalPcsPerSet = useMemo(() => {
    const rSizes = getSizesFromRatio(modalRatio);
    return rSizes.length > 0 && rSizes[0] !== modalRatio ? rSizes.length : 5;
  }, [modalRatio]);

  const modalTotalSets = useMemo(() => {
    return Object.values(modalColorSets).reduce((a, b) => a + (Number(b) || 0), 0);
  }, [modalColorSets]);

  const modalTotalPcs = useMemo(() => {
    return modalTotalSets * modalPcsPerSet;
  }, [modalTotalSets, modalPcsPerSet]);

  const handleSaveStock = async () => {
    if (!editingProduct) return;
    try {
      setSaving(true);

      // Structure setsColorwise JSON mapping
      const nextStockMap: Record<string, { ratios: Record<string, number>; loosePcs: Record<string, number> }> = {};
      for (const [col, count] of Object.entries(modalColorSets)) {
        const clean = cleanColorName(col);
        nextStockMap[clean] = {
          ratios: {
            [modalRatio]: count,
          },
          loosePcs: {},
        };
      }

      const res = await fetch("/api/admin/stock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          sizesRatio: modalRatio,
          costPrice: modalCostPrice ? parseFloat(modalCostPrice) || null : null,
          setsColorwise: JSON.stringify(nextStockMap),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stock");
      }

      toast(`✅ Successfully updated stock for ${editingProduct.name} (${modalTotalSets} Sets · ${modalTotalPcs} Pcs)!`, "success");
      setEditingProduct(null);
      fetchStockProducts();
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
        <span className="text-xs font-bold text-slate-400">Verifying session permissions...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500">
            You do not have permission to update stock. Please contact the Administrator to request stock update access.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition hover:bg-slate-800"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ═══════════════════════════════════════════
          HEADER BANNER (MATCHING STOREFRONT STYLE)
          ═══════════════════════════════════════════ */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Link href="/" className="hover:text-white transition">
                  Home
                </Link>
                <span>/</span>
                <span className="text-orange-400 font-bold">Stock Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Boxes className="text-orange-500" />
                <span>Stock Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Update live sets, size ratios, and inventory piece counts across all catalog styles.
              </p>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                <Package size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Total Products
                </span>
                <span className="text-lg font-black text-white font-mono">
                  {products.length} Styles
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ═══════════════════════════════════════════
            CATEGORY TABS & SEARCH BAR (MATCHING 2ND PHOTO)
            ═══════════════════════════════════════════ */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const isSelected = selectedCategory.toUpperCase() === cat.toUpperCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search products by style name, color, sizes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition shadow-2xs"
              />
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{filteredProducts.length}</strong> available trouser style(s)
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            PRODUCT CARDS GRID (MATCHING 2ND PHOTO)
            ═══════════════════════════════════════════ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-xs text-slate-500 font-bold">Loading inventory styles...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Package size={22} />
            </div>
            <h3 className="text-base font-black text-slate-800">No matching products found</h3>
            <p className="text-xs text-slate-500">
              Try adjusting your search terms or selecting a different category tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const inStock = p.totalSets > 0 || p.mixPcs > 0;
              const displayMrp = p.mrp || Math.round((p.retailerPrice || p.price) * 2);

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                >
                  {/* Photo Container with Category Badge */}
                  <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                    <img
                      src={getProductCoverImage(p.imageUrl)}
                      alt={p.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2.5 py-1 rounded-md bg-zinc-900/90 text-white font-black text-[10px] tracking-wider uppercase backdrop-blur-xs">
                        {p.category || "Trouser"}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs ${
                          inStock
                            ? "bg-emerald-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {inStock ? `${p.totalSets} Sets In Stock` : "Sold Out"}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                          {p.name}
                        </h3>
                        <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {p.pcsPerSet || 5} Pcs / Set
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                        <span>Sizes: <strong className="text-slate-800">{p.sizesRatio || "30 to 38"}</strong></span>
                        <span className="font-mono text-slate-600 font-semibold">{p.totalPcs} total pcs</span>
                      </div>

                      {/* Color Swatch Dots */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {p.colors.slice(0, 7).map((col, cIdx) => {
                          const hex = getColorHex(col).hex;
                          return (
                            <span
                              key={cIdx}
                              title={col}
                              className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                          );
                        })}
                        {p.colors.length > 7 && (
                          <span className="text-[10px] font-bold text-slate-400">
                            +{p.colors.length - 7}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pricing & Update Stock Action Button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Rate per PC
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-bold text-slate-400 line-through font-mono">
                            ₹{displayMrp}
                          </span>
                          <span className="text-base font-black text-slate-900 font-mono">
                            ₹{p.retailerPrice || p.price}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0"
                      >
                        <Edit size={13} />
                        <span>Update Stock</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════
          PRETTY STOCK UPDATE MODAL (MANDATORY FIELDS)
          ═══════════════════════════════════════════ */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={getProductCoverImage(editingProduct.imageUrl)}
                  alt={editingProduct.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0"
                />
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 uppercase tracking-wider">
                    {editingProduct.category || "Trouser"}
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Update Stock — {editingProduct.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 1. Size Ratio Pack Selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Scissors size={14} className="text-blue-600" />
                    <span>Select Size Ratio / Pack:</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                    1 Set = {modalPcsPerSet} Pcs [{getSizesFromRatio(modalRatio).join(", ")}]
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {STANDARD_SIZE_RATIOS.map((item) => {
                    const ratioKey = item.value;
                    const isSelected = modalRatio === ratioKey;
                    const pcs = item.pcs || getPcsFromRatio(ratioKey);
                    return (
                      <button
                        key={ratioKey}
                        type="button"
                        onClick={() => setModalRatio(ratioKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white hover:bg-blue-50/60 text-slate-700 border-slate-200"
                        }`}
                      >
                        <span>{ratioKey}</span>
                        <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          ({pcs} pcs)
                        </span>
                        {isSelected && <Check size={12} className="text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Color-Wise Sets Stepper Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Color-Wise Stock Sets:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAddAll(5)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      +5 All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddAll(10)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      +10 All
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {editingProduct.colors.map((color) => {
                    const clean = cleanColorName(color);
                    const cHex = getColorHex(color);
                    const count = modalColorSets[clean] || 0;

                    return (
                      <div
                        key={color}
                        className={`flex items-center justify-between p-3 rounded-xl border transition ${
                          count > 0
                            ? "bg-blue-50/40 border-blue-200 shadow-2xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className="w-5 h-5 rounded-full border border-black/15 shrink-0 shadow-2xs"
                            style={{ backgroundColor: cHex.hex }}
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 truncate" title={color}>
                              {color}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {count * modalPcsPerSet} pcs
                            </div>
                          </div>
                        </div>

                        {/* Stepper with - / input / + */}
                        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs shrink-0">
                          <button
                            type="button"
                            onClick={() => handleColorCountChange(clean, count - 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-black font-black text-xs transition cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={count === 0 ? "" : count}
                            placeholder="0"
                            onChange={(e) =>
                              handleColorCountChange(clean, parseInt(e.target.value, 10) || 0)
                            }
                            className="w-12 h-8 border-x border-slate-300 text-center text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-blue-50/50"
                          />
                          <button
                            type="button"
                            onClick={() => handleColorCountChange(clean, count + 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-black font-black text-xs transition cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Cost Price Input (Optional) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Product Cost Price (Optional)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Used on Admin Stock tab to calculate total valuation and profits
                  </span>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 450"
                    value={modalCostPrice}
                    onChange={(e) => setModalCostPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 border border-slate-300 bg-white rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* 4. Live Stock Summary Pill */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                    Total Inventory Summary
                  </span>
                  <span className="text-lg font-black text-emerald-950 font-mono">
                    {modalTotalSets} Sets ({modalTotalPcs} Pcs)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                    Estimated Stock Value
                  </span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatCurrency(modalTotalPcs * (editingProduct.retailerPrice || editingProduct.price))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveStock}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving Stock...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Stock Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
