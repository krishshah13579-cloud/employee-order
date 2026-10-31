"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  Package,
  Plus,
  Boxes,
  X,
  Sparkles,
  Percent,
  Flame,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  stock: number;
  active: boolean;
  featured: boolean;
  images: string;
  sizes?: string | null;
  colors?: string | null;
  inventory?: string | null;
  category?: {
    name: string;
  } | null;
}

export default function ProductTable({ products }: { products: ProductItem[] }) {
  const router = useRouter();
  // Filter out any out-of-stock products
  const inStockProducts = products.filter((p) => (p.stock || 0) > 0);

  const [activeTab, setActiveTab] = useState<"ALL" | "35_OFF">("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [viewingInventoryProduct, setViewingInventoryProduct] = useState<ProductItem | null>(null);
  const [applying25All, setApplying25All] = useState(false);
  const [updatingDiscountId, setUpdatingDiscountId] = useState<string | null>(null);
  const [showConfirm25Modal, setShowConfirm25Modal] = useState(false);
  const [selectedProductToAdd35, setSelectedProductToAdd35] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Helper to compute effective discount percentage
  const getDiscountPercent = (price: number, comparePrice?: number | null): number => {
    if (!comparePrice || comparePrice <= price) return 0;
    return Math.round(((comparePrice - price) / comparePrice) * 100);
  };

  const is35PercentOff = (p: ProductItem): boolean => {
    const d = getDiscountPercent(p.price, p.comparePrice);
    return d >= 33 && d <= 38;
  };

  const is25PercentOff = (p: ProductItem): boolean => {
    const d = getDiscountPercent(p.price, p.comparePrice);
    return d >= 23 && d <= 28;
  };

  const products35Off = inStockProducts.filter(is35PercentOff);
  const non35Products = inStockProducts.filter((p) => !is35PercentOff(p));

  // Handler: Apply 25% OFF to all products
  const handleApply25ToAll = async () => {
    setApplying25All(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/online/products/bulk-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPLY_25_ALL" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply 25% discount to all products");

      setFeedback({
        type: "success",
        text: data.message || "25% OFF applied successfully to all products (ending in 99 or 49).",
      });
      setShowConfirm25Modal(false);
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Error applying discount" });
    } finally {
      setApplying25All(false);
    }
  };

  // Handler: Move specific product to 35% OFF (or remove)
  const handleSetProductDiscount = async (productId: string, discountPercent: number) => {
    setUpdatingDiscountId(productId);
    setFeedback(null);
    try {
      const res = await fetch("/api/online/products/bulk-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SET_PRODUCT_DISCOUNT",
          productId,
          discountPercent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update discount");

      setFeedback({
        type: "success",
        text: data.message || `Product updated to ${discountPercent}% OFF.`,
      });
      setSelectedProductToAdd35("");
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Error updating product discount" });
    } finally {
      setUpdatingDiscountId(null);
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeletingId(productToDelete.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/online/products/${productToDelete.id}/delete`, {
        method: "POST",
      });

      if (!res.ok) {
        const fallbackRes = await fetch(`/api/online/products/${productToDelete.id}`, {
          method: "DELETE",
        });
        if (!fallbackRes.ok) {
          throw new Error("Failed to delete product");
        }
      }

      setProductToDelete(null);
      router.refresh();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Error deleting product";
      setFeedback({ type: "error", text: rawMsg });
    } finally {
      setDeletingId(null);
    }
  };

  const getFirstImage = (imagesStr?: string | null): string => {
    if (!imagesStr) return "";
    try {
      const parsed = JSON.parse(imagesStr);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
        return String(parsed[0]).trim();
      }
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    } catch {}
    if (typeof imagesStr === "string" && imagesStr.trim()) {
      if (imagesStr.startsWith("data:")) return imagesStr.trim();
      const split = imagesStr.split(",")[0]?.trim();
      if (split) return split;
    }
    return "";
  };

  const getImageCount = (imagesStr?: string | null): number => {
    if (!imagesStr) return 0;
    try {
      const parsed = JSON.parse(imagesStr);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).length;
    } catch {}
    if (imagesStr.startsWith("data:")) return 1;
    return imagesStr.split(",").map((s) => s.trim()).filter(Boolean).length;
  };

  const isValidImageSrc = (src: string): boolean => {
    if (!src || typeof src !== "string") return false;
    const s = src.trim();
    return (
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("/") ||
      s.startsWith("data:image/") ||
      s.startsWith("blob:")
    );
  };

  const displayedList = activeTab === "35_OFF" ? products35Off : inStockProducts;

  return (
    <>
      {feedback && (
        <div
          className={`mb-4 p-3.5 border rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-black cursor-pointer font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Controls: 25% OFF Button & 35% Section Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Percent className="w-4 h-4 text-orange-600" />
              <span>Promotional Pricing &amp; Bulk Discount Actions</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated 99/49 psychological pricing (e.g. ₹1,299 or ₹1,249).
            </p>
          </div>

          {/* Apply 25% OFF to All Products button */}
          <button
            type="button"
            onClick={() => setShowConfirm25Modal(true)}
            disabled={applying25All || inStockProducts.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {applying25All ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Percent className="w-3.5 h-3.5" />
            )}
            <span>Apply 25% OFF to All Products</span>
          </button>
        </div>

        {/* 35% OFF Dedicated Section Bar */}
        <div className="bg-gradient-to-r from-rose-50 via-amber-50/50 to-orange-50 border border-rose-200/80 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-2">
                <span>Special 35% OFF Clearance Section</span>
                <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {products35Off.length} Active
                </span>
              </div>
              <p className="text-[11px] text-rose-800/80 mt-0.5">
                Move specific products to 35% OFF. Prices round to XX99 or XX49.
              </p>
            </div>
          </div>

          {/* Quick-move product into 35% OFF */}
          <div className="flex items-center gap-2">
            <select
              value={selectedProductToAdd35}
              onChange={(e) => setSelectedProductToAdd35(e.target.value)}
              className="bg-white border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 max-w-[220px] truncate"
            >
              <option value="">Select product to move...</option>
              {non35Products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatPrice(p.price)})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedProductToAdd35 || updatingDiscountId !== null}
              onClick={() => handleSetProductDiscount(selectedProductToAdd35, 35)}
              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              + Move to 35% OFF
            </button>
          </div>
        </div>

        {/* View Filter Tabs */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Products ({inStockProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("35_OFF")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "35_OFF"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>35% OFF Section ({products35Off.length})</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {displayedList.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-400">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {activeTab === "35_OFF" ? "No products in 35% OFF section" : "No products in inventory"}
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                {activeTab === "35_OFF"
                  ? "Select a product above to add it to the 35% OFF clearance section."
                  : "All products have been removed. You can now add your own trousers and formal wear styles."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-3">Product</th>
                  <th scope="col" className="px-5 py-3">Category</th>
                  <th scope="col" className="px-5 py-3">Pricing &amp; Discount</th>
                  <th scope="col" className="px-5 py-3">Stock &amp; Variants</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedList.map((product) => {
                  const imageSrc = getFirstImage(product.images);
                  const photoCount = getImageCount(product.images);
                  const hasValidImage = isValidImageSrc(imageSrc) && !imageErrors[product.id];
                  const discountPct = getDiscountPercent(product.price, product.comparePrice);
                  const is35 = is35PercentOff(product);
                  const is25 = is25PercentOff(product);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      {/* 1. Product Image & Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="w-12 h-12 rounded-lg bg-gray-100 relative overflow-hidden border border-gray-200 flex items-center justify-center">
                              {hasValidImage ? (
                                <img
                                  src={imageSrc}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={() => {
                                    setImageErrors((prev) => ({ ...prev, [product.id]: true }));
                                  }}
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                            </div>
                            {photoCount > 1 && (
                              <span
                                className="absolute -bottom-1 -right-1 bg-black text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs border border-white"
                                title={`${photoCount} photos uploaded`}
                              >
                                {photoCount}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 leading-snug">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              /{product.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Category */}
                      <td className="px-5 py-3.5 text-gray-700 font-medium">
                        {product.category?.name || "Uncategorized"}
                      </td>

                      {/* 3. Pricing & Discounts */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 font-mono text-sm">
                              {formatPrice(product.price)}
                            </span>
                            {product.comparePrice && product.comparePrice > product.price && (
                              <span className="line-through text-gray-400 font-mono text-xs">
                                {formatPrice(product.comparePrice)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {is35 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <Flame className="w-3 h-3" />
                                <span>35% OFF</span>
                              </span>
                            ) : is25 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Percent className="w-3 h-3" />
                                <span>25% OFF</span>
                              </span>
                            ) : discountPct > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300">
                                {discountPct}% OFF
                              </span>
                            ) : null}

                            {/* Move to 35% OFF or Reset button */}
                            {is35 ? (
                              <button
                                type="button"
                                disabled={updatingDiscountId === product.id}
                                onClick={() => handleSetProductDiscount(product.id, 0)}
                                className="text-[10px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                              >
                                Remove 35%
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={updatingDiscountId === product.id}
                                onClick={() => handleSetProductDiscount(product.id, 35)}
                                className="text-[10px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded cursor-pointer"
                              >
                                + Move to 35%
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Stock & Variants */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              product.stock > 10
                                ? "bg-gray-100 text-gray-700"
                                : product.stock > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {product.stock} in stock
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewingInventoryProduct(product)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-black hover:underline cursor-pointer"
                          >
                            <Boxes className="w-3 h-3 text-gray-500" />
                            <span>Variants (Mix Sizes)</span>
                          </button>
                        </div>
                      </td>

                      {/* 5. Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            product.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {product.active ? (
                            <>
                              <Eye className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </span>
                      </td>

                      {/* 6. Actions */}
                      <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                        <Link
                          href={`/admin/online/products/${product.id}/edit`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setProductToDelete(product)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Apply 25% OFF to All Products */}
      {showConfirm25Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-orange-600">
              <div className="p-2.5 rounded-xl bg-orange-100">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Apply 25% OFF to All Products?
                </h3>
                <p className="text-xs text-gray-500">
                  Bulk pricing automation for {inStockProducts.length} active styles
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed bg-orange-50/70 p-3 rounded-xl border border-orange-200/60">
              This will update selling prices across all online products with a 25% discount. All prices will automatically round to end in <strong>1999/-, 1549/-, 1299/-, 1249/-</strong> using psychological charm pricing. Original base prices will be preserved as strike-through compare prices.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={applying25All}
                onClick={() => setShowConfirm25Modal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={applying25All}
                onClick={handleApply25ToAll}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-xs cursor-pointer"
              >
                {applying25All && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Apply 25% OFF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Delete Product
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-gray-900">&ldquo;{productToDelete.name}&rdquo;</strong>? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deletingId ? "Deleting..." : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Breakdown Modal (Variants with Mix Sizes & Crossmarked Unavailable Sizes) */}
      {viewingInventoryProduct && (() => {
        let invMap: Record<string, Record<string, number>> = {};
        if (viewingInventoryProduct.inventory) {
          try {
            invMap = typeof viewingInventoryProduct.inventory === "string"
              ? JSON.parse(viewingInventoryProduct.inventory)
              : viewingInventoryProduct.inventory;
          } catch {}
        }
        let colorsList: string[] = [];
        if (viewingInventoryProduct.colors) {
          try {
            const parsed = JSON.parse(viewingInventoryProduct.colors);
            if (Array.isArray(parsed)) colorsList = parsed;
          } catch {
            colorsList = typeof viewingInventoryProduct.colors === "string"
              ? viewingInventoryProduct.colors.split(",").map(c => c.trim()).filter(Boolean)
              : [];
          }
        }
        if (colorsList.length === 0) {
          colorsList = Object.keys(invMap);
        }
        let sizesList: string[] = [];
        if (viewingInventoryProduct.sizes) {
          try {
            const parsed = JSON.parse(viewingInventoryProduct.sizes);
            if (Array.isArray(parsed)) sizesList = parsed;
          } catch {
            sizesList = typeof viewingInventoryProduct.sizes === "string"
              ? viewingInventoryProduct.sizes.split(",").map(s => s.trim()).filter(Boolean)
              : [];
          }
        }
        if (sizesList.length === 0) {
          const allSizes = new Set<string>();
          Object.values(invMap).forEach(m => Object.keys(m).forEach(s => allSizes.add(s)));
          sizesList = Array.from(allSizes);
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gray-100 rounded-xl text-gray-900">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {viewingInventoryProduct.name} — Mix Sizes &amp; Variants
                    </h3>
                    <p className="text-xs text-gray-500">
                      Available loose sizes from stock. Unavailable sizes are crossmarked to protect full wholesale sets.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingInventoryProduct(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {colorsList.length === 0 || sizesList.length === 0 ? (
                <div className="p-6 bg-gray-50 rounded-xl text-center text-xs text-gray-500">
                  No variant matrix configured yet. Total stock is {viewingInventoryProduct.stock} units.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-900 text-white font-semibold">
                      <tr>
                        <th className="p-2.5 min-w-[120px]">Color</th>
                        {sizesList.map(s => (
                          <th key={s} className="p-2.5 text-center min-w-[60px]">
                            {s}
                          </th>
                        ))}
                        <th className="p-2.5 text-center bg-gray-800 min-w-[80px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {colorsList.map(color => {
                        let rowSum = 0;
                        return (
                          <tr key={color} className="hover:bg-gray-50/50">
                            <td className="p-2.5 font-medium text-gray-900">{color}</td>
                            {sizesList.map(size => {
                              const qty = invMap[color]?.[size] ?? 0;
                              rowSum += qty;
                              return (
                                <td key={size} className="p-2 text-center">
                                  {qty === 0 ? (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 line-through"
                                      title="Unavailable (Full set preserved)"
                                    >
                                      ✕ 0
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      {qty}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-2.5 text-center font-bold text-gray-900 bg-gray-50">
                              {rowSum}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                      <tr>
                        <td className="p-2.5">Total Units</td>
                        {sizesList.map(size => {
                          const colSum = colorsList.reduce((acc, color) => {
                            return acc + (invMap[color]?.[size] ?? 0);
                          }, 0);
                          return (
                            <td key={size} className="p-2.5 text-center">
                              {colSum}
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-center bg-gray-200">
                          {viewingInventoryProduct.stock}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Available mix sizes</span>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400 ml-2" />
                  <span className="line-through text-rose-700">✕ 0 Unavailable (Set Protected)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setViewingInventoryProduct(null)}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
