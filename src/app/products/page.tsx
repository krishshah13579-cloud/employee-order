"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Layers,
  ArrowRight,
  Shirt,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  ShoppingBag,
  ArrowLeft,
  Check,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { formatCurrency, getProductCoverImage, isGstPanRegistered, sortProductsByImpSequence } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  getTotalAvailableSets,
  parseColorwiseSets,
  getAllProductColors,
  getAvailableSetsForColor,
  sortSizeRatioKeys,
  parseDetailedColorRatioSets,
  getPcsFromRatio,
  getProductMixSizesInfo,
  isColorSoldOut,
} from "@/lib/stock";
import type { ProductData } from "@/lib/types";
import { sanitizeInternalReturnTo, PARAM_RETURN_TO, APP_ROUTES } from "@/lib/navigation";

const DEFAULT_STORE_CATEGORIES = [
  "All",
  "EVERYDAY CASUAL",
  "FORMAL WEAR",
  "LINEN",
];

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const rawReturnTo = searchParams.get(PARAM_RETURN_TO);
  const defaultReturnTo = orderId ? `/admin/orders/${orderId}` : APP_ROUTES.ORDERS_NEW;
  const returnTo = sanitizeInternalReturnTo(rawReturnTo, defaultReturnTo);

  const getProductDetailUrl = (pId: number) => {
    const q = new URLSearchParams();
    if (orderId) q.set("orderId", orderId);
    if (returnTo) q.set("returnTo", returnTo);
    const qStr = q.toString();
    return `/products/${pId}${qStr ? `?${qStr}` : ""}`;
  };

  const [products, setProducts] = useState<ProductData[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_STORE_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active draft info
  const [draftInfo, setDraftInfo] = useState<{
    customerName?: string;
    customerGstPan?: string;
    businessType?: string;
    specialDiscount?: number;
    itemsCount: number;
  } | null>(null);

  // Load active draft from localStorage
  useEffect(() => {
    const loadDraft = () => {
      try {
        const raw = localStorage.getItem("garmentpro_order_draft");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.customer || (parsed.items && parsed.items.length > 0))) {
            setDraftInfo({
              customerName: parsed.customer?.shopName || parsed.customerName,
              customerGstPan: parsed.customer?.gstPanNo,
              businessType: parsed.customer?.businessType || parsed.businessType,
              specialDiscount: parsed.customer?.specialDiscount || 0,
              itemsCount: parsed.items?.length || 0,
            });
            return;
          }
        }
        setDraftInfo(null);
      } catch {}
    };

    loadDraft();
    window.addEventListener("garmentpro_draft_updated", loadDraft);
    window.addEventListener("storage", loadDraft);
    return () => {
      window.removeEventListener("garmentpro_draft_updated", loadDraft);
      window.removeEventListener("storage", loadDraft);
    };
  }, []);

  // Fetch active products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/products?active_only=1", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load products (${res.status})`);
      }
      const data: ProductData[] = await res.json();
      setProducts(data);
    } catch (err: any) {
      console.error("Error loading products:", err);
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  useEffect(() => {
    fetchProducts();
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const names = data.map((c: any) => c.name);
            setCategories(["All", ...names]);
          }
        }
      } catch {}
    }
    loadCategories();
  }, []);

  // Filter products by category, search term, and automatically hide Out-of-Stock items
  const filteredProducts = useMemo(() => {
    const list = products.filter((product) => {
      // Auto-remove from customer view if Out of Stock (0 total sets and 0 mix pcs)
      if (product.setsColorwise && product.setsColorwise.trim() !== "") {
        const totalSets = getTotalAvailableSets(product.setsColorwise);
        const mixPcs = (product as any).mixPcs || 0;
        if (totalSets <= 0 && mixPcs <= 0) {
          return false; // Product is out of stock, hidden from customer view
        }
      }

      const matchesCategory =
        selectedCategory === "All" ||
        product.category.toLowerCase() === selectedCategory.toLowerCase();

      const term = searchQuery.toLowerCase().trim();
      const matchesSearch =
        term === "" ||
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        (product.colorsAvailable && product.colorsAvailable.toLowerCase().includes(term)) ||
        (product.sizesRatio && product.sizesRatio.toLowerCase().includes(term));

      return matchesCategory && matchesSearch;
    });

    // Strictly sort from IMP - 001 upwards in numerical sequence
    return sortProductsByImpSequence(list);
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 w-full max-w-full overflow-x-hidden">
      <UserHeader />

      {/* Top Banner / Breadcrumb */}
      <div className="bg-slate-900 text-white border-b border-slate-800 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Link href="/" className="hover:text-white transition">
                  Home
                </Link>
                <span>/</span>
                <span className="text-orange-400">Products Catalog</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                Product Catalog
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5 line-clamp-2">
                Select any product below to choose multiple colors and set quantities at once.
              </p>
            </div>

            {/* Active Order Draft Pill / Action */}
            {draftInfo && (
              <div className="bg-orange-500/15 border border-orange-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 w-full sm:w-auto">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                    Order In Progress
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {draftInfo.customerName || "Customer Selected"}
                  </div>
                  <div className="text-xs text-slate-300">
                    {draftInfo.itemsCount} product item(s) in draft
                  </div>
                </div>
                <Link
                  href={returnTo}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 shrink-0 self-stretch sm:self-auto text-center"
                >
                  <span>Return to Order Form</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adding to Order Notification Banner */}
      {orderId && (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-200" />
            <span>
              Adding Product / Mix Size to Order #{orderId}. Select any garment product below to configure sets &amp; mix pieces.
            </span>
          </div>
          <Link
            href={returnTo || `/admin/orders/${orderId}`}
            className="px-3 py-1 bg-black/25 hover:bg-black/40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Return to Order #{orderId}</span>
          </Link>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Unregistered Customer GST/PAN warning (skipped for Without GST customers) */}
        {draftInfo &&
          draftInfo.customerName &&
          !draftInfo.businessType?.toUpperCase().includes("WITHOUT GST") &&
          !draftInfo.businessType?.toUpperCase().includes("NO GST") &&
          !isGstPanRegistered(draftInfo.customerGstPan) && (
          <div className="p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={20} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-black text-sm uppercase">
                  Customer {draftInfo.customerName} is NOT GST/PAN registered
                </p>
                <p className="text-xs text-amber-800">
                  Adding products is locked. Please enter and save GST/PAN details in the Order Form before adding products.
                </p>
              </div>
            </div>
            <Link
              href={returnTo}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs shrink-0 text-center transition"
            >
              Go to Order Form →
            </Link>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchProducts}
              className="text-xs font-bold underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            CATEGORIES PILLS & SEARCH BAR
            ═══════════════════════════════════════════ */}
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-200 shadow-xs space-y-3 sm:space-y-4 max-w-full overflow-hidden">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? "bg-slate-900 text-orange-400 shadow-md ring-2 ring-slate-900"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search bar & summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by style, color, sizes..."
                className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              />
            </div>

            <div className="text-[11px] sm:text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span>{" "}
              available trouser style(s)
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            PRODUCTS GRID
            ═══════════════════════════════════════════ */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6 pb-28">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs animate-pulse space-y-3"
              >
                <div className="w-full aspect-[4/5] bg-slate-200 rounded-xl" />
                <div className="w-2/3 h-3.5 bg-slate-200 rounded" />
                <div className="w-1/2 h-3 bg-slate-200 rounded" />
                <div className="w-full h-8 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Shirt size={28} />
            </div>
            <h3 className="font-bold text-slate-800 text-base sm:text-lg">No Products Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              No products match category &quot;{selectedCategory}&quot;
              {searchQuery ? ` and query "${searchQuery}"` : ""}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6 pb-28">
            {filteredProducts.map((product) => {
              const coverImage = getProductCoverImage(product.imageUrl);
              const totalAvailableStock = getTotalAvailableSets(product.setsColorwise);
              const allColors = getAllProductColors(
                product.colorsAvailable,
                product.setsColorwise,
                product.colorMapping
              );
              // Show in-stock colors on employee panel (hide sold out colors)
              const colorList = allColors.filter((col) => {
                if (!product.setsColorwise || !product.setsColorwise.trim()) return true;
                return !isColorSoldOut(product.setsColorwise, col, product.colorMapping);
              });

              // Extract and sort ratios: 28 to 36 (5 pcs) FIRST, then 28 to 34 (4 pc set)
              const ratioSet = new Set<string>();
              if (product.sizesRatio) ratioSet.add(product.sizesRatio.trim());
              if (product.setsColorwise) {
                try {
                  const detailed = parseDetailedColorRatioSets(product.setsColorwise);
                  for (const rMap of Object.values(detailed)) {
                    for (const rKey of Object.keys(rMap)) {
                      if (rKey.trim()) ratioSet.add(rKey.trim());
                    }
                  }
                } catch {}
              }
              const sortedRatios = sortSizeRatioKeys(Array.from(ratioSet));
              const displayRatio = sortedRatios[0] || product.sizesRatio || "28 to 36";
              const displayPcs = getPcsFromRatio(displayRatio, product.pcsPerSet || 5);
              const mixInfo = getProductMixSizesInfo(product.setsColorwise, (product as any).mixPcs || 0);

              return (
                <Link
                  key={product.id}
                  href={getProductDetailUrl(product.id)}
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col group cursor-pointer focus:outline-none min-w-0"
                >
                  {/* Product Image Box */}
                  <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden block">
                    <img
                      src={coverImage}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='600' fill='%2394a3b8'>Garment Photo</text></svg>";
                      }}
                    />

                    {/* Category Badge */}
                    <span className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 bg-slate-950/80 backdrop-blur-md text-orange-400 text-[8px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-700/60 shadow-xs">
                      {product.category}
                    </span>
                  </div>

                  {/* Card Info Box (Clickable) */}
                  <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between bg-white min-w-0">
                    <div className="min-w-0">
                      {/* Product Name */}
                      <h3 className="font-black text-slate-900 text-xs sm:text-base group-hover:text-orange-600 transition-colors truncate">
                        {product.name}
                      </h3>

                      {/* Sizes Ratio */}
                      <div className="mt-1 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                        <span className="truncate">Sizes: {displayRatio}</span>
                        <span className="font-semibold text-slate-700 hidden sm:inline shrink-0">
                          {displayPcs} Pcs/Set
                        </span>
                      </div>

                      {/* Mix Sizes Available */}
                      <div className="mt-0.5 flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="text-slate-500 font-medium">Mix:</span>
                        {mixInfo.totalMixPcs > 0 ? (
                          <span
                            className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded text-[8px] sm:text-[10px] font-mono truncate max-w-[80px] sm:max-w-[170px]"
                            title={mixInfo.sizesSummary}
                          >
                            {mixInfo.totalMixPcs} Pcs
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[9px] sm:text-[11px]">0 pcs</span>
                        )}
                      </div>

                      {/* Colors Palette Preview */}
                      <div className="mt-1 sm:mt-1.5 flex items-center gap-1 flex-wrap">
                        {colorList.slice(0, 4).map((col, idx) => {
                          const hex = getColorHex(col).hex;
                          return (
                            <span
                              key={idx}
                              title={col}
                              className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-slate-300 shadow-2xs inline-block shrink-0"
                              style={{ backgroundColor: hex }}
                            />
                          );
                        })}
                        {colorList.length > 4 && (
                          <span className="text-[8px] sm:text-[9px] font-bold text-slate-500">
                            +{colorList.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="mt-2 pt-2 sm:mt-3 sm:pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 truncate">
                          Rate
                        </div>
                        {draftInfo?.customerName && (
                          <div
                            className={`text-[7px] sm:text-[8px] font-black uppercase px-1 py-0.2 rounded inline-block max-w-[80px] sm:max-w-none truncate ${
                              draftInfo.businessType === "WHOLESALER" || draftInfo.businessType === "WHOLESALER WITHOUT GST"
                                ? "bg-purple-100 text-purple-800"
                                : draftInfo.businessType === "RETAILER WITH SPECIAL DISCOUNT"
                                ? "bg-teal-100 text-teal-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {(() => {
                              const bt = (draftInfo.businessType || "").toUpperCase();
                              const isWho = bt.includes("WHOLESAL");
                              const spl = Number(draftInfo.specialDiscount) || 0;
                              if (isWho) return spl > 0 ? `Wholesale (-₹${spl})` : "Wholesale";
                              if (spl > 0 || bt === "RETAILER WITH SPECIAL DISCOUNT") return `Retailer (-₹${spl})`;
                              return "Retailer";
                            })()}
                          </div>
                        )}
                        {(() => {
                          const isWholesaler = (draftInfo?.businessType || "").toUpperCase().includes("WHOLESAL");
                          const splDisc = Number(draftInfo?.specialDiscount) || 0;
                          const hasSplDisc = splDisc > 0 || draftInfo?.businessType === "RETAILER WITH SPECIAL DISCOUNT";
                          const ret = product.retailerPrice || product.price;
                          const who = product.wholesalerPrice || Math.max(0, ret - 100);
                          const activePrice = isWholesaler
                            ? (hasSplDisc ? Math.max(0, who - splDisc) : who)
                            : (hasSplDisc ? Math.max(0, ret - splDisc) : ret);

                          return (
                            <div className="flex items-baseline gap-1 flex-wrap">
                              {product.mrp && product.mrp > activePrice && (
                                <span className="text-[10px] sm:text-xs text-slate-400 line-through font-mono">
                                  ₹{product.mrp}
                                </span>
                              )}
                              <span className="text-sm sm:text-lg font-black text-slate-900 font-mono">
                                {formatCurrency(activePrice)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl text-[10px] sm:text-xs font-bold shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform flex items-center gap-1 shrink-0">
                        <span className="hidden sm:inline">Select Colors</span>
                        <span className="sm:hidden">View</span>
                        <ArrowRight size={12} className="sm:w-3.5 sm:h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar: Order In Progress */}
      {draftInfo && draftInfo.itemsCount > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-3 sm:px-4 pointer-events-none">
          <div className="bg-slate-950/95 backdrop-blur-md text-white px-3.5 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-2.5 sm:gap-3 pointer-events-auto transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                {draftInfo.itemsCount}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white leading-tight truncate">
                  {draftInfo.itemsCount} Product{draftInfo.itemsCount > 1 ? "s" : ""} Added
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  Select more or finalize order
                </p>
              </div>
            </div>

            <Link
              href={returnTo}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-[11px] sm:text-xs font-black rounded-xl shadow-md transition flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <span>Go to Order Form</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
