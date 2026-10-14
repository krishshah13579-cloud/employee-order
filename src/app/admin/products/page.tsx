"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, getProductCoverImage } from "@/lib/utils";
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
} from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  type ProductData,
  type SizeGuideRow,
} from "@/lib/types";
import { parseColorwiseSets, getTotalAvailableSets } from "@/lib/stock";

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [previewGuide, setPreviewGuide] = useState<{ name: string; guide: string } | null>(null);
  const [previewUnit, setPreviewUnit] = useState<"IN" | "CM">("IN");
  const [categoriesList, setCategoriesList] = useState<string[]>([...PRODUCT_CATEGORIES]);

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
    loadCategories();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = "/api/products?";
      if (categoryFilter !== "All" && categoryFilter !== "__deleted__") {
        url += `category=${encodeURIComponent(categoryFilter)}&`;
      }
      if (search) url += `search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
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
        setProducts(data);
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
          href="/admin/products/new"
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
                <th className="py-3.5 px-6">Wholesale Rate</th>
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
                          return (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-gray-800 text-[11px] font-semibold rounded-lg border border-gray-200 shadow-2xs"
                            >
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
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 flex items-center gap-1 text-xs">
                          <Layers size={13} className="text-blue-600" />
                          {p.sizesRatio}
                        </span>
                        <span className="text-[11px] text-gray-500 font-mono">
                          [{p.sizesList}] • <span className="font-bold text-blue-700">{p.pcsPerSet} pcs/set</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs max-w-xs">
                      {(() => {
                        if (!p.setsColorwise || !p.setsColorwise.trim()) {
                          return <span className="text-gray-400 italic">No limit</span>;
                        }
                        const total = getTotalAvailableSets(p.setsColorwise);
                        const parsed = parseColorwiseSets(p.setsColorwise);
                        const isZero = total === 0;

                        return (
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold font-mono text-[11px] w-fit ${
                                isZero
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isZero ? "0 Sets (Sold Out)" : `${total} Sets in Stock`}
                            </span>
                            <div className="text-[10px] text-gray-500 truncate" title={p.setsColorwise}>
                              {Object.entries(parsed)
                                .map(([col, cnt]) => `${col}: ${cnt}`)
                                .join(", ")}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900 font-mono text-sm">
                      {formatCurrency(p.price)}
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
                    <td className="py-4 px-6 text-right space-x-2">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
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

      {/* Size Guide Preview Modal (Quick view) */}
      {previewGuide && (() => {
        let parsedRows: SizeGuideRow[] | null = null;
        try {
          const parsed = JSON.parse(previewGuide.guide);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].brandSize) {
            parsedRows = parsed;
          }
        } catch {}

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
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs uppercase tracking-wider">
                  <Ruler size={15} className="text-zinc-900" /> Size Chart & Dimensions
                </div>

                {parsedRows && (
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
                )}
              </div>

              {parsedRows ? (
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
                      {parsedRows.map((row) => (
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
              ) : (
                <p className="text-xs text-gray-800 whitespace-pre-line leading-relaxed font-sans bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {previewGuide.guide}
                </p>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
