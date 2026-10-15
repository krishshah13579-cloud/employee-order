"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Boxes,
  Search,
  Filter,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";
import StoreLayoutShell from "@/components/layout/StoreLayoutShell";
import { formatCurrency, getProductCoverImage } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  parseColorwiseSets,
  getTotalAvailableSets,
  getAllProductColors,
  cleanColorName,
} from "@/lib/stock";
import type { ProductData } from "@/lib/types";

export default function EmployeeStockPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [stockStatusFilter, setStockStatusFilter] = useState<"All" | "InStock" | "OutOfStock">("All");

  const fetchStockProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/products?active_only=1", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load inventory");
      const data: ProductData[] = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Error loading stock:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockProducts();
  }, []);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search filter
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.colorsAvailable.toLowerCase().includes(term) ||
        (p.sizesRatio && p.sizesRatio.toLowerCase().includes(term));

      // Category filter
      const matchesCategory =
        categoryFilter === "All" ||
        p.category.toLowerCase() === categoryFilter.toLowerCase();

      // Stock filter
      const totalSets = getTotalAvailableSets(p.setsColorwise);
      const matchesStock =
        stockStatusFilter === "All" ||
        (stockStatusFilter === "InStock" && totalSets > 0) ||
        (stockStatusFilter === "OutOfStock" && totalSets === 0);

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, categoryFilter, stockStatusFilter]);

  // Aggregate Metrics
  const aggregates = useMemo(() => {
    let totalStockSets = 0;
    let totalMixPcs = 0;
    let totalStockValuation = 0;

    products.forEach((p) => {
      const sets = getTotalAvailableSets(p.setsColorwise);
      const pcs = sets * (p.pcsPerSet || 5);
      const unitCost = p.retailerPrice || p.price || 0;
      totalStockSets += sets;
      totalMixPcs += pcs;
      totalStockValuation += pcs * unitCost;
    });

    return {
      totalProducts: products.length,
      totalStockSets,
      totalMixPcs,
      totalStockValuation,
    };
  }, [products]);

  return (
    <StoreLayoutShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">
              <Boxes size={16} />
              <span>Real-Time Warehouse Stock & Inventory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Stock Inventory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live factory stock levels color-wise with sets, mix pieces, costing, and inventory valuation.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchStockProducts}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh Stock</span>
            </button>
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition cursor-pointer"
            >
              <ShoppingBag size={14} />
              <span>Book Order</span>
            </Link>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                Total Products
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Boxes size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono">
                {aggregates.totalProducts}
              </div>
              <span className="text-[11px] text-slate-500">Active Garment Styles</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                Total Stock Sets
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-orange-600 font-mono">
                {aggregates.totalStockSets}
              </div>
              <span className="text-[11px] text-slate-500">Master Sets Ready</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                Total Mix Pieces
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <PackageCheck size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-700 font-mono">
                {aggregates.totalMixPcs.toLocaleString("en-IN")}
              </div>
              <span className="text-[11px] text-slate-500">Individual Garments (PCS)</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                Total Stock Valuation
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-black text-purple-950 font-mono">
                {formatCurrency(aggregates.totalStockValuation)}
              </div>
              <span className="text-[11px] text-slate-500">At Standard Selling Rate</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by style, color, ratio..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Pills */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setStockStatusFilter("All")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockStatusFilter === "All"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Items ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setStockStatusFilter("InStock")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockStatusFilter === "InStock"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              In Stock
            </button>
            <button
              type="button"
              onClick={() => setStockStatusFilter("OutOfStock")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockStatusFilter === "OutOfStock"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>

        {/* Stock Inventory Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-5">Product Name</th>
                  <th className="py-4 px-5">Colors & Breakdown</th>
                  <th className="py-4 px-5 text-center">Set</th>
                  <th className="py-4 px-5 text-center">Mix Pcs</th>
                  <th className="py-4 px-5 text-right">Costing (₹/PC)</th>
                  <th className="py-4 px-5 text-right">Total Price (₹)</th>
                  <th className="py-4 px-5 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <RefreshCw size={24} className="animate-spin text-orange-600 mb-2" />
                        <span>Loading warehouse inventory data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <Boxes size={36} className="text-slate-300 mb-2" />
                        <span className="font-bold text-slate-700 text-sm">No Products Found</span>
                        <span className="text-xs text-slate-500 mt-0.5">
                          Try adjusting search terms or filters.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const totalSets = getTotalAvailableSets(p.setsColorwise);
                    const parsedSets = parseColorwiseSets(p.setsColorwise);
                    const pcsPerSet = p.pcsPerSet || 5;
                    const mixPcs = totalSets * pcsPerSet;
                    const retPrice = p.retailerPrice || p.price || 0;
                    const whoPrice = p.wholesalerPrice || Math.max(0, retPrice - 100);
                    const totalPrice = mixPcs * retPrice;
                    const cover = getProductCoverImage(p.imageUrl);
                    const isOutOfStock = totalSets === 0;

                    const colorList = getAllProductColors(
                      p.colorsAvailable,
                      p.setsColorwise,
                      p.colorMapping
                    );

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isOutOfStock ? "bg-slate-50/40 opacity-75" : ""
                        }`}
                      >
                        {/* 1. Product Name */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <img
                              src={cover}
                              alt={p.name}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%23f1f5f9'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' font-weight='600' fill='%2394a3b8'>Garment</text></svg>";
                              }}
                            />
                            <div>
                              <Link
                                href={`/products/${p.id}?returnTo=/stock`}
                                className="font-black text-slate-900 text-sm hover:text-orange-600 transition flex items-center gap-1.5"
                              >
                                <span>{p.name}</span>
                              </Link>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {p.category}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {p.sizesRatio} ({pcsPerSet} pcs/s)
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Colors */}
                        <td className="py-4 px-5 max-w-sm">
                          <div className="flex flex-wrap gap-1.5">
                            {colorList.map((col) => {
                              const hex = getColorHex(col).hex;
                              const sets = parsedSets[cleanColorName(col)] ?? parsedSets[col] ?? 0;

                              return (
                                <span
                                  key={col}
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                                    sets > 0
                                      ? "bg-white border-slate-200 text-slate-800 shadow-2xs"
                                      : "bg-slate-50 border-dashed border-slate-200 text-slate-400"
                                  }`}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full inline-block border border-black/10 shrink-0"
                                    style={{ backgroundColor: hex }}
                                  />
                                  <span>{col}:</span>
                                  <strong
                                    className={`font-mono ${
                                      sets > 0 ? "text-orange-600 font-black" : "text-slate-400 font-normal"
                                    }`}
                                  >
                                    {sets}s
                                  </strong>
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* 3. Set */}
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-xl font-black font-mono text-sm ${
                              totalSets > 0
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {totalSets}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                            Sets
                          </span>
                        </td>

                        {/* 4. Mix Pcs */}
                        <td className="py-4 px-5 text-center">
                          <div className="font-mono font-black text-slate-900 text-sm">
                            {mixPcs}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {totalSets} × {pcsPerSet} pcs
                          </span>
                        </td>

                        {/* 5. Costing */}
                        <td className="py-4 px-5 text-right font-mono">
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-blue-700 bg-blue-50 px-1 py-0.2 rounded font-bold">
                                Ret
                              </span>
                              <span className="font-bold text-slate-900 text-xs">
                                {formatCurrency(retPrice)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded font-bold">
                                Whol
                              </span>
                              <span className="font-bold text-slate-600 text-xs">
                                {formatCurrency(whoPrice)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 6. Total Price */}
                        <td className="py-4 px-5 text-right">
                          <div className="font-mono font-black text-slate-900 text-sm">
                            {formatCurrency(totalPrice)}
                          </div>
                          <span className="text-[10px] text-slate-400 font-sans">
                            Inventory Value
                          </span>
                        </td>

                        {/* 7. Action */}
                        <td className="py-4 px-5 text-center">
                          <Link
                            href={`/products/${p.id}?returnTo=/stock`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-2xs"
                          >
                            <span>Order</span>
                            <ArrowRight size={13} />
                          </Link>
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
    </StoreLayoutShell>
  );
}
