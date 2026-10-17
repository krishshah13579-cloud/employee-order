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
import { formatCurrency, getProductCoverImage, isGstPanRegistered } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  getTotalAvailableSets,
  parseColorwiseSets,
  getAllProductColors,
  getAvailableSetsForColor,
} from "@/lib/stock";
import type { ProductData } from "@/lib/types";

const DEFAULT_STORE_CATEGORIES = [
  "All",
  "EVERYDAY CASUAL",
  "FORMAL WEAR",
  "LINEN",
];

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/orders/new";

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
    itemsCount: number;
  } | null>(null);

  // Load active draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("garmentpro_order_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.customer || (parsed.items && parsed.items.length > 0))) {
          setDraftInfo({
            customerName: parsed.customer?.shopName || parsed.customerName,
            customerGstPan: parsed.customer?.gstPanNo,
            businessType: parsed.customer?.businessType,
            itemsCount: parsed.items?.length || 0,
          });
        }
      }
    } catch {}
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
    return products.filter((product) => {
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
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <UserHeader />

      {/* Top Banner / Breadcrumb */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Link href="/" className="hover:text-white transition">
                  Home
                </Link>
                <span>/</span>
                <span className="text-orange-400">Products Catalog</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Product Catalog
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Select any product below to choose multiple colors and set quantities at once.
              </p>
            </div>

            {/* Active Order Draft Pill / Action */}
            {draftInfo && (
              <div className="bg-orange-500/15 border border-orange-500/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                    Order In Progress
                  </div>
                  <div className="text-sm font-bold text-white truncate max-w-xs">
                    {draftInfo.customerName || "Customer Selected"}
                  </div>
                  <div className="text-xs text-slate-300">
                    {draftInfo.itemsCount} product item(s) in draft
                  </div>
                </div>
                <Link
                  href={returnTo}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-md transition flex items-center gap-1.5"
                >
                  <span>Return to Order Form</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Unregistered Customer GST/PAN warning */}
        {draftInfo && draftInfo.customerName && !isGstPanRegistered(draftInfo.customerGstPan) && (
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
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 max-w-md">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by style name, color, sizes..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              />
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span>{" "}
              available trouser style(s)
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            PRODUCTS GRID
            ═══════════════════════════════════════════ */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm animate-pulse space-y-4"
              >
                <div className="w-full h-56 bg-slate-200 rounded-xl" />
                <div className="w-2/3 h-4 bg-slate-200 rounded" />
                <div className="w-1/2 h-3 bg-slate-200 rounded" />
                <div className="w-full h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
              <Shirt size={32} />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No Products Found</h3>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const coverImage = getProductCoverImage(product.imageUrl);
              const totalAvailableStock = getTotalAvailableSets(product.setsColorwise);
              const allColors = getAllProductColors(
                product.colorsAvailable,
                product.setsColorwise,
                product.colorMapping
              );
              // Show in-stock colors on employee panel
              const colorList = allColors.filter((col) => {
                if (!product.setsColorwise || !product.setsColorwise.trim()) return true;
                return getAvailableSetsForColor(product.setsColorwise, col, product.colorMapping) > 0;
              });

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col group"
                >
                  {/* Product Image Box */}
                  <Link
                    href={`/products/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}
                    className="relative w-full h-64 bg-slate-100 overflow-hidden block"
                  >
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
                    <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-orange-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-slate-700/60 shadow-sm">
                      {product.category}
                    </span>

                    {/* Stock Badge */}
                    <span
                      className={`absolute bottom-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-md shadow-sm ${
                        totalAvailableStock > 0
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                          : "bg-red-950/80 text-red-300 border border-red-700/60"
                      }`}
                    >
                      {totalAvailableStock > 0 ? "In Stock" : "Out of Stock"}
                    </span>
                  </Link>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Product Name */}
                      <Link
                        href={`/products/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}
                        className="font-black text-slate-900 text-base hover:text-orange-600 transition-colors line-clamp-1"
                      >
                        {product.name}
                      </Link>

                      {/* Sizes Ratio */}
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>Sizes: {product.sizesRatio}</span>
                        <span className="font-semibold text-slate-700">
                          {product.pcsPerSet || 5} Pcs / Set
                        </span>
                      </div>

                      {/* Colors Palette Preview */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {colorList.slice(0, 5).map((col, idx) => {
                          const hex = getColorHex(col).hex;
                          return (
                            <span
                              key={idx}
                              title={col}
                              className="w-4 h-4 rounded-full border border-slate-300 shadow-xs inline-block"
                              style={{ backgroundColor: hex }}
                            />
                          );
                        })}
                        {colorList.length > 5 && (
                          <span className="text-[10px] font-bold text-slate-500">
                            +{colorList.length - 5}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <span>Rate per PC</span>
                          {draftInfo?.customerName && (
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                draftInfo.businessType === "WHOLESALER"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {draftInfo.businessType === "WHOLESALER" ? "Wholesaler" : "Retailer"}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const isWholesaler = draftInfo?.businessType === "WHOLESALER";
                          const ret = product.retailerPrice || product.price;
                          const who = product.wholesalerPrice || Math.max(0, ret - 100);
                          const activePrice = isWholesaler ? who : ret;

                          return (
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              {product.mrp && product.mrp > activePrice && (
                                <span className="text-xs text-slate-400 line-through font-mono">
                                  MRP {formatCurrency(product.mrp)}
                                </span>
                              )}
                              <span className="text-lg font-black text-slate-900 font-mono">
                                {formatCurrency(activePrice)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <Link
                        href={`/products/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}
                        className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center gap-1.5"
                      >
                        <span>Select Colors</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
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
