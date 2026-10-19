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
  Trash2,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { useToast } from "@/components/ui/Toast";
import {
  formatCurrency,
  getProductCoverImage,
  getProductAllImages,
  isGstPanRegistered,
} from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import {
  getAvailableSetsForColor,
  getTotalAvailableSets,
  parseColorwiseSets,
  getAllProductColors,
  getProductColorImage,
  cleanColorName,
  calculateOrderedColorSetsPieces,
  sortSizeRatioKeys,
  parseDetailedColorRatioSets,
  getPcsFromRatio,
  getSizesFromRatio,
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
        const res = await fetch(`/api/products/${productId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load product #${productId} (${res.status})`);
        }
        const data: ProductData = await res.json();
        setProduct(data);

        // Pre-initialize color sets selection from existing draft or 0 for all colors
        const colors = getAllProductColors(
          data.colorsAvailable,
          data.setsColorwise,
          data.colorMapping
        );

        const initial: Record<string, number> = {};
        colors.forEach((col) => {
          initial[col] = 0;
        });

        // Check if there is an existing draft item for this product
        try {
          const draftStr = localStorage.getItem("garmentpro_order_draft");
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            if (Array.isArray(draft.items)) {
              const existingItem = draft.items.find(
                (item: any) => String(item.productId) === String(data.id)
              );
              if (existingItem) {
                if (Array.isArray(existingItem.colorSets)) {
                  existingItem.colorSets.forEach((cs: any) => {
                    if (cs && cs.color && typeof cs.sets === "number") {
                      initial[cs.color] = cs.sets;
                    }
                  });
                  const firstWithQty = existingItem.colorSets.find((cs: any) => cs.sets > 0);
                  if (firstWithQty?.color) {
                    setActiveColor(firstWithQty.color);
                  }
                }
                if (existingItem.notes) {
                  setItemNotes(existingItem.notes);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error reading draft:", e);
        }

        // Auto-select 1 set for the first available color if draft has no sets yet
        const hasExisting = Object.values(initial).some((s) => s > 0);
        if (!hasExisting && colors.length > 0) {
          initial[colors[0]] = 1;
          setActiveColor(colors[0]);
        }

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

  // Custom colors added by the employee/customer directly
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [customColorInput, setCustomColorInput] = useState<string>("");

  // All colors for this product (takes all product colors automatically and any custom colors)
  const availableColors = useMemo(() => {
    if (!product) return [];
    const colors = getAllProductColors(
      product.colorsAvailable,
      product.setsColorwise,
      product.colorMapping
    );

    const merged = [...colors];
    customColors.forEach((cc) => {
      if (!merged.some((c) => c.toLowerCase() === cc.toLowerCase())) {
        merged.push(cc);
      }
    });

    return merged;
  }, [product, customColors]);

  // Active selected color for photo and quick sets order
  const [activeColor, setActiveColor] = useState<string>("");

  // Extract all available size ratios for this product from setsColorwise and product.sizesRatio
  const availableRatios = useMemo(() => {
    if (!product) return [];
    const ratioSet = new Set<string>();
    if (product.sizesRatio) {
      ratioSet.add(product.sizesRatio.trim());
    }
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
    // Strict business rule: "28 to 36" (5 pcs) FIRST, then "28 to 34" (4 pc set) SECOND
    return sortSizeRatioKeys(Array.from(ratioSet));
  }, [product]);

  // Selected Size Ratio state (defaults to 28 to 36 if present)
  const [selectedRatio, setSelectedRatio] = useState<string>("");

  useEffect(() => {
    if (availableRatios.length > 0 && (!selectedRatio || !availableRatios.includes(selectedRatio))) {
      setSelectedRatio(availableRatios[0]);
    }
  }, [availableRatios, selectedRatio]);

  const activeRatio = selectedRatio || availableRatios[0] || product?.sizesRatio || "28 to 36";
  const activePcsPerSet = getPcsFromRatio(activeRatio, product?.pcsPerSet || 5);

  // Extract all sizes available for this specific product (e.g. from activeRatio or sizesList)
  const productAvailableSizes = useMemo(() => {
    if (!product) return [];
    const sizesSet = new Set<string>();
    const ratioSizes = getSizesFromRatio(activeRatio);
    if (ratioSizes.length > 0 && ratioSizes[0] !== activeRatio) {
      ratioSizes.forEach((s) => sizesSet.add(s));
    } else if (product.sizesList) {
      product.sizesList
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => sizesSet.add(s));
    }
    return Array.from(sizesSet);
  }, [product, activeRatio]);

  // Size guide synced with product database and filtered to ONLY available sizes for this product
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

    // Filter ONLY sizes available for this particular product
    if (productAvailableSizes.length > 0) {
      const filtered = rows.filter((r) =>
        productAvailableSizes.some(
          (sz) => sz.toLowerCase() === r.brandSize.toLowerCase()
        )
      );
      if (filtered.length > 0) return filtered;
    }

    return rows;
  }, [product, productAvailableSizes]);

  // Synchronize activeColor with availableColors
  useEffect(() => {
    if (availableColors.length > 0 && (!activeColor || !availableColors.includes(activeColor))) {
      setActiveColor(availableColors[0]);
    }
  }, [availableColors, activeColor]);

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

  // Handle color set count change with flexible stock cap for custom shades
  const handleSetChange = (color: string, requestedSets: number) => {
    setActiveColor(color);
    const isCustom = customColors.some(
      (c) => c.toLowerCase() === color.toLowerCase()
    );
    const rawStock = getAvailableSetsForColor(
      product?.setsColorwise,
      color,
      product?.colorMapping
    );
    // Custom shades or products without inventory restriction can have up to 9999 sets
    const maxStock = isCustom || !product?.setsColorwise || rawStock <= 0 ? 9999 : rawStock;
    const validCount = Math.max(0, Math.min(requestedSets, maxStock));

    if (rawStock > 0 && requestedSets > rawStock && !isCustom) {
      toast(`Maximum available stock for ${color} is ${rawStock} sets`, "error");
    }

    setColorSetsSelection((prev) => ({
      ...prev,
      [color]: validCount,
    }));
  };

  // Helper: Add custom shade with live color palette recognition
  const handleAddCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    if (availableColors.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast(`Color "${trimmed}" is already in the list`, "info");
      setActiveColor(trimmed);
      if ((colorSetsSelection[trimmed] || 0) === 0) {
        handleSetChange(trimmed, 1);
      }
      setCustomColorInput("");
      return;
    }
    setCustomColors((prev) => [...prev, trimmed]);
    setActiveColor(trimmed);
    setColorSetsSelection((prev) => ({
      ...prev,
      [trimmed]: 1,
    }));
    setCustomColorInput("");
    toast(`Added shade "${trimmed}" with 1 set selected`);
  };

  // Helper: Remove a custom added shade
  const handleRemoveCustomColor = (colorToRemove: string) => {
    setCustomColors((prev) => prev.filter((c) => c.toLowerCase() !== colorToRemove.toLowerCase()));
    setColorSetsSelection((prev) => {
      const next = { ...prev };
      delete next[colorToRemove];
      return next;
    });
  };

  // Helper: Select 1 set of each available color
  const handleSelectOneEach = () => {
    const updated: Record<string, number> = {};
    availableColors.forEach((color) => {
      const isCustom = customColors.some((c) => c.toLowerCase() === color.toLowerCase());
      const maxStock = getAvailableSetsForColor(
        product?.setsColorwise,
        color,
        product?.colorMapping
      );
      updated[color] = isCustom || maxStock > 0 || !product?.setsColorwise ? 1 : 0;
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

  // Active Draft Customer (to detect Retailer vs Wholesaler price)
  const [draftCustomer, setDraftCustomer] = useState<{
    id?: number;
    shopName?: string;
    gstPanNo?: string;
    businessType?: string;
    specialDiscount?: number;
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

  // Wholesale Calculations & Dynamic Selling Price (Retailer vs Wholesaler)
  const pcsPerSet = activePcsPerSet;
  const totalSets = selectedEntries.reduce((sum, item) => sum + item.sets, 0);

  // Dynamically calculate accurate pieces across size ratio packs
  const colorPiecesMap = useMemo(() => {
    const map: Record<string, { totalPcs: number; breakdownText: string }> = {};
    for (const entry of selectedEntries) {
      const calc = calculateOrderedColorSetsPieces(
        product?.setsColorwise,
        entry.color,
        entry.sets,
        activePcsPerSet,
        activeRatio
      );
      map[entry.color] = calc;
    }
    return map;
  }, [product, selectedEntries, activePcsPerSet, activeRatio]);

  const totalPcs = useMemo(() => {
    return Object.values(colorPiecesMap).reduce((sum, item) => sum + item.totalPcs, 0);
  }, [colorPiecesMap]);

  const isWholesaler = draftCustomer?.businessType === "WHOLESALER" || draftCustomer?.businessType === "WHOLESALER WITHOUT GST";
  const isSpecialDiscount = draftCustomer?.businessType === "RETAILER WITH SPECIAL DISCOUNT";
  const specialDiscountAmt = isSpecialDiscount ? (Number(draftCustomer?.specialDiscount) || 0) : 0;
  const retPrice = product?.retailerPrice ?? product?.price ?? 0;
  const whoPrice = product?.wholesalerPrice ?? Math.max(0, retPrice - 100);
  const unitPrice = isWholesaler ? whoPrice : isSpecialDiscount ? Math.max(0, retPrice - specialDiscountAmt) : retPrice;
  const totalAmount = totalPcs * unitPrice;

  // Add To Order Form Action
  const handleAddToOrderForm = () => {
    if (!product) return;

    const storedCustomerId =
      typeof window !== "undefined"
        ? localStorage.getItem("garmentpro_selected_customer_id")
        : null;
    if (!draftCustomer && !storedCustomerId) {
      toast(
        "Mandatory: Customer selection is required before adding products to the order form. Please select a customer.",
        "error"
      );
      router.push("/orders/new");
      return;
    }

    if (draftCustomer && !isGstPanRegistered(draftCustomer.gstPanNo)) {
      toast(
        "Customer is NOT GST/PAN registered! Please enter and save GST/PAN details in the order form before adding products.",
        "error"
      );
      router.push("/orders/new");
      return;
    }

    if (totalSets === 0 || selectedEntries.length === 0) {
      toast("Mandatory: Please select at least 1 set of any color before adding to order form", "error");
      return;
    }

    // Verify stock limits (only for non-custom colors when inventory is tracked and positive)
    for (const entry of selectedEntries) {
      const isCustom = customColors.some(
        (c) => c.toLowerCase() === entry.color.toLowerCase()
      );
      const maxStock = getAvailableSetsForColor(
        product.setsColorwise,
        entry.color,
        product.colorMapping
      );
      if (!isCustom && maxStock > 0 && entry.sets > maxStock) {
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
      sizeRatio: activeRatio,
      sizesList: getSizesFromRatio(activeRatio).join(", ") || product.sizesList,
      pcsPerSet: activePcsPerSet,
      totalSets: totalSets,
      totalPcs: totalPcs,
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

  // Resolve photo based on active selected color
  const activeColorPhoto = activeColor
    ? getProductColorImage(product, activeColor)
    : (allImages[activeImageIndex] || allImages[0] || getProductCoverImage(product?.imageUrl));

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
              LEFT COLUMN: COLOR PHOTO & SETS ORDERING
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6">
            {/* Main Product Photo for Active Color */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-3">
              <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden">
                <img
                  src={activeColorPhoto}
                  alt={`${product.name} - ${activeColor || "Garment"}`}
                  className="w-full h-full object-cover transition-opacity duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23f1f5f9'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' font-weight='600' fill='%2394a3b8'>Garment Photo</text></svg>";
                  }}
                />

                <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-orange-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg border border-slate-700/60 shadow-sm flex items-center gap-1.5">
                  {activeColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/50"
                      style={{ backgroundColor: getColorHex(activeColor).hex }}
                    />
                  )}
                  <span>{activeColor ? `${activeColor}` : product.category}</span>
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
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition cursor-pointer ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-orange-50/60 rounded-xl border border-orange-200/60">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                      Selling Rate / PC
                    </span>
                    {draftCustomer && (
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          isWholesaler
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : isSpecialDiscount
                            ? "bg-teal-100 text-teal-800 border border-teal-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {isWholesaler
                          ? "Wholesaler"
                          : isSpecialDiscount
                          ? `Spl Disc (-₹${specialDiscountAmt})`
                          : "Retailer"}
                      </span>
                    )}
                  </div>
                  {/* BESIDE SELLING PRICE WRITE MRP (STRIKED OUT) SELLING PRICE */}
                  <div className="text-xl font-black text-slate-900 mt-0.5 flex items-baseline gap-2 font-mono flex-wrap">
                    {product.mrp && product.mrp > unitPrice && (
                      <span className="text-xs text-slate-400 line-through">
                        MRP {formatCurrency(product.mrp)}
                      </span>
                    )}
                    <span>{formatCurrency(unitPrice)}</span>
                    <span className="text-xs font-semibold text-slate-500 font-sans">/ pc</span>
                  </div>
                  {draftCustomer && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Applied for <strong>{draftCustomer.shopName}</strong>
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                    Packaging Ratio
                  </div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {activePcsPerSet} Pcs
                    <span className="text-xs font-semibold text-slate-500 ml-1">/ set</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    1 set = 1 pc of each ratio size
                  </p>
                </div>
              </div>

              {/* Size Ratio: Prioritizing 28 to 36 first, then 28 to 34 (4 pc set) */}
              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-bold">Size Ratio:</span>
                  {availableRatios.length > 1 && (
                    <span className="text-[10px] font-bold text-orange-600">
                      28 to 36 first, then 28 to 34
                    </span>
                  )}
                </div>

                {availableRatios.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {availableRatios.map((rKey) => {
                      const pcs = getPcsFromRatio(rKey, 5);
                      const isSelected = activeRatio === rKey;
                      const isFourPc = rKey.includes("28 to 34") || pcs === 4;
                      return (
                        <button
                          key={rKey}
                          type="button"
                          onClick={() => setSelectedRatio(rKey)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? "bg-slate-900 text-white ring-2 ring-orange-500 ring-offset-1"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                          }`}
                        >
                          <span>{rKey}</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                              isSelected
                                ? "bg-orange-500 text-white font-bold"
                                : "bg-white text-slate-600 border border-slate-300"
                            }`}
                          >
                            {pcs} Pcs{isFourPc ? " Set" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {activeRatio}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ({activePcsPerSet} Pcs / Set)
                    </span>
                  </div>
                )}
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

              {/* Transferred Color Selector Bar */}
              {availableColors.length > 0 && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Select Color (Click to preview photo):
                    </span>
                    <span className="text-[10px] text-orange-600 font-bold">
                      {availableColors.length} Color{availableColors.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {availableColors.map((col, idx) => {
                      const isSelected = activeColor.toLowerCase() === col.toLowerCase();
                      const hex = getColorHex(col).hex;
                      let letter = String.fromCharCode(65 + idx);
                      if (product.colorMapping) {
                        try {
                          const map = JSON.parse(product.colorMapping);
                          const found = Object.entries(map).find(
                            ([_, c]) => String(c).toLowerCase() === col.toLowerCase()
                          );
                          if (found) letter = found[0];
                        } catch {}
                      }
                      const currentSets = colorSetsSelection[col] || 0;

                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            setActiveColor(col);
                            const colImg = getProductColorImage(product, col);
                            const fIdx = allImages.findIndex((i) => i === colImg);
                            if (fIdx !== -1) setActiveImageIndex(fIdx);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isSelected
                              ? "bg-slate-950 text-white shadow-md ring-2 ring-orange-500"
                              : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          <span>{col}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-black ${
                              isSelected ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {letter}
                          </span>
                          {currentSets > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                              {currentSets}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                    const isCustom = customColors.some((c) => c.toLowerCase() === color.toLowerCase());
                    const rawStock = getAvailableSetsForColor(product.setsColorwise, color, product.colorMapping);
                    const currentSets = colorSetsSelection[color] || 0;
                    const pcsInfo = calculateOrderedColorSetsPieces(
                      product.setsColorwise,
                      color,
                      currentSets,
                      activePcsPerSet,
                      activeRatio
                    );
                    const calculatedColorPcs = pcsInfo.totalPcs;
                    const isPhotoActive = activeColor.toLowerCase() === color.toLowerCase();

                    return (
                      <div
                        key={color}
                        onClick={() => {
                          setActiveColor(color);
                          const colImg = getProductColorImage(product, color);
                          const fIdx = allImages.findIndex((i) => i === colImg);
                          if (fIdx !== -1) setActiveImageIndex(fIdx);
                          if (currentSets === 0) {
                            handleSetChange(color, 1);
                          }
                        }}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none ${
                          isPhotoActive ? "ring-2 ring-orange-500 shadow-sm" : ""
                        } ${
                          currentSets > 0
                            ? "bg-orange-50/70 border-orange-300 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Swatch + Color Name + Stock */}
                          <div className="flex items-center gap-3">
                            <span
                              className="w-7 h-7 rounded-full border border-slate-300 shadow-sm shrink-0 flex items-center justify-center transition-transform hover:scale-105"
                              style={{ backgroundColor: hex }}
                              title={`Palette: ${hex}`}
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
                                {isCustom ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span>Custom Shade</span>
                                  </span>
                                ) : rawStock > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>In Stock</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <span>Advance / Made to Order</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Quantity Selector (+/- sets) + optional remove custom */}
                          <div
                            className="flex items-center gap-3 shrink-0 self-end sm:self-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                              <button
                                type="button"
                                disabled={currentSets <= 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetChange(color, currentSets - 1);
                                }}
                                className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition"
                                aria-label="Decrease sets"
                              >
                                <Minus size={15} />
                              </button>

                              <input
                                type="number"
                                min={0}
                                value={currentSets === 0 ? "" : currentSets}
                                placeholder="0"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  handleSetChange(color, isNaN(val) ? 0 : val);
                                }}
                                className="w-14 h-9 text-center font-bold text-slate-900 text-sm focus:outline-none focus:bg-orange-50/50"
                              />

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetChange(color, currentSets + 1);
                                }}
                                className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition"
                                aria-label="Increase sets"
                              >
                                <Plus size={15} />
                              </button>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 w-12 text-right hidden sm:inline">
                              Sets
                            </span>

                            {isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCustomColor(color);
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 transition"
                                title="Remove custom shade"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* + Add Custom Shade Form */}
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-dashed border-slate-300 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Need a custom shade / color not listed above?</span>
                  {customColorInput.trim() && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs inline-block"
                        style={{ backgroundColor: getColorHex(customColorInput).hex }}
                      />
                      Palette preview: {getColorHex(customColorInput).hex}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g. Dark Indigo, Olive, Wine, Rust, Pista, #1a2538..."
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomColor();
                        }
                      }}
                      className="w-full px-3.5 py-2 pl-9 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                    />
                    <span
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: customColorInput.trim() ? getColorHex(customColorInput).hex : "#cbd5e1" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomColor}
                    disabled={!customColorInput.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition disabled:opacity-40 shrink-0"
                  >
                    + Add Shade
                  </button>
                </div>
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
                            {entry.sets} {entry.sets === 1 ? "set" : "sets"} ({colorPiecesMap[entry.color]?.totalPcs ?? entry.sets * pcsPerSet} pcs)
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
