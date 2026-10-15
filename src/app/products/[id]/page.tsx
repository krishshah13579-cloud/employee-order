"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Layers,
  FilePlus,
  ShieldCheck,
  CheckCircle2,
  Truck,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { useToast } from "@/components/ui/Toast";
import {
  formatCurrency,
  getProductCoverImage,
  getProductAllImages,
} from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  getAvailableSetsForColor,
  getTotalAvailableSets,
  parseColorwiseSets,
} from "@/lib/stock";
import type { ProductData, ColorSetEntry } from "@/lib/types";

// Standard Size Guide rows
const DEFAULT_SIZE_GUIDE = [
  { brandSize: "28", waist: '28"', length: '39"' },
  { brandSize: "30", waist: '30"', length: '40"' },
  { brandSize: "32", waist: '32"', length: '40.5"' },
  { brandSize: "34", waist: '34"', length: '41"' },
  { brandSize: "36", waist: '36"', length: '41.5"' },
  { brandSize: "38", waist: '38"', length: '42"' },
  { brandSize: "40", waist: '40"', length: '42.5"' },
];

function ProductDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const productId = params?.id as string;
  const returnTo = searchParams.get("returnTo") || "/orders/new";

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Multiple Color Selection State: Map of colorName -> sets count
  const [colorSetsSelection, setColorSetsSelection] = useState<Record<string, number>>({});

  // Size Guide Collapse Toggle
  const [sizeGuideOpen, setSizeGuideOpen] = useState<boolean>(false);

  // Notes
  const [itemNotes, setItemNotes] = useState<string>("");

  // Fetch single product
  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/products/${productId}`);
        if (!res.ok) {
          throw new Error(`Failed to load product #${productId} (${res.status})`);
        }
        const data: ProductData = await res.json();
        setProduct(data);

        // Pre-initialize color sets selection to 0
        const colors = (data.colorsAvailable || "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);

        const initial: Record<string, number> = {};
        colors.forEach((col) => {
          initial[col] = 0;
        });
        setColorSetsSelection(initial);
      } catch (err: any) {
        console.error("Error loading product:", err);
        setError(err.message || "Failed to load product details");
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  // All colors for this product (hide out-of-stock colors from employee panel)
  const availableColors = useMemo(() => {
    if (!product?.colorsAvailable) return [];
    const colors = product.colorsAvailable
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    // If any color is out of stock, don't show it on employee panel
    return colors.filter((color) => {
      if (!product.setsColorwise || !product.setsColorwise.trim()) return true;
      const stock = getAvailableSetsForColor(product.setsColorwise, color);
      return stock > 0;
    });
  }, [product]);

  // Size guide synced with product database
  const sizeGuideData = useMemo(() => {
    if (product?.sizeGuide) {
      try {
        const parsed = Array.isArray(product.sizeGuide)
          ? product.sizeGuide
          : JSON.parse(product.sizeGuide);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => ({
            brandSize: String(r.brandSize || ""),
            waist: r.waist
              ? String(r.waist).includes('"') || String(r.waist).includes("cm")
                ? String(r.waist)
                : `${r.waist}"`
              : "-",
            length: r.length
              ? String(r.length).includes('"') || String(r.length).includes("cm")
                ? String(r.length)
                : `${r.length}"`
              : "-",
          }));
        }
      } catch {}
    }
    return DEFAULT_SIZE_GUIDE;
  }, [product]);

  // Images list
  const allImages = useMemo(() => {
    if (!product?.imageUrl) return [];
    return getProductAllImages(product.imageUrl);
  }, [product]);

  // Colorwise available stock lookup
  const colorStockMap = useMemo(() => {
    if (!product?.setsColorwise) return {};
    return parseColorwiseSets(product.setsColorwise);
  }, [product]);

  // Handle color set count change with strict stock cap
  const handleSetChange = (color: string, requestedSets: number) => {
    const maxStock = getAvailableSetsForColor(product?.setsColorwise, color);
    const validCount = Math.max(0, Math.min(requestedSets, maxStock));

    if (requestedSets > maxStock) {
      toast(`Maximum available stock for ${color} is ${maxStock} sets`, "error");
    }

    setColorSetsSelection((prev) => ({
      ...prev,
      [color]: validCount,
    }));
  };

  // Helper: Select 1 set of each available color
  const handleSelectOneEach = () => {
    const updated: Record<string, number> = {};
    availableColors.forEach((color) => {
      const maxStock = getAvailableSetsForColor(product?.setsColorwise, color);
      updated[color] = maxStock > 0 ? 1 : 0;
    });
    setColorSetsSelection(updated);
    toast("Selected 1 set of each available color");
  };

  // Helper: Clear all selection
  const handleClearSelection = () => {
    const cleared: Record<string, number> = {};
    availableColors.forEach((col) => {
      cleared[col] = 0;
    });
    setColorSetsSelection(cleared);
  };

  // Selected Color Sets list
  const selectedEntries: ColorSetEntry[] = useMemo(() => {
    return Object.entries(colorSetsSelection)
      .filter(([_, sets]) => sets > 0)
      .map(([color, sets]) => ({ color, sets }));
  }, [colorSetsSelection]);

  // Wholesale Calculations
  const pcsPerSet = product?.pcsPerSet || 5;
  const totalSets = selectedEntries.reduce((sum, item) => sum + item.sets, 0);
  const totalPcs = totalSets * pcsPerSet;
  const unitPrice = product?.price || 0;
  const totalAmount = totalPcs * unitPrice;

  // Add To Order Form Action
  const handleAddToOrderForm = () => {
    if (!product) return;

    if (totalSets === 0 || selectedEntries.length === 0) {
      toast("Please select at least 1 set of any color", "error");
      return;
    }

    // Verify stock limits
    for (const entry of selectedEntries) {
      const maxStock = getAvailableSetsForColor(product.setsColorwise, entry.color);
      if (entry.sets > maxStock) {
        toast(
          `Cannot add ${entry.sets} sets for ${entry.color}. Only ${maxStock} available in stock.`,
          "error"
        );
        return;
      }
    }

    // Prepare wholesale draft item
    const draftItem = {
      productId: product.id,
      productName: product.name,
      category: product.category,
      imageUrl: getProductCoverImage(product.imageUrl),
      colorSets: selectedEntries,
      sizeRatio: product.sizesRatio,
      sizesList: product.sizesList,
      pcsPerSet: pcsPerSet,
      totalSets: totalSets,
      totalPcs: totalPcs,
      unitPrice: unitPrice,
      itemSubtotal: totalAmount,
      notes: itemNotes.trim() || undefined,
    };

    try {
      const existingDraftStr = localStorage.getItem("garmentpro_order_draft");
      let draft: any = { items: [] };
      if (existingDraftStr) {
        try {
          draft = JSON.parse(existingDraftStr) || { items: [] };
        } catch {
          draft = { items: [] };
        }
      }

      if (!Array.isArray(draft.items)) {
        draft.items = [];
      }

      // Check if product already exists in draft, if so update it or append
      const existingIndex = draft.items.findIndex(
        (it: any) => it.productId === product.id
      );

      if (existingIndex >= 0) {
        draft.items[existingIndex] = draftItem;
      } else {
        draft.items.push(draftItem);
      }

      localStorage.setItem("garmentpro_order_draft", JSON.stringify(draft));
      window.dispatchEvent(new Event("garmentpro_draft_updated"));

      toast(`Added ${product.name} (${totalSets} sets, ${totalPcs} pcs) to Order Form!`);
      router.push(returnTo);
    } catch (err: any) {
      console.error("Error saving to draft:", err);
      toast("Failed to update order draft: " + err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50">
        <UserHeader showBack />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
          <p className="text-xs text-slate-500 mt-2">{error || "Invalid product ID"}</p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            <ArrowLeft size={16} />
            <span>Return to Catalog</span>
          </Link>
        </div>
      </div>
    );
  }

  const coverImage =
    allImages.length > 0
      ? allImages[activeImageIndex] || allImages[0]
      : getProductCoverImage(product.imageUrl);

  const totalProductStock = getTotalAvailableSets(product.setsColorwise);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <UserHeader showBack />

      {/* Breadcrumb & Navigation */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/" className="hover:text-white transition">
              Home
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-white transition">
              Products
            </Link>
            <span>/</span>
            <span className="text-orange-400 font-bold">{product.name}</span>
          </div>

          <Link
            href={returnTo}
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold transition"
          >
            <ArrowLeft size={14} />
            <span>Back to Order Form</span>
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ═══════════════════════════════════════════
              LEFT COLUMN: PRODUCT IMAGES & DETAILS
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6">
            {/* Main Cover Image */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-3">
              <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden">
                <img
                  src={coverImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='600' fill='%2394a3b8'>Garment Photo</text></svg>";
                  }}
                />

                <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-orange-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg border border-slate-700/60 shadow-sm">
                  {product.category}
                </span>

                <span
                  className={`absolute bottom-3 right-3 text-xs font-bold px-3 py-1 rounded-lg backdrop-blur-md shadow-sm ${
                    totalProductStock > 0
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                      : "bg-red-950/80 text-red-300 border border-red-700/60"
                  }`}
                >
                  {totalProductStock > 0 ? "In Stock" : "Out of Stock"}
                </span>
              </div>

              {/* Thumbnails row */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                  {allImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                        activeImageIndex === idx
                          ? "border-orange-500 ring-2 ring-orange-500/30"
                          : "border-slate-200 hover:border-slate-400 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Wholesale Specs Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  {product.name}
                </h1>
                <div className="text-xs font-semibold text-slate-500 mt-0.5">
                  Category: <span className="text-slate-800 font-bold">{product.category}</span>
                </div>
              </div>

              {/* Pricing & Packaging Formula */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-orange-50/60 rounded-xl border border-orange-200/60">
                <div>
                  <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    Wholesale Price
                  </div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {formatCurrency(product.price)}
                    <span className="text-xs font-semibold text-slate-500 ml-1">/ pc</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    Packaging Ratio
                  </div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {product.pcsPerSet || 5} Pcs
                    <span className="text-xs font-semibold text-slate-500 ml-1">/ set</span>
                  </div>
                </div>
              </div>

              {/* Mandatory Size Ratio */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-bold">Mandatory Size Ratio:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {product.sizesRatio}
                  </span>
                </div>
              </div>

              {/* Collapsible Size Guide */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(!sizeGuideOpen)}
                  className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-700 hover:text-orange-600 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-orange-500" />
                    <span>Trouser Size Guide & Measurements</span>
                  </span>
                  {sizeGuideOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {sizeGuideOpen && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                          <th className="py-1 px-2">Brand Size</th>
                          <th className="py-1 px-2">Waist</th>
                          <th className="py-1 px-2">Length</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono">
                        {sizeGuideData.map((row, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 font-bold text-slate-800">
                              {row.brandSize}
                            </td>
                            <td className="py-1 px-2 text-slate-600">{row.waist}</td>
                            <td className="py-1 px-2 text-slate-600">{row.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Craftsmanship & Wholesale Perks */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-orange-500 shrink-0" />
                  <span>0.5&quot; Concealed Adaptive Flex Waistband for all-day comfort</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-orange-500 shrink-0" />
                  <span>Mastercrafted by Krish Clothing Co. with reinforced seams</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-orange-500 shrink-0" />
                  <span>Factory-gate wholesale packaging with prompt dispatch</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              RIGHT COLUMN: MULTIPLE COLOR SELECTION AT ONCE
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6">
              {/* Header with Quick Select Helpers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>Select Colors & Sets (Multiple At Once)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter the number of sets required for each color below. Total pieces and amount update live.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectOneEach}
                    className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                  >
                    <Sparkles size={13} />
                    <span>+1 Each</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                  >
                    <RotateCcw size={13} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* ═══════════════════════════════════════════
                  COLORS SELECTION TABLE / MATRIX
                  ═══════════════════════════════════════════ */}
              <div className="space-y-3">
                {availableColors.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">
                    No color variants specified for this product.
                  </p>
                ) : (
                  availableColors.map((color) => {
                    const hex = getColorHex(color).hex;
                    const stock = getAvailableSetsForColor(product.setsColorwise, color);
                    const currentSets = colorSetsSelection[color] || 0;
                    const calculatedColorPcs = currentSets * pcsPerSet;
                    const isOutOfStock = stock <= 0;

                    return (
                      <div
                        key={color}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                          currentSets > 0
                            ? "bg-orange-50/70 border-orange-300 shadow-xs"
                            : isOutOfStock
                            ? "bg-slate-50 border-slate-200 opacity-60"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Swatch + Color Name + Stock */}
                          <div className="flex items-center gap-3">
                            <span
                              className="w-7 h-7 rounded-full border border-slate-300 shadow-sm shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: hex }}
                            >
                              {currentSets > 0 && (
                                <Check size={14} className="text-white drop-shadow-md stroke-[3]" />
                              )}
                            </span>

                            <div>
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span>{color}</span>
                                {currentSets > 0 && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-600 text-white">
                                    {currentSets} {currentSets === 1 ? "Set" : "Sets"} ({calculatedColorPcs} Pcs)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>In Stock</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Quantity Selector (+/- sets) */}
                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                              <button
                                type="button"
                                disabled={currentSets <= 0 || isOutOfStock}
                                onClick={() => handleSetChange(color, currentSets - 1)}
                                className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                                aria-label="Decrease sets"
                              >
                                <Minus size={15} />
                              </button>

                              <input
                                type="number"
                                min={0}
                                max={stock}
                                disabled={isOutOfStock}
                                value={currentSets === 0 ? "" : currentSets}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  handleSetChange(color, isNaN(val) ? 0 : val);
                                }}
                                className="w-14 h-9 text-center font-bold text-slate-900 text-sm focus:outline-none focus:bg-orange-50/50"
                              />

                              <button
                                type="button"
                                disabled={currentSets >= stock || isOutOfStock}
                                onClick={() => handleSetChange(color, currentSets + 1)}
                                className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                                aria-label="Increase sets"
                              >
                                <Plus size={15} />
                              </button>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 w-12 text-right hidden sm:inline">
                              Sets
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Special Order Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item Notes / Special Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special packing, urgent delivery, hanger pack..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                />
              </div>

              {/* ═══════════════════════════════════════════
                  ORDER CALCULATION SUMMARY & ADD TO ORDER BUTTON
                  ═══════════════════════════════════════════ */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Live Order Calculation
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {product.name}
                  </div>
                </div>

                {/* Selected Colors Breakdown */}
                {selectedEntries.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    <div className="text-slate-400 text-[11px] font-semibold mb-1">
                      Selected Color Sets Breakdown:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntries.map((entry) => (
                        <span
                          key={entry.color}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: getColorHex(entry.color).hex }}
                          />
                          <span className="font-bold text-white">{entry.color}:</span>
                          <span className="text-orange-400 font-bold">
                            {entry.sets} {entry.sets === 1 ? "set" : "sets"} ({entry.sets * pcsPerSet} pcs)
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Select sets for any of the colors above to see the live total.
                  </p>
                )}

                {/* Math Row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Total Sets
                    </div>
                    <div className="text-lg font-black text-orange-400">
                      {totalSets}
                    </div>
                  </div>

                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Total Pieces
                    </div>
                    <div className="text-lg font-black text-white">
                      {totalPcs} <span className="text-xs font-normal text-slate-400">Pcs</span>
                    </div>
                  </div>

                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Item Subtotal
                    </div>
                    <div className="text-lg font-black text-emerald-400">
                      {formatCurrency(totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Big Action Button */}
                <button
                  type="button"
                  disabled={totalSets === 0}
                  onClick={handleAddToOrderForm}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base rounded-xl shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <FilePlus size={20} />
                  <span>Add To Order Form ({totalSets} Sets · {totalPcs} Pcs)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
