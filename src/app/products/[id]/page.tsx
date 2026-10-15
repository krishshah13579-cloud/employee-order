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
  Palette,
} from "lucide-react";
import StoreLayoutShell from "@/components/layout/StoreLayoutShell";
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
  getAllProductColors,
  cleanColorName,
} from "@/lib/stock";
import { STANDARD_SIZE_RATIOS } from "@/lib/types";
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

  // Active Selected Color (defaults to first available color)
  const [selectedColor, setSelectedColor] = useState<string>("");

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Size Guide Collapse Toggle
  const [sizeGuideOpen, setSizeGuideOpen] = useState<boolean>(false);

  // Notes
  const [itemNotes, setItemNotes] = useState<string>("");

  // Multi-ratio sets structure:
  // color -> { [ratio: string]: number }
  // e.g. colorRatioSelection["Navy Blue"]["30 to 38"] = 5
  //      colorRatioSelection["Navy Blue"]["32 to 38"] = 1
  const [colorRatioSelection, setColorRatioSelection] = useState<
    Record<string, Record<string, number>>
  >({});

  // Active Draft Customer (to detect Retailer vs Wholesaler price)
  const [draftCustomer, setDraftCustomer] = useState<{
    id?: number;
    shopName?: string;
    businessType?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("garmentpro_order_draft");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.customer) {
          setDraftCustomer(parsed.customer);
        }
      }
    } catch {}
  }, []);

  // Fetch single product
  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/products/${productId}?full_images=1`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load product #${productId} (${res.status})`);
        }
        const data: ProductData = await res.json();
        setProduct(data);

        const colors = getAllProductColors(
          data.colorsAvailable,
          data.setsColorwise,
          data.colorMapping
        );

        // Pre-initialize ratio selection for primary ratio
        const primaryRatio = data.sizesRatio || "30 to 38";
        const initialMap: Record<string, Record<string, number>> = {};
        colors.forEach((col) => {
          initialMap[col] = {
            [primaryRatio]: 0,
            "32 to 38": 0,
          };
        });
        setColorRatioSelection(initialMap);

        if (colors.length > 0) {
          setSelectedColor(colors[0]);
        }
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
    if (!product) return [];
    const colors = getAllProductColors(
      product.colorsAvailable,
      product.setsColorwise,
      product.colorMapping
    );

    // If any color is out of stock, don't show it on employee panel
    return colors.filter((color) => {
      if (!product.setsColorwise || !product.setsColorwise.trim()) return true;
      const stock = getAvailableSetsForColor(
        product.setsColorwise,
        color,
        product.colorMapping
      );
      return stock > 0;
    });
  }, [product]);

  // Set default selected color once availableColors is ready
  useEffect(() => {
    if (availableColors.length > 0 && (!selectedColor || !availableColors.includes(selectedColor))) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors, selectedColor]);

  // Images list
  const allImages = useMemo(() => {
    if (!product?.imageUrl) return [];
    return getProductAllImages(product.imageUrl);
  }, [product]);

  // When selected color changes:
  // "WHEN COLOR IS SELECTED THAT COLOR PRODUCT PHOTO APPEARS"
  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    const colorIdx = availableColors.indexOf(color);
    if (colorIdx >= 0 && colorIdx < allImages.length) {
      setActiveImageIndex(colorIdx);
    } else if (allImages.length > 0 && activeImageIndex >= allImages.length) {
      setActiveImageIndex(0);
    }
  };

  // Size guide synced with product database and strictly filtered to available sizes
  const sizeGuideData = useMemo(() => {
    let rows = DEFAULT_SIZE_GUIDE;
    if (product?.sizeGuide) {
      try {
        const parsed = Array.isArray(product.sizeGuide)
          ? product.sizeGuide
          : JSON.parse(product.sizeGuide);
        if (Array.isArray(parsed) && parsed.length > 0) {
          rows = parsed.map((r: any) => ({
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

    // Filter strictly to sizes that are available for this particular product
    const sizesStr = product?.sizesList || product?.sizesRatio || "";
    if (sizesStr) {
      const allowedSizes = sizesStr
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const filtered = rows.filter((r) =>
        allowedSizes.includes(r.brandSize.toLowerCase())
      );
      if (filtered.length > 0) return filtered;
    }

    return rows;
  }, [product]);

  // Ratio options available for ordering
  const availableRatios = useMemo(() => {
    const list: { ratio: string; sizes: string; pcs: number }[] = [];
    const primary = product?.sizesRatio || "30 to 38";
    const primarySizes = product?.sizesList || "30, 32, 34, 36, 38";
    const primaryPcs = product?.pcsPerSet || 5;

    list.push({ ratio: primary, sizes: primarySizes, pcs: primaryPcs });

    // Add 32 to 38 as requested by user
    if (primary !== "32 to 38") {
      list.push({ ratio: "32 to 38", sizes: "32, 34, 36, 38", pcs: 4 });
    }

    // Add standard ratios if not already present
    STANDARD_SIZE_RATIOS.forEach((sr) => {
      if (!list.some((it) => it.ratio === sr.value)) {
        list.push({ ratio: sr.value, sizes: sr.sizes, pcs: sr.pcs });
      }
    });

    return list;
  }, [product]);

  // Helper: Get pieces per set for a given ratio
  const getPcsForRatio = (ratioVal: string): number => {
    const found = availableRatios.find((r) => r.ratio === ratioVal);
    if (found) return found.pcs;
    if (ratioVal === product?.sizesRatio) return product?.pcsPerSet || 5;
    return 5;
  };

  // Handle set count change for a specific color and specific ratio
  const handleRatioSetChange = (color: string, ratioVal: string, requestedSets: number) => {
    const maxStock = getAvailableSetsForColor(
      product?.setsColorwise,
      color,
      product?.colorMapping
    );

    // Compute current total sets for this color across all OTHER ratios
    const currentColorRatios = colorRatioSelection[color] || {};
    let otherSets = 0;
    for (const [r, cnt] of Object.entries(currentColorRatios)) {
      if (r !== ratioVal) otherSets += cnt;
    }

    const availableForThisRatio = Math.max(0, maxStock - otherSets);
    const validCount = Math.max(0, Math.min(requestedSets, availableForThisRatio));

    if (requestedSets > availableForThisRatio) {
      toast(
        `Total available sets for ${color} is ${maxStock} sets (${otherSets} allocated to other ratios)`,
        "error"
      );
    }

    setColorRatioSelection((prev) => ({
      ...prev,
      [color]: {
        ...(prev[color] || {}),
        [ratioVal]: validCount,
      },
    }));
  };

  // Helper: Select 1 set of each available color (primary ratio)
  const handleSelectOneEach = () => {
    const primaryRatio = product?.sizesRatio || "30 to 38";
    const nextMap: Record<string, Record<string, number>> = {};

    availableColors.forEach((color) => {
      const maxStock = getAvailableSetsForColor(
        product?.setsColorwise,
        color,
        product?.colorMapping
      );
      nextMap[color] = {
        ...(colorRatioSelection[color] || {}),
        [primaryRatio]: maxStock > 0 ? 1 : 0,
      };
    });

    setColorRatioSelection(nextMap);
    toast("Selected 1 set of each available color");
  };

  // Helper: Clear all selection
  const handleClearSelection = () => {
    const primaryRatio = product?.sizesRatio || "30 to 38";
    const cleared: Record<string, Record<string, number>> = {};
    availableColors.forEach((col) => {
      cleared[col] = {
        [primaryRatio]: 0,
        "32 to 38": 0,
      };
    });
    setColorRatioSelection(cleared);
  };

  // Calculate total sets and total pcs across all colors and all ratios
  const calculationSummary = useMemo(() => {
    let grandTotalSets = 0;
    let grandTotalPcs = 0;
    const entries: any[] = [];

    for (const color of availableColors) {
      const ratios = colorRatioSelection[color] || {};
      let colorSets = 0;
      let colorPcs = 0;
      const ratioBreakdown: any[] = [];

      for (const [ratio, count] of Object.entries(ratios)) {
        if (count > 0) {
          const pcsInRatio = count * getPcsForRatio(ratio);
          colorSets += count;
          colorPcs += pcsInRatio;
          const ratioObj = availableRatios.find((ar) => ar.ratio === ratio);
          ratioBreakdown.push({
            ratio,
            sizes: ratioObj?.sizes || ratio,
            pcsPerSet: getPcsForRatio(ratio),
            sets: count,
            pcs: pcsInRatio,
          });
        }
      }

      if (colorSets > 0) {
        grandTotalSets += colorSets;
        grandTotalPcs += colorPcs;
        entries.push({
          color,
          sets: colorSets,
          pcs: colorPcs,
          ratioSets: ratioBreakdown,
        });
      }
    }

    return {
      totalSets: grandTotalSets,
      totalPcs: grandTotalPcs,
      entries,
    };
  }, [availableColors, colorRatioSelection, availableRatios]);

  // Pricing calculations
  const isWholesaler = draftCustomer?.businessType === "WHOLESALER";
  const retPrice = product?.retailerPrice ?? product?.price ?? 0;
  const whoPrice = product?.wholesalerPrice ?? Math.max(0, retPrice - 100);
  const unitPrice = isWholesaler ? whoPrice : retPrice;
  const totalAmount = calculationSummary.totalPcs * unitPrice;

  // Add To Order Form Action
  const handleAddToOrderForm = () => {
    if (!product) return;

    if (calculationSummary.totalSets === 0 || calculationSummary.entries.length === 0) {
      toast("Please select at least 1 set of any color", "error");
      return;
    }

    // Prepare wholesale draft item
    const draftItem = {
      productId: product.id,
      productName: product.name,
      category: product.category,
      imageUrl: getProductCoverImage(product.imageUrl),
      colorSets: calculationSummary.entries,
      sizeRatio: product.sizesRatio,
      sizesList: product.sizesList,
      pcsPerSet: product.pcsPerSet || 5,
      totalSets: calculationSummary.totalSets,
      totalPcs: calculationSummary.totalPcs,
      retailerPrice: retPrice,
      wholesalerPrice: whoPrice,
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

      toast(
        `Added ${product.name} (${calculationSummary.totalSets} sets, ${calculationSummary.totalPcs} pcs) to Order Form!`
      );
      router.push(returnTo);
    } catch (err: any) {
      console.error("Error saving to draft:", err);
      toast("Failed to update order draft: " + err.message, "error");
    }
  };

  if (loading) {
    return (
      <StoreLayoutShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-600">Loading garment details & stock...</p>
        </div>
      </StoreLayoutShell>
    );
  }

  if (error || !product) {
    return (
      <StoreLayoutShell>
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
      </StoreLayoutShell>
    );
  }

  const coverImage =
    allImages.length > 0
      ? allImages[activeImageIndex] || allImages[0]
      : getProductCoverImage(product.imageUrl);

  const totalProductStock = getTotalAvailableSets(product.setsColorwise);

  return (
    <StoreLayoutShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-slate-900 transition">
              Products
            </Link>
            <span>/</span>
            <span className="text-orange-600 font-bold">{product.name}</span>
          </div>

          <Link
            href={returnTo}
            className="text-xs text-slate-600 hover:text-black flex items-center gap-1.5 font-bold transition"
          >
            <ArrowLeft size={14} />
            <span>Back to Order Form</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ═══════════════════════════════════════════
              LEFT COLUMN: PRODUCT PHOTO (CHANGES WITH COLOR) & DETAILS
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-5">
            {/* Main Product Photo - Dynamically updates when color is selected */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-3">
              <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden group">
                <img
                  src={coverImage}
                  alt={`${product.name} - ${selectedColor}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='600' fill='%2394a3b8'>Garment Photo</text></svg>";
                  }}
                />

                {/* Selected Color Badge on Photo */}
                {selectedColor && (
                  <span className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-md flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-white/30"
                      style={{ backgroundColor: getColorHex(selectedColor).hex }}
                    />
                    <span>{selectedColor}</span>
                  </span>
                )}

                {/* Category & Stock Badges */}
                <span className="absolute bottom-3 right-3 text-xs font-bold px-3 py-1 rounded-lg backdrop-blur-md shadow-sm bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                  {totalProductStock > 0 ? `${totalProductStock} Sets Ready` : "Out of Stock"}
                </span>
              </div>

              {/* Multiple Color Gallery Preview Dots / Thumbnails */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                  {allImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                        activeImageIndex === idx
                          ? "border-orange-500 ring-2 ring-orange-500/30"
                          : "border-slate-200 hover:border-slate-400 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Meta & Pricing Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                  {product.category}
                </span>
                <h1 className="text-xl font-black text-slate-900 mt-1">{product.name}</h1>
              </div>

              {/* Rate & Selling Price */}
              <div className="p-3.5 bg-orange-50/70 rounded-xl border border-orange-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">
                    Selling Rate / PC
                  </span>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                    {formatCurrency(unitPrice)}
                    <span className="text-xs font-semibold text-slate-500 font-sans ml-1">/ pc</span>
                  </div>
                  {draftCustomer && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      Applied for {draftCustomer.shopName}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Primary Ratio
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {product.sizesRatio}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {product.pcsPerSet || 5} Pcs / Set
                  </span>
                </div>
              </div>

              {/* Size Guide Collapsible (Takes only available sizes for this product) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(!sizeGuideOpen)}
                  className="w-full flex items-center justify-between py-2 text-xs font-bold text-slate-700 hover:text-orange-600 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-orange-500" />
                    <span>Trouser Size Guide & Measurements</span>
                  </span>
                  {sizeGuideOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {sizeGuideOpen && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-200">
                    <div className="text-[10px] text-slate-500 mb-2 font-semibold">
                      Sizes available for this product: <span className="font-mono text-slate-900 font-bold">{product.sizesList || product.sizesRatio}</span>
                    </div>
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
                            <td className="py-1 px-2 font-bold text-slate-800">{row.brandSize}</td>
                            <td className="py-1 px-2 text-slate-600">{row.waist}</td>
                            <td className="py-1 px-2 text-slate-600">{row.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quality Perks */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-orange-500 shrink-0" />
                  <span>Concealed Adaptive Flex Waistband for maximum all-day comfort</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-orange-500 shrink-0" />
                  <span>Krish Clothing Co. reinforced double-stitch tailoring</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              RIGHT COLUMN: MULTIPLE COLORS & SETS ORDERING BELOW PHOTO
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
              {/* Header with Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Palette size={20} className="text-orange-500" />
                    <span>Select Color & Order Sets</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any color to preview its product photo, then order sets by size ratio (e.g. 30 to 38, 32 to 38).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectOneEach}
                    className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>+1 Each</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* 1. Multiple Color Selector Cards (Clicking switches photo immediately) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
                  Step 1: Choose Garment Color (Photo Updates Instantly)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableColors.map((color) => {
                    const hex = getColorHex(color).hex;
                    const stock = getAvailableSetsForColor(
                      product.setsColorwise,
                      color,
                      product.colorMapping
                    );
                    const isSelected = selectedColor === color;

                    // Calculate total sets ordered for this color across all ratios
                    const ratios = colorRatioSelection[color] || {};
                    let totalSetsForColor = 0;
                    for (const cnt of Object.values(ratios)) {
                      totalSetsForColor += cnt;
                    }

                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        className={`p-3 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? "border-orange-500 bg-orange-50/70 shadow-sm ring-1 ring-orange-500/30"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full border border-black/15 shrink-0 shadow-2xs"
                            style={{ backgroundColor: hex }}
                          />
                          <div className="truncate">
                            <div className="font-bold text-slate-900 text-xs truncate">
                              {color}
                            </div>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Stock: {stock}s
                            </span>
                          </div>
                        </div>

                        {totalSetsForColor > 0 && (
                          <span className="px-2 py-0.5 bg-orange-600 text-white font-black text-[10px] rounded-full shrink-0 font-mono">
                            {totalSetsForColor}s
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Sets Ordering for Selected Color by Size Ratio */}
              {selectedColor && (
                <div className="p-4 sm:p-5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: getColorHex(selectedColor).hex }}
                      />
                      <span className="font-black text-sm text-slate-900">
                        Order Sets for {selectedColor}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">
                      Max Stock:{" "}
                      <strong className="text-emerald-700 font-mono">
                        {getAvailableSetsForColor(product.setsColorwise, selectedColor, product.colorMapping)} sets
                      </strong>
                    </span>
                  </div>

                  {/* Size Ratio Rows for this color: e.g. 30 to 38 -> 5 set and 32 to 38 -> 1 set */}
                  <div className="space-y-3">
                    {availableRatios.slice(0, 4).map((rObj) => {
                      const ratioVal = rObj.ratio;
                      const pcsInSet = rObj.pcs;
                      const setsCount = colorRatioSelection[selectedColor]?.[ratioVal] || 0;
                      const totalPcsInRatio = setsCount * pcsInSet;

                      return (
                        <div
                          key={ratioVal}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            setsCount > 0
                              ? "bg-white border-orange-300 shadow-xs"
                              : "bg-white/80 border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-xs font-mono">
                                Ratio: {ratioVal}
                              </span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {pcsInSet} Pcs / Set
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              Sizes: [{rObj.sizes}]
                            </span>
                          </div>

                          {/* Sets Counter for this ratio */}
                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {setsCount > 0 && (
                              <span className="text-xs font-bold text-orange-600 font-mono">
                                = {totalPcsInRatio} pcs
                              </span>
                            )}
                            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                              <button
                                type="button"
                                disabled={setsCount <= 0}
                                onClick={() =>
                                  handleRatioSetChange(selectedColor, ratioVal, setsCount - 1)
                                }
                                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white transition cursor-pointer"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min={0}
                                value={setsCount === 0 ? "" : setsCount}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  handleRatioSetChange(selectedColor, ratioVal, isNaN(val) ? 0 : val);
                                }}
                                className="w-12 h-8 text-center font-black font-mono text-slate-900 text-xs focus:outline-none focus:bg-orange-50/50"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleRatioSetChange(selectedColor, ratioVal, setsCount + 1)
                                }
                                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <span className="text-xs font-semibold text-slate-500 w-8">
                              Sets
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Selected Colors Overview */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Configured Order Summary (All Colors)
                </label>
                {calculationSummary.entries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No sets added yet. Click on any color above and increase sets for 30 to 38 or 32 to 38.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {calculationSummary.entries.map((item: any) => (
                      <div
                        key={item.color}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: getColorHex(item.color).hex }}
                          />
                          <span className="font-bold text-slate-900">{item.color}:</span>
                          <span className="text-slate-600 font-mono">
                            {item.ratioSets
                              .map((r: any) => `${r.ratio} (${r.sets}s)`)
                              .join(", ")}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-orange-600">
                          {item.sets} Sets ({item.pcs} Pcs)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Special Instructions Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item Notes / Packaging Instructions (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5 sets in 30-38 and 1 set in 32-38 required..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                />
              </div>

              {/* Live Wholesale Totals & Action */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Live Order Calculation
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Rate: {formatCurrency(unitPrice)} / pc
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-800/80 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Sets</span>
                    <span className="text-xl font-black text-orange-400 font-mono">
                      {calculationSummary.totalSets}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Pieces</span>
                    <span className="text-xl font-black text-white font-mono">
                      {calculationSummary.totalPcs}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Subtotal</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddToOrderForm}
                  disabled={calculationSummary.totalSets === 0}
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:from-slate-700 disabled:to-slate-800 text-white rounded-xl text-sm font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <FilePlus size={18} />
                  <span>
                    Add to Order Form ({calculationSummary.totalSets} Sets, {calculationSummary.totalPcs} Pcs)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StoreLayoutShell>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <StoreLayoutShell>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-600">Loading product page...</p>
          </div>
        </StoreLayoutShell>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
