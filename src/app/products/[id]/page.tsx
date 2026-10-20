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
  getProductMixSizesInfo,
  parseDetailedColorStockWithLoose,
  isColorSoldOut,
  getColorShadeLetter,
  type ColorStockDetail,
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

  // Selected mix single pieces per color: Record<colorName, Record<size, count>>
  const [colorMixPcs, setColorMixPcs] = useState<Record<string, Record<string, number>>>({});

  // All colors for this product (takes all in-stock product colors, hides sold-out colors, and keeps custom shades)
  const availableColors = useMemo(() => {
    if (!product) return [];
    const colors = getAllProductColors(
      product.colorsAvailable,
      product.setsColorwise,
      product.colorMapping
    );

    // Strict rule: IF ANY COLOR IS SOLD OUT DON'T SHOW THAT COLOR OPTION
    const inStockColors = colors.filter((col) => {
      // If user currently has active sets or mix pieces selected in this view, keep visible
      if ((colorSetsSelection[col] || 0) > 0) return true;
      const mixMap = colorMixPcs[col] || {};
      if (Object.values(mixMap).some((c) => (c || 0) > 0)) return true;
      return !isColorSoldOut(product.setsColorwise, col, product.colorMapping);
    });

    const merged = [...inStockColors];
    customColors.forEach((cc) => {
      if (!merged.some((c) => c.toLowerCase() === cc.toLowerCase())) {
        merged.push(cc);
      }
    });

    return merged;
  }, [product, customColors, colorSetsSelection, colorMixPcs]);

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

  // Selected ratio per color: Record<colorName, ratioString>
  const [colorSelectedRatio, setColorSelectedRatio] = useState<Record<string, string>>({});

  // Full parsed stock with loose pieces per color
  const stockWithLoose = useMemo(() => {
    if (!product?.setsColorwise) return {};
    return parseDetailedColorStockWithLoose(product.setsColorwise, activeRatio);
  }, [product, activeRatio]);

  // Helper: Retrieve detailed stock (ratios & loose pieces) for any color
  const getColorStockDetail = (colName: string): ColorStockDetail => {
    if (!stockWithLoose) return { ratios: {}, loosePcs: {} };
    const cleanTarget = cleanColorName(colName).toLowerCase();
    for (const [key, detail] of Object.entries(stockWithLoose)) {
      if (key.toLowerCase() === colName.toLowerCase() || cleanColorName(key).toLowerCase() === cleanTarget) {
        return detail;
      }
    }
    if (product?.colorMapping) {
      try {
        const map = JSON.parse(product.colorMapping);
        for (const [letter, mappedName] of Object.entries(map)) {
          if (typeof mappedName === "string" && cleanColorName(mappedName).toLowerCase() === cleanTarget) {
            if (stockWithLoose[letter]) return stockWithLoose[letter];
          }
        }
      } catch {}
    }
    return { ratios: {}, loosePcs: {} };
  };

  // Helper: update mix piece count for a specific color and size
  const handleMixPieceChange = (color: string, size: string, count: number) => {
    setActiveColor(color);
    setColorMixPcs((prev) => {
      const next = { ...prev };
      const colorMap = { ...(next[color] || {}) };
      if (count <= 0) {
        delete colorMap[size];
      } else {
        colorMap[size] = count;
      }
      if (Object.keys(colorMap).length === 0) {
        delete next[color];
      } else {
        next[color] = colorMap;
      }
      return next;
    });
  };

  // Helper: switch size ratio for a specific color
  const handleColorRatioChange = (color: string, ratio: string) => {
    setActiveColor(color);
    setColorSelectedRatio((prev) => ({
      ...prev,
      [color]: ratio,
    }));
  };

  // Total mix single pieces across all colors
  const totalMixPieces = useMemo(() => {
    let sum = 0;
    for (const colorMap of Object.values(colorMixPcs)) {
      for (const cnt of Object.values(colorMap)) {
        sum += Math.max(0, cnt || 0);
      }
    }
    return sum;
  }, [colorMixPcs]);

  // Formatted summary of selected mix pieces (e.g. "Jet Black: 30(2), 32(1); Navy: 34(1)")
  const selectedMixSummary = useMemo(() => {
    const parts: string[] = [];
    for (const [col, sizesMap] of Object.entries(colorMixPcs)) {
      const sizeEntries = Object.entries(sizesMap).filter(([_, c]) => c > 0);
      if (sizeEntries.length > 0) {
        const sizeStrs = sizeEntries.map(([sz, c]) => `${sz}(${c})`).join(", ");
        parts.push(`${col}: ${sizeStrs}`);
      }
    }
    return parts.join("; ");
  }, [colorMixPcs]);

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

  // Handle color set count change (employees can order any number of sets without stock restrictions)
  const handleSetChange = (color: string, requestedSets: number) => {
    setActiveColor(color);
    const validCount = Math.max(0, Math.min(requestedSets, 9999));

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
      updated[color] = 1;
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
    const loadDraftCustomer = () => {
      try {
        const raw = localStorage.getItem("garmentpro_order_draft");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.customer) {
            setDraftCustomer(parsed.customer);
            return;
          }
        }
      } catch {}
    };

    loadDraftCustomer();
    window.addEventListener("garmentpro_draft_updated", loadDraftCustomer);
    window.addEventListener("storage", loadDraftCustomer);
    return () => {
      window.removeEventListener("garmentpro_draft_updated", loadDraftCustomer);
      window.removeEventListener("storage", loadDraftCustomer);
    };
  }, []);

  const handleToggleBusinessType = (newType: string) => {
    setDraftCustomer((prev) => {
      const updated = prev ? { ...prev, businessType: newType } : { businessType: newType };
      try {
        const raw = localStorage.getItem("garmentpro_order_draft");
        const draft = raw ? JSON.parse(raw) : {};
        if (draft.customer) {
          draft.customer.businessType = newType;
        }
        draft.businessType = newType;
        localStorage.setItem("garmentpro_order_draft", JSON.stringify(draft));
        window.dispatchEvent(new Event("garmentpro_draft_updated"));
      } catch {}
      return updated;
    });
    toast(`Pricing updated immediately to ${newType === "WHOLESALER" ? "Wholesale" : "Retailer"}`);
  };

  // Wholesale Calculations & Dynamic Selling Price (Retailer vs Wholesaler)
  const pcsPerSet = activePcsPerSet;
  const totalSets = selectedEntries.reduce((sum, item) => sum + item.sets, 0);

  // Dynamically calculate accurate pieces across size ratio packs
  const colorPiecesMap = useMemo(() => {
    const map: Record<string, { totalPcs: number; breakdownText: string }> = {};
    for (const entry of selectedEntries) {
      const ratioForThisColor = colorSelectedRatio[entry.color] || activeRatio;
      const pcsPerSetForThisColor = getPcsFromRatio(ratioForThisColor, activePcsPerSet);
      const calc = calculateOrderedColorSetsPieces(
        product?.setsColorwise,
        entry.color,
        entry.sets,
        pcsPerSetForThisColor,
        ratioForThisColor
      );
      map[entry.color] = calc;
    }
    return map;
  }, [product, selectedEntries, colorSelectedRatio, activePcsPerSet, activeRatio]);

  const totalSetsPcs = useMemo(() => {
    return Object.values(colorPiecesMap).reduce((sum, item) => sum + item.totalPcs, 0);
  }, [colorPiecesMap]);

  const totalPcs = totalSetsPcs + totalMixPieces;

  const isWholesaler = draftCustomer?.businessType === "WHOLESALER" || draftCustomer?.businessType === "WHOLESALER WITHOUT GST";
  const isSpecialDiscount = draftCustomer?.businessType === "RETAILER WITH SPECIAL DISCOUNT";
  const specialDiscountAmt = isSpecialDiscount ? (Number(draftCustomer?.specialDiscount) || 0) : 0;
  const retPrice = product?.retailerPrice ?? product?.price ?? 0;
  const whoPrice = product?.wholesalerPrice ?? Math.max(0, retPrice - 100);
  const unitPrice = isWholesaler ? whoPrice : isSpecialDiscount ? Math.max(0, retPrice - specialDiscountAmt) : retPrice;
  const totalAmount = totalPcs * unitPrice;

  // Mix sizes available information
  const mixInfo = useMemo(() => {
    return getProductMixSizesInfo(product?.setsColorwise, (product as any)?.mixPcs || 0);
  }, [product]);

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

    const isWholesaleNoGstCust =
      draftCustomer?.businessType === "WHOLESALER WITHOUT GST" ||
      draftCustomer?.businessType === "WHOLESALE WITHOUT GST";

    if (draftCustomer && !isWholesaleNoGstCust && !isGstPanRegistered(draftCustomer.gstPanNo)) {
      toast(
        "Customer is NOT GST/PAN registered! Please enter and save GST/PAN details in the order form before adding products.",
        "error"
      );
      router.push("/orders/new");
      return;
    }

    if (totalSets === 0 && totalMixPieces === 0) {
      toast("Mandatory: Please select at least 1 set or 1 mix piece before adding to order form", "error");
      return;
    }

    // Verify stock limits (only for non-custom colors when inventory is tracked and positive)

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
      mixPcs: totalMixPieces,
      mixSizes: selectedMixSummary || (mixInfo.totalMixPcs > 0 ? mixInfo.sizesSummary : "None"),
      colorMixPcs: colorMixPcs,
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

      toast(`Added ${product.name} (${totalSets} sets, ${totalPcs} pcs) to Order Form!`, "success");
      const targetCatalog = `/products?returnTo=${encodeURIComponent(returnTo)}`;
      router.push(targetCatalog);
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
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleBusinessType(isWholesaler ? "RETAILER" : "WHOLESALER")}
                          title="Click to switch business type & update price immediately"
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded cursor-pointer transition hover:opacity-85 active:scale-95 ${
                            isWholesaler
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : isSpecialDiscount
                              ? "bg-teal-100 text-teal-800 border border-teal-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isWholesaler
                            ? "Wholesale ⇄"
                            : isSpecialDiscount
                            ? `Spl Disc (-₹${specialDiscountAmt})`
                            : "Retailer ⇄"}
                        </button>
                      </div>
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

              {/* Size Ratio: Always show primary ratio (28 to 36) without multi-ratio clutter */}
              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-bold">Size Ratio:</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({activePcsPerSet} Pcs / Set)
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    {activeRatio}
                  </span>
                </div>
              </div>

              {/* Mix Sizes Available Status */}
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 shadow-2xs ${
                  mixInfo.totalMixPcs > 0
                    ? "bg-amber-50/90 border-amber-300 text-amber-950"
                    : "bg-amber-50/40 border-amber-200/80 text-amber-950"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Layers size={14} className="text-amber-700" />
                    <span>
                      MIX SIZES AVAILABLE: {mixInfo.totalMixPcs > 0 ? `${mixInfo.totalMixPcs} PIECES` : "0 PIECES"}
                    </span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                      mixInfo.totalMixPcs > 0
                        ? "bg-amber-200 text-amber-950"
                        : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {mixInfo.totalMixPcs > 0 ? `${mixInfo.totalMixPcs} Pcs Available` : "0 Pcs Available"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">
                    Available Sizes:{" "}
                    <strong className="font-mono text-slate-900">
                      {mixInfo.totalMixPcs > 0 ? mixInfo.sizesSummary : "0 Pcs"}
                    </strong>
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
                      const letter = getColorShadeLetter(product, col, idx);
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
                    const colorStockDetail = getColorStockDetail(color);
                    const currentRatioForColor = colorSelectedRatio[color] || activeRatio;
                    const pcsPerSetForColor = getPcsFromRatio(currentRatioForColor, activePcsPerSet);
                    const pcsInfo = calculateOrderedColorSetsPieces(
                      product.setsColorwise,
                      color,
                      currentSets,
                      pcsPerSetForColor,
                      currentRatioForColor
                    );
                    const calculatedColorPcs = pcsInfo.totalPcs;
                    const isPhotoActive = activeColor.toLowerCase() === color.toLowerCase();

                    // Mix single pieces selected for this color
                    const colorMixMap = colorMixPcs[color] || {};
                    const colorSelectedMixTotal = Object.values(colorMixMap).reduce((s, c) => s + (c || 0), 0);
                    const colorSelectedMixSummary = Object.entries(colorMixMap)
                      .filter(([_, c]) => c > 0)
                      .map(([sz, c]) => `${sz}(${c})`)
                      .join(", ");

                    // Available ratios for this color
                    const colorRatios = Object.keys(colorStockDetail.ratios).length > 0
                      ? sortSizeRatioKeys(Object.keys(colorStockDetail.ratios))
                      : availableRatios.length > 0
                      ? availableRatios
                      : [product.sizesRatio || "28 to 36"];

                    // ONLY sizes that have available mix single pieces in stock for this color (or already selected)
                    const colorAvailableMixSizes = Object.keys(colorStockDetail.loosePcs)
                      .filter((sz) => (colorStockDetail.loosePcs[sz] || 0) > 0 || (colorMixMap[sz] || 0) > 0)
                      .sort((a, b) => {
                        const nA = parseInt(a, 10);
                        const nB = parseInt(b, 10);
                        if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
                        return a.localeCompare(b);
                      });

                    const totalLooseInStockForColor = colorAvailableMixSizes.reduce(
                      (s, sz) => s + Math.max(0, colorStockDetail.loosePcs[sz] || 0),
                      0
                    );

                    const hasMixStockForColor = colorAvailableMixSizes.length > 0;

                    const isExpanded = isPhotoActive || currentSets > 0 || colorSelectedMixTotal > 0;

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
                          currentSets > 0 || colorSelectedMixTotal > 0
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
                              {(currentSets > 0 || colorSelectedMixTotal > 0) && (
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
                                {colorSelectedMixTotal > 0 && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                                    +{colorSelectedMixTotal} Mix Pcs
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                {isCustom && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span>Custom Shade</span>
                                  </span>
                                )}

                                {/* Color Specific Mix Sizes Tag */}
                                {totalLooseInStockForColor > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                                    <span>Mix Sizes: {totalLooseInStockForColor} Available</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10.5px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    <span>Mix Sizes: 0 Available</span>
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
                                className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
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
                                className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition cursor-pointer"
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
                                className="p-1 text-slate-400 hover:text-red-500 transition cursor-pointer"
                                title="Remove custom shade"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ─── INLINE SIZE RATIO & MIX SIZES SELECTOR (RIGHT BELOW COLOR) ─── */}
                        {isExpanded && hasMixStockForColor && (
                          <div
                            className="mt-3.5 pt-3.5 border-t border-slate-200/90 space-y-3 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                          >

                            {/* 2. Mix Sizes (Loose Single Pieces) of the same color - ONLY shown if mix pieces exist for this color */}
                            {hasMixStockForColor && (
                              <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-200/90 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                    <Sparkles size={13} className="text-amber-600" />
                                    <span>Mix Sizes Available — Single Pieces ({color})</span>
                                  </span>
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                                    {totalLooseInStockForColor} Loose Pcs Available
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                  {colorAvailableMixSizes.map((sz) => {
                                    const availLoose = colorStockDetail.loosePcs[sz] || 0;
                                    const selectedLoose = colorMixMap[sz] || 0;
                                    const isSelected = selectedLoose > 0;

                                    return (
                                      <div
                                        key={sz}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`p-2 rounded-xl border transition-all ${
                                          isSelected
                                            ? "bg-amber-100/90 border-amber-400 ring-1 ring-amber-400 shadow-2xs"
                                            : "bg-white border-slate-200 hover:border-slate-300"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="font-black text-xs text-slate-900">
                                            Size {sz}
                                          </span>
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                                            {availLoose} pcs
                                          </span>
                                        </div>

                                        {/* Stepper buttons */}
                                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                          <button
                                            type="button"
                                            disabled={selectedLoose <= 0}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMixPieceChange(color, sz, selectedLoose - 1);
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-white rounded disabled:opacity-30 transition cursor-pointer"
                                            title={`Decrease Size ${sz}`}
                                          >
                                            <Minus size={11} />
                                          </button>

                                          <span className="font-mono font-black text-xs text-slate-900">
                                            {selectedLoose}
                                          </span>

                                          <button
                                            type="button"
                                            disabled={availLoose > 0 && selectedLoose >= availLoose && !isCustom}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMixPieceChange(color, sz, selectedLoose + 1);
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-white rounded disabled:opacity-30 transition cursor-pointer"
                                            title={`Increase Size ${sz}`}
                                          >
                                            <Plus size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 3. Color Piece & Mix Summary Bar */}
                            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-slate-900">{color}:</span>
                                <span className="font-semibold text-slate-700">
                                  {currentSets} {currentSets === 1 ? "Set" : "Sets"} ({calculatedColorPcs} pcs)
                                </span>
                                {colorSelectedMixTotal > 0 && (
                                  <>
                                    <span className="text-slate-400 font-bold">+</span>
                                    <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                      {colorSelectedMixTotal} Mix {colorSelectedMixTotal === 1 ? "Pc" : "Pcs"} ({colorSelectedMixSummary})
                                    </span>
                                  </>
                                )}
                                <span className="text-slate-400 font-bold">=</span>
                                <span className="font-black text-orange-600 text-sm">
                                  {calculatedColorPcs + colorSelectedMixTotal} Total Pcs
                                </span>
                              </div>

                              {colorSelectedMixTotal > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setColorMixPcs((prev) => {
                                      const next = { ...prev };
                                      delete next[color];
                                      return next;
                                    });
                                  }}
                                  className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer underline"
                                >
                                  Clear {color} Mix
                                </button>
                              )}
                            </div>
                          </div>
                        )}
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

                {/* Selected Colors & Mix Breakdown */}
                {selectedEntries.length > 0 || totalMixPieces > 0 ? (
                  <div className="space-y-1 text-xs">
                    <div className="text-slate-400 text-[11px] font-semibold mb-1">
                      Selected Colors &amp; Mix Breakdown:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntries.map((entry) => {
                        const cMix = colorMixPcs[entry.color];
                        const cMixTotal = cMix ? Object.values(cMix).reduce((s, c) => s + (c || 0), 0) : 0;
                        return (
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
                            {cMixTotal > 0 && (
                              <span className="text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-600/50">
                                +{cMixTotal} mix
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {Object.entries(colorMixPcs).map(([col, m]) => {
                        if ((colorSetsSelection[col] || 0) > 0) return null;
                        const totalM = Object.values(m).reduce((s, c) => s + (c || 0), 0);
                        if (totalM === 0) return null;
                        return (
                          <span
                            key={col}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-700/80 text-amber-200 text-xs"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: getColorHex(col).hex }}
                            />
                            <span className="font-bold text-white">{col}:</span>
                            <span className="text-amber-400 font-bold">{totalM} mix pcs</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Select sets or mix sizes for any of the colors above to see the live total.
                  </p>
                )}

                {/* Math Row */}
                <div className={`grid gap-2 pt-2 border-t border-slate-800 text-center ${totalMixPieces > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Total Sets
                    </div>
                    <div className="text-lg font-black text-orange-400">
                      {totalSets}
                    </div>
                  </div>

                  {totalMixPieces > 0 && (
                    <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Mix Pcs
                      </div>
                      <div className="text-lg font-black text-amber-400">
                        {totalMixPieces}
                      </div>
                    </div>
                  )}

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
                  disabled={totalSets === 0 && totalMixPieces === 0}
                  onClick={handleAddToOrderForm}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base rounded-xl shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <FilePlus size={20} />
                  <span>
                    Add To Order Form ({totalSets} Sets{totalMixPieces > 0 ? ` · ${totalMixPieces} Mix` : ""} · {totalPcs} Pcs)
                  </span>
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
