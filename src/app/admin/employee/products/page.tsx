"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, getProductCoverImage, sortProductsByImpSequence } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Layers,
  Ruler,
  FolderTree,
} from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  type ProductData,
  type SizeGuideRow,
} from "@/lib/types";
import {
  parseColorwiseSets,
  getTotalAvailableSets,
  getAllProductColors,
  getAvailableSetsForColor,
  parseDetailedColorStockWithLoose,
  parseDetailedColorRatioSets,
  getSizesFromRatio,
  stringifyColorwiseSets,
  cleanColorName,
} from "@/lib/stock";
import CategoriesManager from "../categories/CategoriesManager";

function ProductsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "CATEGORIES">(
    tabParam?.toUpperCase() === "CATEGORIES" ? "CATEGORIES" : "PRODUCTS"
  );

  useEffect(() => {
    if (tabParam?.toUpperCase() === "CATEGORIES") {
      setActiveTab("CATEGORIES");
    } else if (tabParam?.toUpperCase() === "PRODUCTS") {
      setActiveTab("PRODUCTS");
    }
  }, [tabParam]);

  const handleTabChange = (tab: "PRODUCTS" | "CATEGORIES") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "CATEGORIES") {
      params.set("tab", "categories");
    } else {
      params.delete("tab");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    router.replace(`${pathname}${query}`, { scroll: false });
  };

  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [previewGuide, setPreviewGuide] = useState<{ name: string; guide: string } | null>(null);
  const [previewGuideTab, setPreviewGuideTab] = useState<"TROUSERS" | "FORMAL">("TROUSERS");
  const [previewUnit, setPreviewUnit] = useState<"IN" | "CM">("IN");
  const [categoriesList, setCategoriesList] = useState<string[]>([...PRODUCT_CATEGORIES]);

  // Quick Stock Sets Editor Modal State
  const [quickStockProduct, setQuickStockProduct] = useState<ProductData | null>(null);
  const [quickStockMap, setQuickStockMap] = useState<Record<string, number>>({});
  const [savingQuickStock, setSavingQuickStock] = useState(false);

  const openQuickStock = (p: ProductData) => {
    setQuickStockProduct(p);
    const colors = getAllProductColors(p.colorsAvailable, p.setsColorwise, p.colorMapping);
    const map: Record<string, number> = {};
    colors.forEach((c) => {
      map[c] = getAvailableSetsForColor(p.setsColorwise, c, p.colorMapping);
    });
    setQuickStockMap(map);
  };

  const handleSaveQuickStock = async () => {
    if (!quickStockProduct) return;
    setSavingQuickStock(true);
    try {
      const primaryRatio = quickStockProduct.sizesRatio || "28 to 36";
      const existingStockWithLoose = parseDetailedColorStockWithLoose(quickStockProduct.setsColorwise, primaryRatio);
      const nextStockMap: Record<string, { ratios: Record<string, number>; loosePcs: Record<string, number> }> = {};

      for (const [col, cnt] of Object.entries(quickStockMap)) {
        const clean = cleanColorName(col);
        const existingLoose = existingStockWithLoose[clean]?.loosePcs || {};
        nextStockMap[clean] = {
          ratios: { [primaryRatio]: Math.max(0, parseInt(String(cnt), 10) || 0) },
          loosePcs: existingLoose,
        };
      }
      const serialized = JSON.stringify(nextStockMap);

      const res = await fetch(`/api/products/${quickStockProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quickStockProduct,
          setsColorwise: serialized,
        }),
      });
      if (res.ok) {
        toast("Stock sets updated successfully!", "success");
        setQuickStockProduct(null);
        fetchProducts();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update stock", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSavingQuickStock(false);
    }
  };

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const names = data.map((c: any) => c.name);
            setCategoriesList(names);
          }
        }
      } catch {}
    }
    if (activeTab === "PRODUCTS") {
      loadCategories();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = "/api/products?";
      if (categoryFilter !== "All" && categoryFilter !== "__deleted__") {
        url += `category=${encodeURIComponent(categoryFilter)}&`;
      }
      if (search) url += `search=${encodeURIComponent(search)}&`;
      url += `_t=${Date.now()}`;

      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        let data: ProductData[] = await res.json();
        if (categoryFilter === "__deleted__") {
          data = data.filter(
            (p) =>
              categoriesList.length > 0 &&
              !categoriesList.some(
                (c) => c.toLowerCase() === p.category.toLowerCase()
              )
          );
        }
        setProducts(sortProductsByImpSequence(data));
      }
    } catch (err: any) {
      toast("Failed to load products: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, categoryFilter]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Product removed successfully", "success");
        fetchProducts();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete product", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => handleTabChange("PRODUCTS")}
          className={`px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "PRODUCTS"
              ? "border-orange-600 text-orange-700 bg-orange-50/70 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <Package size={16} className={activeTab === "PRODUCTS" ? "text-orange-600" : "text-gray-400"} />
          <span>Products</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("CATEGORIES")}
          className={`px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "CATEGORIES"
              ? "border-orange-600 text-orange-700 bg-orange-50/70 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <FolderTree size={16} className={activeTab === "CATEGORIES" ? "text-orange-600" : "text-gray-400"} />
          <span>Categories</span>
        </button>
      </div>

      {activeTab === "CATEGORIES" ? (
        <CategoriesManager />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <Package size={14} /> Wholesale Garment Catalog
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products Catalog</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage trousers, color palettes, mandatory size set ratios (e.g. 28-36, 30-38), rates, and size guides.
          </p>
        </div>

        <Link
          href="/admin/employee/products/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-950 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          <span>Add New Garment</span>
        </Link>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, colors, sizes..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-zinc-900 focus:outline-none shadow-2xs"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-700 outline-none shadow-2xs cursor-pointer"
          >
            <option value="All">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            {products.some(
              (p) =>
                categoriesList.length > 0 &&
                !categoriesList.some(
                  (c) => c.toLowerCase() === p.category.toLowerCase()
                )
            ) && (
              <option value="__deleted__">⚠️ Deleted Categories</option>
            )}
          </select>
        </div>

        <button
          onClick={fetchProducts}
          className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 shadow-2xs transition-colors self-end md:self-auto cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-zinc-900" : ""} />
        </button>
      </div>

      {/* Products Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Product & Category</th>
                <th className="py-3.5 px-6">Colors Available</th>
                <th className="py-3.5 px-6">Mandatory Size Ratio</th>
                <th className="py-3.5 px-6">Stock Sets</th>
                <th className="py-3.5 px-6">Dual Selling Rate</th>
                <th className="py-3.5 px-6">Size Guide</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No products found. Click "Add New Garment" to list a product.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={getProductCoverImage(p.imageUrl)}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 bg-gray-100 shrink-0 shadow-2xs"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f1f5f9'/><path d='M40 30 L60 30 L55 70 L51 70 L50 48 L49 70 L45 70 Z' fill='%23cbd5e1'/></svg>";
                          }}
                        />
                        <div>
                          <div className="font-bold text-gray-900 leading-snug">{p.name}</div>
                          {(() => {
                            const isDeleted =
                              categoriesList.length > 0 &&
                              !categoriesList.some(
                                (c) => c.toLowerCase() === p.category.toLowerCase()
                              );
                            if (isDeleted) {
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md mt-0.5"
                                  title="This category has been deleted from Categories"
                                >
                                  <span>{p.category}</span>
                                  <span className="text-[9px] bg-rose-200/90 text-rose-950 px-1 py-0.2 rounded font-extrabold uppercase tracking-wider">
                                    Deleted
                                  </span>
                                </span>
                              );
                            }
                            return (
                              <span className="text-[10px] font-semibold text-zinc-600 bg-gray-100 px-2 py-0.5 rounded-md mt-0.5 inline-block">
                                {p.category}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.colorsAvailable.split(",").map((c, i) => {
                          const trimmed = c.trim();
                          if (!trimmed) return null;
                          const colorInfo = getColorHex(trimmed);

                          // Find alphabet letter from colorMapping if present
                          let letter = String.fromCharCode(65 + i); // Default A, B, C...
                          if (p.colorMapping) {
                            try {
                              const map = JSON.parse(p.colorMapping);
                              const found = Object.entries(map).find(
                                ([_, col]) => String(col).toLowerCase() === trimmed.toLowerCase()
                              );
                              if (found) letter = found[0];
                            } catch {}
                          }

                          return (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white text-gray-800 text-[11px] font-semibold rounded-lg border border-gray-200 shadow-2xs"
                              title={`Admin Wholesale Code: ${letter} -> ${trimmed}`}
                            >
                              <span className="w-4 h-4 rounded-md bg-zinc-900 text-white font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                                {letter}
                              </span>
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                                style={{ backgroundColor: colorInfo.hex }}
                              />
                              <span>{trimmed}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {(() => {
                        const detailedRatioSets = parseDetailedColorRatioSets(p.setsColorwise, p.sizesRatio || "28 to 36");
                        const distinctRatios = new Set<string>();
                        if (p.sizesRatio) distinctRatios.add(p.sizesRatio);
                        for (const ratios of Object.values(detailedRatioSets)) {
                          for (const [rKey, cnt] of Object.entries(ratios)) {
                            if (cnt > 0) distinctRatios.add(rKey);
                          }
                        }
                        const ratioList = Array.from(distinctRatios);
                        const hasMultiple = ratioList.length > 1;

                        return (
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 flex items-center gap-1 text-xs">
                              <Layers size={13} className="text-blue-600" />
                              {p.sizesRatio}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              [{p.sizesList}] • <span className="font-bold text-blue-700">{p.pcsPerSet} pcs/set</span>
                            </span>
                            {hasMultiple && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ratioList.map((r) => (
                                  <span key={r} className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6 text-xs max-w-xs">
                      {(() => {
                        const total = p.setsColorwise ? getTotalAvailableSets(p.setsColorwise) : 0;
                        const detailedRatioSets = parseDetailedColorRatioSets(p.setsColorwise, p.sizesRatio || "28 to 36");
                        let accurateSetPcs = 0;
                        let hasRatioBreakdown = false;
                        for (const ratios of Object.values(detailedRatioSets)) {
                          for (const [rKey, count] of Object.entries(ratios)) {
                            const cnt = Math.max(0, count || 0);
                            if (cnt > 0) {
                              hasRatioBreakdown = true;
                              const rSizes = getSizesFromRatio(rKey);
                              const rPcs = rSizes.length > 0 && rSizes[0] !== rKey ? rSizes.length : (p.pcsPerSet || 5);
                              accurateSetPcs += cnt * rPcs;
                            }
                          }
                        }
                        const totalSetPcs = hasRatioBreakdown ? accurateSetPcs : total * (p.pcsPerSet || 5);
                        const totalPcs = totalSetPcs + ((p as any).mixPcs || 0);
                        const parsed = p.setsColorwise ? parseColorwiseSets(p.setsColorwise) : {};
                        const isZero = !p.setsColorwise || (total === 0 && ((p as any).mixPcs || 0) === 0);

                        return (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold font-mono text-[11px] w-fit ${
                                  isZero
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {isZero ? "0 Sets (Sold Out)" : `${total} Sets (${totalPcs} pcs)`}
                              </span>
                              <button
                                type="button"
                                onClick={() => openQuickStock(p)}
                                className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                                title="Update Stock Sets"
                              >
                                ⚡ Edit Stock
                              </button>
                            </div>
                            <div className="text-[10px] text-gray-500 truncate" title={p.setsColorwise || "No stock configured"}>
                              {Object.keys(parsed).length > 0
                                ? Object.entries(parsed)
                                    .map(([col, cnt]) => `${col}: ${cnt}`)
                                    .join(", ")
                                : "No stock configured"}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6 text-xs">
                      <div className="flex flex-col gap-1 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase shrink-0">
                            Retailer
                          </span>
                          <span className="font-bold text-gray-900 text-xs">
                            {formatCurrency(p.retailerPrice || p.price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 uppercase shrink-0">
                            Wholesaler
                          </span>
                          <span className="font-bold text-gray-900 text-xs">
                            {formatCurrency(p.wholesalerPrice || Math.max(0, (p.retailerPrice || p.price) - 100))}
                          </span>
                        </div>
                        {p.mrp ? (
                          <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                            MRP: ₹{p.mrp}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {p.sizeGuide ? (
                        <button
                          onClick={() => setPreviewGuide({ name: p.name, guide: p.sizeGuide! })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                        >
                          <Ruler size={13} /> View Guide
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No guide</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-full">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => openQuickStock(p)}
                        className="p-1.5 inline-flex text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="⚡ Quick Update Stock Sets"
                      >
                        <Layers size={15} />
                      </button>
                      <Link
                        href={`/admin/employee/products/${p.id}/edit`}
                        className="p-1.5 inline-flex text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit Product (Opens dedicated page)"
                      >
                        <Edit2 size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 inline-flex text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Size Guide Preview Modal (2 Tabs: Formal and Trousers) */}
      {previewGuide && (() => {
        const TROUSER_ROWS = [
          { brandSize: "28", waist: "30", length: "41" },
          { brandSize: "30", waist: "32", length: "41" },
          { brandSize: "32", waist: "34", length: "41" },
          { brandSize: "34", waist: "36", length: "41" },
          { brandSize: "36", waist: "38", length: "41" },
          { brandSize: "38", waist: "40", length: "41" },
          { brandSize: "40", waist: "42", length: "41" },
          { brandSize: "42", waist: "44", length: "41" },
          { brandSize: "44", waist: "46", length: "41" },
        ];

        const FORMAL_ROWS = [
          { brandSize: "30", waist: "28", length: "41" },
          { brandSize: "32", waist: "30", length: "41" },
          { brandSize: "34", waist: "32", length: "41" },
          { brandSize: "36", waist: "34", length: "41" },
          { brandSize: "38", waist: "36", length: "41" },
          { brandSize: "40", waist: "38", length: "41" },
          { brandSize: "42", waist: "40", length: "41" },
          { brandSize: "44", waist: "42", length: "41" },
        ];

        let parsedRows: SizeGuideRow[] | null = null;
        try {
          const parsed = JSON.parse(previewGuide.guide);
          const rowsList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.rows) ? parsed.rows : []);
          if (rowsList.length > 0 && rowsList[0].brandSize) {
            parsedRows = rowsList;
          }
        } catch {}

        const activeRows = previewGuideTab === "FORMAL" ? FORMAL_ROWS : (parsedRows || TROUSER_ROWS);

        const formatVal = (val: string) => {
          const num = parseFloat(val);
          if (isNaN(num)) return val;
          if (previewUnit === "CM") {
            const cm = (num * 2.54).toFixed(1);
            return `${cm.endsWith(".0") ? cm.slice(0, -2) : cm} cm`;
          }
          return `${val}"`;
        };

        return (
          <Modal
            isOpen={!!previewGuide}
            onClose={() => setPreviewGuide(null)}
            title={`Size Guide — ${previewGuide.name}`}
            size="md"
          >
            <div className="space-y-4">
              {/* 2 Tabs: Trousers & Formal */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setPreviewGuideTab("TROUSERS")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      previewGuideTab === "TROUSERS"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Trousers Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewGuideTab("FORMAL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      previewGuideTab === "FORMAL"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Formal Guide
                  </button>
                </div>

                <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setPreviewUnit("IN")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      previewUnit === "IN"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewUnit("CM")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      previewUnit === "CM"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    CM
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                {previewGuideTab === "FORMAL" ? (
                  <span>
                    👔 <strong>Formal Size Guide:</strong> Engineered for executive tailored formal drape with tapered waistband.
                  </span>
                ) : (
                  <span>
                    👖 <strong>Trouser Size Guide:</strong> Standard comfortable stretch fit for everyday &amp; casual trousers.
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-700 border-b border-gray-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Brand Size</th>
                      <th className="px-3.5 py-2.5">Waist ({previewUnit})</th>
                      <th className="px-3.5 py-2.5">Length ({previewUnit})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white font-medium">
                    {activeRows.map((row) => (
                      <tr key={row.brandSize} className="hover:bg-gray-50">
                        <td className="px-3.5 py-2 font-bold text-gray-900">
                          Size {row.brandSize}
                        </td>
                        <td className="px-3.5 py-2 text-gray-700 font-mono">
                          {formatVal(row.waist)}
                        </td>
                        <td className="px-3.5 py-2 text-gray-700 font-mono">
                          {formatVal(row.length)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Quick Stock Sets Modal */}
      {quickStockProduct && (
        <Modal
          isOpen={true}
          onClose={() => setQuickStockProduct(null)}
          title={`⚡ Quick Stock Sets: ${quickStockProduct.name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <Layers size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Live Inventory Sync</p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Colors with <strong>0 sets</strong> are automatically hidden on the Employee Side until sets are added here. Set at least 1 set for each color to show it on employee panels.
                </p>
              </div>
            </div>

            {/* Bulk Fill Tool */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-xs font-semibold text-gray-700">Quick Bulk Fill:</span>
              <div className="flex items-center gap-2">
                {[5, 10, 20].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      const updated: Record<string, number> = {};
                      Object.keys(quickStockMap).forEach((c) => {
                        updated[c] = amt;
                      });
                      setQuickStockMap(updated);
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition cursor-pointer"
                  >
                    Set all {amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const updated: Record<string, number> = {};
                    Object.keys(quickStockMap).forEach((c) => {
                      updated[c] = 0;
                    });
                    setQuickStockMap(updated);
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Colors Stock List */}
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-bold text-[11px] tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Color Shade</th>
                    <th className="py-2.5 px-4 w-44 text-center">Available Sets</th>
                    <th className="py-2.5 px-4 text-right">Pieces ({quickStockProduct.pcsPerSet || 5} / set)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {Object.keys(quickStockMap).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400 italic">
                        No color shades configured for this garment.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(quickStockMap).map(([color, sets]) => {
                      const cInfo = getColorHex(color);
                      const pcs = sets * (quickStockProduct.pcsPerSet || 5);
                      const isZero = sets <= 0;

                      return (
                        <tr key={color} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: cInfo.hex }}
                              />
                              <span className="font-bold text-gray-900">{color}</span>
                              {isZero && (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  Hidden (0 Sets)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickStockMap((prev) => ({
                                    ...prev,
                                    [color]: Math.max(0, sets - 1),
                                  }))
                                }
                                className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={sets}
                                onChange={(e) =>
                                  setQuickStockMap((prev) => ({
                                    ...prev,
                                    [color]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  }))
                                }
                                className="w-20 text-center py-1.5 bg-gray-50 border border-gray-300 rounded-lg font-bold font-mono text-xs focus:outline-none focus:ring-1 focus:ring-black"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickStockMap((prev) => ({
                                    ...prev,
                                    [color]: sets + 1,
                                  }))
                                }
                                className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                            {pcs} PCS
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setQuickStockProduct(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingQuickStock}
                onClick={handleSaveQuickStock}
                className="px-5 py-2 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {savingQuickStock ? "Updating Inventory..." : "Save Stock Sets"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Loading catalog...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
