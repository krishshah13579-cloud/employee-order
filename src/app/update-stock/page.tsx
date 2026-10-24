"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Camera,
  Image as ImageIcon,
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
} from "@/lib/stock";
import { STANDARD_SIZE_RATIOS } from "@/lib/types";

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
  const { employee, loading: sessionLoading, refreshSession } = useEmployee();
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
  const [modalImageUrl, setModalImageUrl] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Strict authorization check: Only allowed if explicitly granted or super admin
  const isAuthorized = Boolean(
    employee?.canUpdateStock === true ||
    (employee?.id === 0 && (employee?.designation === "Administrator" || employee?.designation?.includes("Admin")))
  );

  const fetchStockProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stock", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        toast("Access Revoked: You do not have permission to update stock.", "error");
        router.replace("/");
        return;
      }
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
  }, [router, toast]);

  // Periodic real-time check against DB: Revoke right away if admin removed access
  useEffect(() => {
    let active = true;

    const verifyFreshAccess = async () => {
      try {
        const res = await fetch("/api/employee/auth/check", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const hasAccess = Boolean(
            data.authenticated &&
            (data.isAdmin || data.employee?.canUpdateStock === true)
          );
          if (!hasAccess && active) {
            toast("Access Revoked: Stock update permission removed by administrator.", "error");
            router.replace("/");
            return false;
          }
        }
      } catch {}
      return true;
    };

    if (!sessionLoading) {
      if (!isAuthorized) {
        toast("Access Denied: You do not have permission to update stock.", "error");
        router.replace("/");
        return;
      }
      fetchStockProducts();
    }

    // Verify continuously every 10 seconds to revoke right away
    const interval = setInterval(verifyFreshAccess, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionLoading, isAuthorized, fetchStockProducts, router, toast]);

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
    setModalImageUrl(p.imageUrl || "");

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload photo");
      }

      const data = await res.json();
      setModalImageUrl(data.url);
      toast("Product photo uploaded! Click Save Stock Changes to apply.", "success");
    } catch (err: any) {
      toast("Photo upload failed: " + err.message, "error");
    } finally {
      setUploadingPhoto(false);
    }
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
          imageUrl: modalImageUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stock");
      }

      toast(`✅ Successfully updated stock & photo for ${editingProduct.name} (${modalTotalSets} Sets · ${modalTotalPcs} Pcs)!`, "success");
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
                Update live sets, size ratios, garment photos, and inventory piece counts across all styles.
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
            CATEGORY TABS & SEARCH BAR
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
            PRODUCT CARDS GRID (100% UNIFORM BOX SIZES AS SHOWN IN PICTURE)
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
            {filteredProducts.map((p) => {
              const inStock = p.totalSets > 0 || p.mixPcs > 0;
              const displayMrp = p.mrp || Math.round((p.retailerPrice || p.price) * 2);
              const coverImg = getProductCoverImage(p.imageUrl);

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col h-full group"
                >
                  {/* Photo Container with Uniform Fixed Height */}
                  <div className="relative w-full h-72 bg-slate-100 overflow-hidden block shrink-0">
                    <img
                      src={coverImg}
                      alt={p.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><path d='M160 120 L240 120 L225 280 L205 280 L200 190 L195 280 L175 280 Z' fill='%23cbd5e1' stroke='%2394a3b8' stroke-width='2'/><text x='50%25' y='78%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' font-weight='600' fill='%2364748b'>Garment Photo</text></svg>";
                      }}
                    />

                    {/* Category Badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2.5 py-1 rounded-md bg-zinc-900/90 text-white font-black text-[10px] tracking-wider uppercase backdrop-blur-xs shadow-xs">
                        {p.category || "Trouser"}
                      </span>
                    </div>

                    {/* Stock Count Badge */}
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

                  {/* Card Content with Uniform Dimensions */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3 min-h-[160px]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-black text-slate-900 tracking-tight truncate flex-1" title={p.name}>
                          {p.name}
                        </h3>
                        <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                          {p.pcsPerSet || 5} Pcs / Set
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                        <span>Sizes: <strong className="text-slate-800">{p.sizesRatio || "30 to 38"}</strong></span>
                        <span className="font-mono text-slate-700 font-bold">{p.totalPcs} total pcs</span>
                      </div>

                      {/* Color Swatch Dots */}
                      <div className="flex items-center gap-1.5 mt-2.5 min-h-[18px]">
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
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer active:scale-95 shrink-0"
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
          STOCK & PHOTO UPDATE MODAL
          ═══════════════════════════════════════════ */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                  <Boxes size={22} />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 uppercase tracking-wider">
                    {editingProduct.category || "Trouser"}
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Update Stock &amp; Photo — {editingProduct.name}
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
              {/* 1. Product Photo Update Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-24 h-28 rounded-xl bg-slate-200 border border-slate-300 overflow-hidden shrink-0 shadow-2xs">
                  <img
                    src={getProductCoverImage(modalImageUrl)}
                    alt={editingProduct.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0'><rect width='100' height='100'/></svg>";
                    }}
                  />
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Product Photo
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Update or replace this garment photo directly. Supports JPG, PNG, WEBP.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs">
                      <Camera size={14} className="text-orange-600" />
                      <span>{uploadingPhoto ? "Uploading..." : "Upload New Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingPhoto}
                        onChange={handlePhotoUpload}
                      />
                    </label>

                    {modalImageUrl && (
                      <button
                        type="button"
                        onClick={() => setModalImageUrl("")}
                        className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Size Ratio Pack Selector */}
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

              {/* 3. Color-Wise Sets Stepper Grid */}
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
                      onClick={() => handleQuickAddAll(20)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      +20 All
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(modalColorSets).map(([color, count]) => {
                    const hex = getColorHex(color).hex;
                    const pcsThisColor = count * modalPcsPerSet;

                    return (
                      <div
                        key={color}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-2xs"
                            style={{ backgroundColor: hex }}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {color}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono font-medium block">
                              {pcsThisColor} Pcs ({modalRatio})
                            </span>
                          </div>
                        </div>

                        {/* Interactive Stepper */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleColorCountChange(color, count - 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm transition cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={count}
                            onChange={(e) =>
                              handleColorCountChange(
                                color,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-14 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => handleColorCountChange(color, count + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm transition cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Cost Price Input (Optional) */}
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

              {/* 5. Live Stock Summary Pill */}
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
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Stock &amp; Photo</span>
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
