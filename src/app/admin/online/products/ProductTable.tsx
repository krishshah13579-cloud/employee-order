"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Edit2, Trash2, AlertTriangle, Eye, EyeOff, Package, Plus, Boxes, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  price: number;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [viewingInventoryProduct, setViewingInventoryProduct] = useState<ProductItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeletingId(productToDelete.id);
    setError(null);

    try {
      const res = await fetch(`/api/online/products/${productToDelete.id}/delete`, {
        method: "POST",
      });

      if (!res.ok) {
        // Fallback to DELETE /api/online/products/:id if delete route fails
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
      const cleanMsg =
        rawMsg.includes("did not match the expected pattern") || rawMsg.includes("Unexpected token")
          ? "Failed to delete product. Please try again."
          : rawMsg;
      setError(cleanMsg);
    } finally {
      setDeletingId(null);
    }
  };

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const getFirstImage = (imagesStr?: string | null): string => {
    if (!imagesStr) return "";
    try {
      const parsed = JSON.parse(imagesStr);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
        return String(parsed[0]).trim();
      }
      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.trim();
      }
    } catch {
      // not JSON array
    }
    if (typeof imagesStr === "string" && imagesStr.trim()) {
      if (imagesStr.startsWith("data:")) {
        return imagesStr.trim();
      }
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

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {products.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-400">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                No products in inventory
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                All products have been removed. You can now add your own trousers and formal wear styles.
              </p>
              <Link
                href="/admin/online/products/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Product</span>
              </Link>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-700 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-5 py-3">Product</th>
                  <th scope="col" className="px-5 py-3">Category</th>
                  <th scope="col" className="px-5 py-3">Price</th>
                  <th scope="col" className="px-5 py-3">Stock</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const imageSrc = getFirstImage(product.images);
                  const photoCount = getImageCount(product.images);
                  const hasValidImage = isValidImageSrc(imageSrc) && !imageErrors[product.id];
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
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
                      <td className="px-5 py-3.5 text-gray-700 font-medium">
                        {product.category?.name || "Uncategorized"}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {formatPrice(product.price)}
                      </td>
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
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-black hover:underline"
                          >
                            <Boxes className="w-3 h-3 text-gray-500" />
                            <span>Variants</span>
                          </button>
                        </div>
                      </td>
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
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

      {/* Confirmation Modal */}
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
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Breakdown Modal */}
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
                      {viewingInventoryProduct.name} — Inventory Breakdown
                    </h3>
                    <p className="text-xs text-gray-500">
                      Waist sizes and color availability for this formal trouser
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingInventoryProduct(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                      qty === 0
                                        ? "bg-rose-100 text-rose-800"
                                        : qty <= 5
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {qty}
                                  </span>
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
                          let colSum = 0;
                          colorsList.forEach(c => {
                            colSum += invMap[c]?.[size] ?? 0;
                          });
                          return (
                            <td key={size} className="p-2.5 text-center">
                              {colSum}
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-center bg-gray-200 text-black">
                          {viewingInventoryProduct.stock}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Link
                  href={`/admin/online/products/${viewingInventoryProduct.id}/edit#inventory-matrix`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-gray-800 rounded-xl transition-colors shadow-2xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Availability in Form</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setViewingInventoryProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
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
