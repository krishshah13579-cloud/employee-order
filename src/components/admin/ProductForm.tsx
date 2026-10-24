"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Save,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Palette,
  Layers,
  Ruler,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Menu,
  Star,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  AlertCircle,
  Plus,
  PackageOpen,
  Scissors,
  Copy,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { getColorHex } from "@/lib/colors";
import {
  STANDARD_SIZE_RATIOS,
  PRODUCT_CATEGORIES,
  type ProductData,
  type SizeGuideRow,
} from "@/lib/types";
import {
  parseColorwiseSets,
  stringifyColorwiseSets,
  getTotalAvailableSets,
  getAllProductColors,
  getAvailableSetsForColor,
  cleanColorName,
  parseDetailedColorRatioSets,
  parseDetailedColorStockWithLoose,
  calculateColorSizesBreakdown,
  calculateTotalColorPieces,
  getSizesFromRatio,
  sortSizeRatioKeys,
  sellSingleSizeFromColorStock,
  unpackSetToLoosePieces,
} from "@/lib/stock";
import { compressImageFile } from "@/lib/imageCompression";
import { extractColorsFromImage } from "@/lib/colorExtractor";

// Standard Trouser & Formal Apparel Color Presets
const PRESET_COLORS = [
  { name: "Jet Black", hex: "#0a0a0a" },
  { name: "Navy Blue", hex: "#1e293b" },
  { name: "Dark Indigo", hex: "#1a2538" },
  { name: "Charcoal Grey", hex: "#334155" },
  { name: "Dark Grey", hex: "#374151" },
  { name: "Light Grey", hex: "#94a3b8" },
  { name: "Ice Grey", hex: "#d1d5db" },
  { name: "Steel Grey", hex: "#64748b" },
  { name: "Slate Blue", hex: "#475569" },
  { name: "Dark Denim", hex: "#1e293b" },
  { name: "Light Blue", hex: "#93c5fd" },
  { name: "Khaki", hex: "#c2b280" },
  { name: "Olive Green", hex: "#3f4f34" },
  { name: "Dark Olive", hex: "#2e3a27" },
  { name: "Bottle Green", hex: "#14532d" },
  { name: "Pista Green", hex: "#93c572" },
  { name: "Beige", hex: "#e7dbc8" },
  { name: "Cream", hex: "#fef3c7" },
  { name: "Off White", hex: "#f8fafc", border: true },
  { name: "White", hex: "#ffffff", border: true },
  { name: "Tan", hex: "#c19a6b" },
  { name: "Camel", hex: "#c19a6b" },
  { name: "Dark Brown", hex: "#452a1a" },
  { name: "Coffee", hex: "#451a03" },
  { name: "Burgundy", hex: "#581c24" },
  { name: "Maroon", hex: "#7f1d1d" },
  { name: "Rust", hex: "#c2410c" },
];

// Default Standard Size Guide (Fixed brand sizes 28–44, editable waist & length)
const DEFAULT_ADMIN_SIZE_GUIDE: SizeGuideRow[] = [
  { brandSize: "28", waist: "28", length: "41" },
  { brandSize: "30", waist: "30", length: "41" },
  { brandSize: "32", waist: "32", length: "41" },
  { brandSize: "34", waist: "34", length: "41" },
  { brandSize: "36", waist: "36", length: "41" },
  { brandSize: "38", waist: "38", length: "41" },
  { brandSize: "40", waist: "40", length: "41" },
  { brandSize: "42", waist: "42", length: "41" },
  { brandSize: "44", waist: "44", length: "41" },
];

interface ProductFormProps {
  initialData?: ProductData;
  isEdit?: boolean;
  productId?: string | number;
}

export default function ProductForm({
  initialData,
  isEdit = false,
  productId,
}: ProductFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_IMAGES = 10;
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [detectingColors, setDetectingColors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible sections states
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(true);

  // Parse initial colors into array (all colors from colorsAvailable, setsColorwise, and colorMapping)
  const parseInitialColors = (): string[] => {
    const list = getAllProductColors(
      initialData?.colorsAvailable,
      initialData?.setsColorwise,
      initialData?.colorMapping
    );
    if (list.length > 0) return list;
    return isEdit ? ["Dark Indigo", "Light Blue", "Jet Black", "Charcoal Grey"] : [];
  };

  const [selectedColors, setSelectedColors] = useState<string[]>(parseInitialColors);
  const [customColorsList, setCustomColorsList] = useState<string[]>(() => {
    const initial = parseInitialColors();
    const presetNamesLower = PRESET_COLORS.map((p) => p.name.toLowerCase());
    return initial.filter((c) => !presetNamesLower.includes(c.toLowerCase()));
  });
  const [customColorInput, setCustomColorInput] = useState("");

  // Color Alphabet Mapping: e.g. { "A": "Ice Grey", "B": "Jet Black" }
  const parseInitialColorMapping = (): Record<string, string> => {
    if (initialData?.colorMapping) {
      try {
        const parsed = JSON.parse(initialData.colorMapping);
        if (typeof parsed === "object" && parsed !== null) return parsed;
      } catch {}
    }
    const colors = parseInitialColors();
    const map: Record<string, string> = {};
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    colors.forEach((c, i) => {
      map[letters[i] || `C${i + 1}`] = c;
    });
    return map;
  };

  const [colorAlphabetMap, setColorAlphabetMap] = useState<Record<string, string>>(parseInitialColorMapping);

  // Sorts an array of colors according to their assigned alphabet letters (A, B, C, D...)
  const sortColorsByAlphabet = (colors: string[], mapping: Record<string, string>): string[] => {
    const getLetter = (col: string): string => {
      const entry = Object.entries(mapping).find(
        ([_, c]) => cleanColorName(c).toLowerCase() === cleanColorName(col).toLowerCase()
      );
      return entry ? entry[0].toUpperCase() : "ZZZ";
    };
    return [...colors].sort((a, b) => {
      const la = getLetter(a);
      const lb = getLetter(b);
      return la.localeCompare(lb, undefined, { numeric: true, sensitivity: "base" });
    });
  };

  // Keep colorAlphabetMap synchronized with selectedColors
  useEffect(() => {
    setColorAlphabetMap((prev) => {
      const updated: Record<string, string> = {};
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      const assignedColors = new Set<string>();

      // Retain existing mapped letters for colors that are still selected
      for (const [letter, col] of Object.entries(prev)) {
        if (selectedColors.some((c) => cleanColorName(c).toLowerCase() === cleanColorName(col).toLowerCase())) {
          updated[letter.toUpperCase()] = col;
          assignedColors.add(cleanColorName(col).toLowerCase());
        }
      }

      // Assign remaining colors to next available alphabet letters
      let letterIdx = 0;
      for (const col of selectedColors) {
        if (!assignedColors.has(cleanColorName(col).toLowerCase())) {
          while (letterIdx < letters.length && updated[letters[letterIdx]]) {
            letterIdx++;
          }
          const letter = letters[letterIdx] || `C${letterIdx + 1}`;
          updated[letter] = col;
          assignedColors.add(cleanColorName(col).toLowerCase());
        }
      }

      return updated;
    });
  }, [selectedColors]);

  const handleColorLetterChange = (color: string, newLetter: string) => {
    const cleanLetter = newLetter.trim().toUpperCase();
    if (!cleanLetter) return;

    setColorAlphabetMap((prev) => {
      const currentEntry = Object.entries(prev).find(
        ([_, c]) => cleanColorName(c).toLowerCase() === cleanColorName(color).toLowerCase()
      );
      const oldLetter = currentEntry ? currentEntry[0].toUpperCase() : null;

      if (oldLetter === cleanLetter) return prev;

      const updated = { ...prev };

      // Check if target letter is already assigned to a different color
      const existingEntry = Object.entries(updated).find(
        ([k, c]) => k.toUpperCase() === cleanLetter && cleanColorName(c).toLowerCase() !== cleanColorName(color).toLowerCase()
      );

      // Remove current mappings for this color
      for (const [k, v] of Object.entries(updated)) {
        if (cleanColorName(v).toLowerCase() === cleanColorName(color).toLowerCase()) {
          delete updated[k];
        }
      }

      // If target letter was occupied, swap: assign the displaced color to oldLetter
      if (existingEntry && oldLetter) {
        updated[oldLetter] = existingEntry[1];
      }

      updated[cleanLetter] = color;

      // Re-sort selectedColors immediately so the colors move beside the alphabets in order A, B, C, D...
      setTimeout(() => {
        setSelectedColors((curr) => sortColorsByAlphabet(curr, updated));
      }, 0);

      return updated;
    });
  };

  const moveColorAlphabet = (color: string, direction: -1 | 1) => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const currentEntry = Object.entries(colorAlphabetMap).find(
      ([_, c]) => cleanColorName(c).toLowerCase() === cleanColorName(color).toLowerCase()
    );
    if (!currentEntry) return;
    const curLetter = currentEntry[0].toUpperCase();
    const curIdx = letters.indexOf(curLetter);
    if (curIdx === -1) return;
    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= selectedColors.length) return;
    const targetLetter = letters[targetIdx];
    handleColorLetterChange(color, targetLetter);
  };

  // Parse initial images list (supports comma-separated, single URL, or JSON array)
  const parseInitialImages = (): string[] => {
    if (!initialData?.imageUrl) return [];
    const val = initialData.imageUrl.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {}
    }
    if (val.startsWith("data:")) {
      return [val];
    }
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const [imagesList, setImagesList] = useState<string[]>(parseInitialImages);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [externalUrlInput, setExternalUrlInput] = useState("");

  // Parse initial size guide rows
  const parseInitialSizeGuide = (): SizeGuideRow[] => {
    let existingMap: Record<string, { waist: string; length: string }> = {};
    if (initialData?.sizeGuide) {
      try {
        const parsed = Array.isArray(initialData.sizeGuide)
          ? initialData.sizeGuide
          : JSON.parse(initialData.sizeGuide);
        if (Array.isArray(parsed)) {
          parsed.forEach((r: any) => {
            if (r && r.brandSize) {
              existingMap[String(r.brandSize).trim()] = {
                waist: String(r.waist ?? ""),
                length: String(r.length ?? ""),
              };
            }
          });
        }
      } catch {}
    }

    return DEFAULT_ADMIN_SIZE_GUIDE.map((def) => {
      const match = existingMap[def.brandSize];
      if (
        match &&
        match.waist !== undefined &&
        match.waist !== "" &&
        match.length !== undefined &&
        match.length !== ""
      ) {
        return {
          brandSize: def.brandSize,
          waist: match.waist,
          length: match.length,
        };
      }
      return { ...def };
    });
  };

  const [sizeGuideRows, setSizeGuideRows] = useState<SizeGuideRow[]>(parseInitialSizeGuide);
  const [sizeGuideUnit, setSizeGuideUnit] = useState<"IN" | "CM">("IN");

  const getConvertedEquivalent = (val: string, currentUnit: "IN" | "CM") => {
    const num = parseFloat(val);
    if (isNaN(num) || !val.trim()) return "-";
    if (currentUnit === "IN") {
      const cm = (num * 2.54).toFixed(1);
      return `${cm.endsWith(".0") ? cm.slice(0, -2) : cm} cm`;
    } else {
      const inch = (num / 2.54).toFixed(1);
      return `${inch.endsWith(".0") ? inch.slice(0, -2) : inch}"`;
    }
  };

  const handleSizeGuideChange = (index: number, field: "waist" | "length", value: string) => {
    setSizeGuideRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleToggleSizeGuideUnit = (newUnit: "IN" | "CM") => {
    if (newUnit === sizeGuideUnit) return;
    setSizeGuideRows((prev) =>
      prev.map((row) => {
        const convertVal = (val: string) => {
          const num = parseFloat(val);
          if (isNaN(num)) return val;
          if (newUnit === "CM") {
            const cm = (num * 2.54).toFixed(1);
            return cm.endsWith(".0") ? cm.slice(0, -2) : cm;
          } else {
            const inch = (num / 2.54).toFixed(1);
            return inch.endsWith(".0") ? inch.slice(0, -2) : inch;
          }
        };
        return {
          brandSize: row.brandSize,
          waist: convertVal(row.waist),
          length: convertVal(row.length),
        };
      })
    );
    setSizeGuideUnit(newUnit);
  };

  const handleResetSizeGuide = () => {
    setSizeGuideRows([...DEFAULT_ADMIN_SIZE_GUIDE]);
    setSizeGuideUnit("IN");
    toast("Size guide reset to standard 28–44 dimensions", "success");
  };

  // Dynamic Categories list from API (strictly active categories from database)
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
            // Default to first active category if new product
            if (!initialData?.category && names[0]) {
              setFormData((prev) => ({ ...prev, category: names[0] }));
            }
          }
        }
      } catch {}
    }
    loadCategories();
  }, [initialData]);

  // Form base state with dual selling prices:
  // Retailer Price = MRP / 2
  // Wholesaler Price = (MRP / 2) - 100
  const initialMrp = initialData?.mrp ?? (initialData?.price ? initialData.price * 2 : 1000);
  const initialRetailerPrice = initialData?.retailerPrice ?? (initialData?.price ?? Math.round(initialMrp / 2));
  const initialWholesalerPrice = initialData?.wholesalerPrice ?? Math.max(0, initialRetailerPrice - 100);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    category: initialData?.category || "EVERYDAY CASUAL",
    sizesRatio: initialData?.sizesRatio || "30 to 38",
    sizesList: initialData?.sizesList || "30, 32, 34, 36, 38",
    pcsPerSet: initialData?.pcsPerSet || 5,
    mrp: initialMrp,
    retailerPrice: initialRetailerPrice,
    wholesalerPrice: initialWholesalerPrice,
    price: initialRetailerPrice,
    costPrice: initialData?.costPrice ?? "",
    mixPcs: initialData?.mixPcs ?? 0,
    setsColorwise: initialData?.setsColorwise || "",
    description: "", // Description note
    isActive: initialData?.isActive ?? true,
  });

  const handleMrpChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const ret = Math.round(num / 2);
      const who = Math.max(0, ret - 100);
      setFormData((prev) => ({
        ...prev,
        mrp: num,
        retailerPrice: ret,
        wholesalerPrice: who,
        price: ret,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        mrp: val as any,
      }));
    }
  };

  // Color -> Photo mapping (e.g. {"Ice Grey": "data:image/...", "Jet Black": "data:image/..."})
  const [colorImages, setColorImages] = useState<Record<string, string>>(() => {
    if (initialData?.colorImages) {
      try {
        const parsed =
          typeof initialData.colorImages === "string"
            ? JSON.parse(initialData.colorImages)
            : initialData.colorImages;
        if (parsed && typeof parsed === "object") return parsed;
      } catch {}
    }
    return {};
  });

  // Parse initial detailed stock with ratios and single size loose pieces
  const initialStockWithLoose = parseDetailedColorStockWithLoose(
    initialData?.setsColorwise,
    initialData?.sizesRatio || "30 to 38"
  );

  // Multi-ratio color stock breakdown: { [color]: { [ratio]: count } }
  // e.g. { "Indigo": { "30 to 38": 5, "32 to 38": 1 } }
  const [colorRatioStockMap, setColorRatioStockMap] = useState<Record<string, Record<string, number>>>(() => {
    const result: Record<string, Record<string, number>> = {};
    const initialColors = parseInitialColors();

    for (const [col, detail] of Object.entries(initialStockWithLoose)) {
      const clean = cleanColorName(col);
      result[clean] = { ...detail.ratios };
    }

    initialColors.forEach((c) => {
      const clean = cleanColorName(c);
      if (!result[clean] || Object.keys(result[clean]).length === 0) {
        const fallbackSets = getAvailableSetsForColor(
          initialData?.setsColorwise,
          c,
          initialData?.colorMapping
        );
        result[clean] = { [initialData?.sizesRatio || "30 to 38"]: fallbackSets };
      }
    });

    return result;
  });

  // Single size loose stock breakdown: { [color]: { [size]: count } }
  // e.g. { "Indigo": { "34": 3, "36": 2 } }
  const [colorLooseStockMap, setColorLooseStockMap] = useState<Record<string, Record<string, number>>>(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const [col, detail] of Object.entries(initialStockWithLoose)) {
      const clean = cleanColorName(col);
      result[clean] = { ...detail.loosePcs };
    }
    return result;
  });

  const [bulkSetsInput, setBulkSetsInput] = useState<number>(20);

  const handleColorRatioSetChange = (color: string, ratio: string, val: number) => {
    const clean = cleanColorName(color);
    setColorRatioStockMap((prev) => {
      const current = prev[clean] || {};
      const keys = Object.keys(current);
      let updated: Record<string, number> = { ...current };

      if (keys.length === 1 && keys[0] !== ratio) {
        // Replace single stale ratio key
        updated = { [ratio]: Math.max(0, val) };
      } else {
        updated[ratio] = Math.max(0, val);
      }

      return {
        ...prev,
        [clean]: updated,
      };
    });
  };

  const handlePrimaryRatioChange = (newRatio: string, syncToAllColors: boolean = true) => {
    if (!newRatio.trim()) return;
    const cleanRatio = newRatio.trim();
    const sizes = getSizesFromRatio(cleanRatio);
    const pcs = sizes.length > 0 && sizes[0] !== cleanRatio ? sizes.length : 5;
    const sizesStr = sizes.join(", ");

    setFormData((prev) => ({
      ...prev,
      sizesRatio: cleanRatio,
      sizesList: sizesStr,
      pcsPerSet: pcs,
    }));

    if (syncToAllColors) {
      setColorRatioStockMap((prev) => {
        const next: Record<string, Record<string, number>> = {};
        for (const c of selectedColors) {
          const clean = cleanColorName(c);
          const existing = prev[clean] || {};
          const keys = Object.keys(existing);
          if (keys.length <= 1) {
            // Preserve existing quantity count under the new ratio
            const count = keys.length === 1 ? existing[keys[0]] : 4;
            next[clean] = { [cleanRatio]: Math.max(0, count) };
          } else {
            // Multi-ratio: keep existing, but ensure cleanRatio exists
            next[clean] = { ...existing };
            if (next[clean][cleanRatio] === undefined) {
              next[clean][cleanRatio] = 0;
            }
          }
        }
        return next;
      });
      toast(`Updated Mandatory Size Ratio to "${cleanRatio}" (${pcs} pcs/set) for all colors`, "success");
    }
  };

  const handleAddRatioToColor = (color: string, newRatio: string) => {
    const clean = cleanColorName(color);
    setColorRatioStockMap((prev) => {
      const current = prev[clean] || {};
      if (current[newRatio] !== undefined) return prev;
      return {
        ...prev,
        [clean]: {
          ...current,
          [newRatio]: 1,
        },
      };
    });
  };

  const handleRemoveRatioFromColor = (color: string, ratioToRemove: string) => {
    const clean = cleanColorName(color);
    setColorRatioStockMap((prev) => {
      const current = { ...(prev[clean] || {}) };
      delete current[ratioToRemove];
      if (Object.keys(current).length === 0) {
        current[formData.sizesRatio || "28 to 36"] = 0;
      }
      return {
        ...prev,
        [clean]: current,
      };
    });
  };

  const handleColorLoosePieceChange = (color: string, size: string, count: number) => {
    const clean = cleanColorName(color);
    setColorLooseStockMap((prev) => {
      const current = { ...(prev[clean] || {}) };
      const safeCount = Math.max(0, count);
      if (safeCount === 0) {
        delete current[size];
      } else {
        current[size] = safeCount;
      }
      return {
        ...prev,
        [clean]: current,
      };
    });
  };

  const handleAddLooseSizeToColor = (color: string, size: string) => {
    const clean = cleanColorName(color);
    setColorLooseStockMap((prev) => {
      const current = { ...(prev[clean] || {}) };
      if (current[size] !== undefined) return prev;
      return {
        ...prev,
        [clean]: {
          ...current,
          [size]: 1,
        },
      };
    });
  };

  const handleRemoveLooseSizeFromColor = (color: string, size: string) => {
    const clean = cleanColorName(color);
    setColorLooseStockMap((prev) => {
      const current = { ...(prev[clean] || {}) };
      delete current[size];
      return {
        ...prev,
        [clean]: current,
      };
    });
  };

  const getColorTotalSets = (color: string) => {
    const clean = cleanColorName(color);
    const ratios = colorRatioStockMap[clean];
    if (!ratios) return 0;
    return Object.values(ratios).reduce((sum, count) => sum + (count || 0), 0);
  };

  const [activeStockColor, setActiveStockColor] = useState<string>(() => {
    const initial = parseInitialColors();
    return initial[0] || "Dark Indigo";
  });

  const [customRatioInput, setCustomRatioInput] = useState<string>("");
  const [customLooseSizeInput, setCustomLooseSizeInput] = useState<string>("");

  // Keep activeStockColor valid when selectedColors changes
  useEffect(() => {
    if (selectedColors.length > 0 && !selectedColors.includes(activeStockColor)) {
      setActiveStockColor(selectedColors[0]);
    }
  }, [selectedColors, activeStockColor]);

  const handleBulkSetStock = (sets: number) => {
    setColorRatioStockMap((prev) => {
      const next: Record<string, Record<string, number>> = { ...prev };
      for (const c of selectedColors) {
        const clean = cleanColorName(c);
        const existing = next[clean] || {};
        const keys = Object.keys(existing);
        if (keys.length === 0) {
          next[clean] = { "30 to 38": Math.max(0, sets) };
        } else {
          const updated: Record<string, number> = {};
          keys.forEach((k, idx) => {
            updated[k] = idx === 0 ? Math.max(0, sets) : 0;
          });
          next[clean] = updated;
        }
      }
      return next;
    });
    toast(`Set ${sets} stock sets for all ${selectedColors.length} colors`, "success");
  };

  // Copy one color's stock and ratios to all colors
  const handleCopyColorToAll = (sourceColor: string) => {
    const srcClean = cleanColorName(sourceColor);
    const srcRatios = colorRatioStockMap[srcClean] || {};
    const srcLoose = colorLooseStockMap[srcClean] || {};

    setColorRatioStockMap((prev) => {
      const next = { ...prev };
      for (const c of selectedColors) {
        const clean = cleanColorName(c);
        next[clean] = { ...srcRatios };
      }
      return next;
    });

    setColorLooseStockMap((prev) => {
      const next = { ...prev };
      for (const c of selectedColors) {
        const clean = cleanColorName(c);
        next[clean] = { ...srcLoose };
      }
      return next;
    });

    toast(`Copied stock setup from "${sourceColor}" to all ${selectedColors.length} colors!`, "success");
  };

  // Set or add a ratio pack for a specific color
  const handleSetRatioForColor = (color: string, ratioName: string) => {
    const clean = cleanColorName(color);
    setColorRatioStockMap((prev) => {
      const current = prev[clean] || {};
      const keys = Object.keys(current);

      // If only 1 ratio with 0 sets, replace it seamlessly
      if (keys.length === 1 && current[keys[0]] === 0) {
        return {
          ...prev,
          [clean]: { [ratioName]: 0 },
        };
      }

      // If ratio already exists, don't duplicate
      if (current[ratioName] !== undefined) {
        return prev;
      }

      // If no ratios exist, add with 0 sets
      if (keys.length === 0) {
        return {
          ...prev,
          [clean]: { [ratioName]: 0 },
        };
      }

      // Add as additional ratio pack with 1 set
      return {
        ...prev,
        [clean]: {
          ...current,
          [ratioName]: 1,
        },
      };
    });
    toast(`Added "${ratioName}" pack to ${color}`, "success");
  };

  const handleSellSingleSize = (color: string, size: string) => {
    const clean = cleanColorName(color);
    const ratios = colorRatioStockMap[clean] || {};
    const loose = colorLooseStockMap[clean] || {};

    const result = sellSingleSizeFromColorStock(ratios, loose, size);
    if (!result.success) {
      toast(result.message, "error");
      return;
    }

    setColorRatioStockMap((prev) => ({
      ...prev,
      [clean]: result.ratios,
    }));

    setColorLooseStockMap((prev) => ({
      ...prev,
      [clean]: result.loosePcs,
    }));

    toast(result.message, "success");
  };

  const handleUnpackSet = (color: string, ratioToUnpack: string) => {
    const clean = cleanColorName(color);
    const ratios = colorRatioStockMap[clean] || {};
    const loose = colorLooseStockMap[clean] || {};

    const result = unpackSetToLoosePieces(ratios, loose, ratioToUnpack);
    if (!result.success) {
      toast(result.message, "error");
      return;
    }

    setColorRatioStockMap((prev) => ({
      ...prev,
      [clean]: result.ratios,
    }));

    setColorLooseStockMap((prev) => ({
      ...prev,
      [clean]: result.loosePcs,
    }));

    toast(result.message, "success");
  };

  // Color management
  const handleToggleColor = (colorName: string) => {
    setSelectedColors((prev) => {
      const isSelected = prev.includes(colorName);
      if (isSelected) {
        return prev.filter((c) => c !== colorName);
      } else {
        const clean = cleanColorName(colorName);
        setColorRatioStockMap((stockPrev) => {
          if (!stockPrev[clean] || Object.keys(stockPrev[clean]).length === 0) {
            return {
              ...stockPrev,
              [clean]: { [formData.sizesRatio]: Math.max(4, bulkSetsInput) },
            };
          }
          return stockPrev;
        });
        return [...prev, colorName];
      }
    });
  };

  const handleSelectAllPresets = () => {
    const presetNames = PRESET_COLORS.map((c) => c.name);
    setSelectedColors((prev) => Array.from(new Set([...prev, ...presetNames])));
    setColorRatioStockMap((stockPrev) => {
      const next = { ...stockPrev };
      for (const c of presetNames) {
        const clean = cleanColorName(c);
        if (!next[clean] || Object.keys(next[clean]).length === 0) {
          next[clean] = { [formData.sizesRatio]: Math.max(4, bulkSetsInput) };
        }
      }
      return next;
    });
  };

  const handleClearColors = () => {
    setSelectedColors([]);
  };

  const handleAddCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    const newItems = trimmed
      .split(",")
      .map((s) => cleanColorName(s.trim()))
      .filter(Boolean);
    if (newItems.length === 0) return;

    // Match case-insensitively with standard presets if applicable
    const normalizedNewItems = newItems.map((item) => {
      const matched = PRESET_COLORS.find(
        (p) => p.name.toLowerCase() === item.toLowerCase()
      );
      return matched ? matched.name : item;
    });

    // Add to customColorsList if not present in standard presets
    setCustomColorsList((prev) => {
      const next = [...prev];
      for (const item of normalizedNewItems) {
        if (
          !PRESET_COLORS.some((p) => p.name.toLowerCase() === item.toLowerCase()) &&
          !next.some((c) => c.toLowerCase() === item.toLowerCase())
        ) {
          next.push(item);
        }
      }
      return next;
    });

    // Select the colors
    setSelectedColors((prev) => {
      const updated = [...prev];
      for (const item of normalizedNewItems) {
        if (!updated.some((c) => c.toLowerCase() === item.toLowerCase())) {
          updated.push(item);
        }
      }
      return updated;
    });

    // Initialize ratio stock for new colors
    setColorRatioStockMap((stockPrev) => {
      const next = { ...stockPrev };
      for (const item of normalizedNewItems) {
        const clean = cleanColorName(item);
        if (!next[clean] || Object.keys(next[clean]).length === 0) {
          next[clean] = { [formData.sizesRatio || "30 to 38"]: Math.max(4, bulkSetsInput) };
        }
      }
      return next;
    });

    // Switch active stock color
    setActiveStockColor(normalizedNewItems[0]);
    setCustomColorInput("");
    toast(
      `Added and selected ${normalizedNewItems.length} color${
        normalizedNewItems.length > 1 ? "s" : ""
      }: ${normalizedNewItems.join(", ")}`,
      "success"
    );
  };

  const handleRemoveColor = (colorName: string) => {
    const clean = cleanColorName(colorName);
    setSelectedColors((prev) => prev.filter((c) => c !== colorName));
    setCustomColorsList((prev) => prev.filter((c) => c.toLowerCase() !== colorName.toLowerCase()));
    setColorImages((prev) => {
      const copy = { ...prev };
      delete copy[colorName];
      delete copy[clean];
      return copy;
    });
    setColorRatioStockMap((prev) => {
      const copy = { ...prev };
      delete copy[clean];
      return copy;
    });
    setColorLooseStockMap((prev) => {
      const copy = { ...prev };
      delete copy[clean];
      return copy;
    });
  };

  // Image management
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (imagesList.length + files.length > MAX_IMAGES) {
      toast(`You can only upload up to ${MAX_IMAGES} photos in total.`, "error");
      return;
    }

    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // High compression to ensure fast loading (<150KB per image)
        const dataUrl = await compressImageFile(file, 850, 850, 0.70);
        uploadedUrls.push(dataUrl);
      }

      if (uploadedUrls.length > 0) {
        setImagesList((prev) => [...prev, ...uploadedUrls]);

        // Automatically extract all colors present in the uploaded garment photo(s)
        const extractedSet = new Set<string>();
        for (const url of uploadedUrls) {
          const colors = await extractColorsFromImage(url);
          for (const c of colors) {
            extractedSet.add(c);
          }
        }

        const detected = Array.from(extractedSet);
        if (detected.length > 0) {
          setSelectedColors(detected);
          setActiveStockColor(detected[0]);
          const alphabetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
          const initialMap: Record<string, string> = {};
          detected.forEach((col, idx) => {
            initialMap[alphabetLetters[idx] || `C${idx + 1}`] = col;
          });
          setColorAlphabetMap(initialMap);
          setColorRatioStockMap((stockPrev) => {
            const next = { ...stockPrev };
            for (const col of detected) {
              const clean = cleanColorName(col);
              if (!next[clean] || Object.keys(next[clean]).length === 0) {
                next[clean] = { [formData.sizesRatio || "30 to 38"]: Math.max(4, bulkSetsInput) };
              }
            }
            return next;
          });

          // Add any non-standard preset colors to customColorsList
          setCustomColorsList((prev) => {
            const next = [...prev];
            for (const c of detected) {
              if (
                !PRESET_COLORS.some((p) => p.name.toLowerCase() === c.toLowerCase()) &&
                !next.some((x) => x.toLowerCase() === c.toLowerCase())
              ) {
                next.push(c);
              }
            }
            return next;
          });

          toast(
            `Uploaded ${uploadedUrls.length} photo${uploadedUrls.length > 1 ? "s" : ""}! Auto-detected ${detected.length} color${detected.length > 1 ? "s" : ""}: ${detected.join(", ")}`,
            "success"
          );
        } else {
          toast(`Uploaded ${uploadedUrls.length} photo${uploadedUrls.length > 1 ? "s" : ""} successfully!`, "success");
        }
      }
    } catch (err: any) {
      console.error("Image upload error:", err);
      toast("Error uploading photo: " + (err.message || "Failed to process photo"), "error");
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDetectColorsFromImages = async () => {
    if (imagesList.length === 0) {
      toast("Please upload a product photo first to detect colors", "error");
      return;
    }
    setDetectingColors(true);
    try {
      const extractedSet = new Set<string>();
      for (const url of imagesList) {
        const colors = await extractColorsFromImage(url);
        for (const c of colors) {
          extractedSet.add(c);
        }
      }
      const detected = Array.from(extractedSet);
      if (detected.length === 0) {
        toast("No distinct garment colors recognized from photo. You can type colors in the box below.", "info");
        return;
      }

      // Set precisely the detected colors from the photo
      setSelectedColors(detected);
      setActiveStockColor(detected[0]);
      const alphabetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      const initialMap: Record<string, string> = {};
      detected.forEach((col, idx) => {
        initialMap[alphabetLetters[idx] || `C${idx + 1}`] = col;
      });
      setColorAlphabetMap(initialMap);
      setColorRatioStockMap((stockPrev) => {
        const next = { ...stockPrev };
        for (const col of detected) {
          const clean = cleanColorName(col);
          if (!next[clean] || Object.keys(next[clean]).length === 0) {
            next[clean] = { [formData.sizesRatio || "30 to 38"]: Math.max(4, bulkSetsInput) };
          }
        }
        return next;
      });

      setCustomColorsList((prev) => {
        const next = [...prev];
        for (const c of detected) {
          if (
            !PRESET_COLORS.some((p) => p.name.toLowerCase() === c.toLowerCase()) &&
            !next.some((x) => x.toLowerCase() === c.toLowerCase())
          ) {
            next.push(c);
          }
        }
        return next;
      });

      toast(
        `Auto-detected ${detected.length} color${detected.length > 1 ? "s" : ""} from photo: ${detected.join(", ")}`,
        "success"
      );
    } catch (err: any) {
      toast("Color detection error: " + err.message, "error");
    } finally {
      setDetectingColors(false);
    }
  };

  const handleAddExternalUrl = async () => {
    const url = externalUrlInput.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
      toast("Please enter a valid HTTP(S) image URL", "error");
      return;
    }
    if (imagesList.length >= MAX_IMAGES) {
      toast(`Maximum ${MAX_IMAGES} photos reached`, "error");
      return;
    }
    setImagesList((prev) => [...prev, url]);
    setExternalUrlInput("");
    setShowUrlInput(false);

    try {
      const colors = await extractColorsFromImage(url);
      if (colors.length > 0) {
        setSelectedColors((prev) => {
          const combined = prev.length === 0 ? colors : Array.from(new Set([...prev, ...colors]));
          if (combined.length > 0) {
            setActiveStockColor(combined[0]);
            setColorRatioStockMap((stockPrev) => {
              const next = { ...stockPrev };
              for (const col of combined) {
                const clean = cleanColorName(col);
                if (!next[clean] || Object.keys(next[clean]).length === 0) {
                  next[clean] = { [formData.sizesRatio || "30 to 38"]: Math.max(4, bulkSetsInput) };
                }
              }
              return next;
            });
          }
          return combined;
        });

        setCustomColorsList((prev) => {
          const next = [...prev];
          for (const c of colors) {
            if (
              !PRESET_COLORS.some((p) => p.name.toLowerCase() === c.toLowerCase()) &&
              !next.some((x) => x.toLowerCase() === c.toLowerCase())
            ) {
              next.push(c);
            }
          }
          return next;
        });

        toast(`Photo URL added! Detected ${colors.length} colors: ${colors.join(", ")}`, "success");
      } else {
        toast("Photo URL added to gallery", "success");
      }
    } catch {
      toast("Photo URL added to gallery", "success");
    }
  };

  const handleRemoveImage = (index: number) => {
    setImagesList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMakeCover = (index: number) => {
    setImagesList((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
    toast("Cover photo updated", "success");
  };

  const handleMoveImage = (from: number, to: number) => {
    if (to < 0 || to >= imagesList.length) return;
    setImagesList((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Product Name is required");
      toast("Product Name is required", "error");
      return;
    }

    if (selectedColors.length === 0) {
      setError("Please select or add at least one color for the garment");
      toast("Please select or add at least one color for the garment", "error");
      return;
    }

    setSubmitting(true);
    try {
      // Normalize size guide rows to Inches so frontend can toggle seamlessly
      const normalizedSizeGuide = sizeGuideRows.map((row) => {
        if (sizeGuideUnit === "CM") {
          const toInches = (val: string) => {
            const num = parseFloat(val);
            if (isNaN(num)) return val;
            const inch = (num / 2.54).toFixed(1);
            return inch.endsWith(".0") ? inch.slice(0, -2) : inch;
          };
          return {
            brandSize: row.brandSize,
            waist: toInches(row.waist),
            length: toInches(row.length),
          };
        }
        return row;
      });

      // Generate clean setsColorwise from colorRatioStockMap and colorLooseStockMap for selectedColors
      let totalLoosePcs = 0;
      const finalStockMap: Record<string, { ratios: Record<string, number>; loosePcs: Record<string, number> }> = {};
      for (const c of selectedColors) {
        const clean = cleanColorName(c);
        const rawRatios = colorRatioStockMap[clean] || {};
        let ratios = { ...rawRatios };
        if (Object.keys(ratios).length === 0) {
          ratios = { [formData.sizesRatio || "28 to 36"]: 0 };
        }
        const loose = colorLooseStockMap[clean] || {};

        finalStockMap[clean] = {
          ratios: {},
          loosePcs: {},
        };
        for (const [r, count] of Object.entries(ratios)) {
          finalStockMap[clean].ratios[r] = Math.max(0, parseInt(String(count), 10) || 0);
        }
        for (const [sz, count] of Object.entries(loose)) {
          const num = Math.max(0, parseInt(String(count), 10) || 0);
          if (num > 0) {
            finalStockMap[clean].loosePcs[sz] = num;
            totalLoosePcs += num;
          }
        }
      }
      const serializedStock = JSON.stringify(finalStockMap);

      const numMrp = formData.mrp ? parseFloat(String(formData.mrp)) : null;
      const retPrice = formData.retailerPrice !== undefined && !isNaN(Number(formData.retailerPrice))
        ? parseFloat(String(formData.retailerPrice))
        : numMrp ? Math.round(numMrp / 2) : Number(formData.price) || 0;
      const whoPrice = formData.wholesalerPrice !== undefined && !isNaN(Number(formData.wholesalerPrice))
        ? parseFloat(String(formData.wholesalerPrice))
        : Math.max(0, retPrice - 100);

      // Primary size ratio is explicitly formData.sizesRatio (or the primary ratio from colors)
      const primaryClean = cleanColorName(activeStockColor || selectedColors[0] || "");
      const primaryRatios = colorRatioStockMap[primaryClean] || {};
      const sortedKeys = sortSizeRatioKeys(Object.keys(primaryRatios), formData.sizesRatio);
      const primaryRatioName = formData.sizesRatio || sortedKeys[0] || "28 to 36";
      const primarySizes = getSizesFromRatio(primaryRatioName);
      const primaryPcs = primarySizes.length > 0 && primarySizes[0] !== primaryRatioName ? primarySizes.length : (formData.pcsPerSet || 5);

      const sortedColors = sortColorsByAlphabet(selectedColors, colorAlphabetMap);

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        colorsAvailable: sortedColors.join(", "),
        sizesRatio: primaryRatioName,
        sizesList: primarySizes.join(", ") || formData.sizesList,
        pcsPerSet: primaryPcs,
        mrp: numMrp,
        retailerPrice: retPrice,
        wholesalerPrice: whoPrice,
        price: retPrice,
        costPrice: formData.costPrice !== undefined && String(formData.costPrice).trim() !== "" ? parseFloat(String(formData.costPrice)) : null,
        mixPcs: totalLoosePcs,
        colorImages: Object.keys(colorImages).length > 0 ? JSON.stringify(colorImages) : null,
        setsColorwise: serializedStock || null,
        sizeGuide: JSON.stringify(normalizedSizeGuide),
        imageUrl: imagesList.length > 0 ? JSON.stringify(imagesList) : null,
        colorMapping: JSON.stringify(colorAlphabetMap),
        isActive: formData.isActive,
      };

      const method = isEdit ? "PUT" : "POST";
      const endpoint = isEdit ? `/api/products/${productId}` : "/api/products";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast(
          isEdit ? "Garment updated successfully!" : "New wholesale garment added!",
          "success"
        );
        router.push("/admin/products");
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to save product");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while saving.");
      toast(err.message || "Failed to save product", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8 pb-16">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-black transition-colors mb-1.5"
          >
            <ArrowLeft size={14} />
            <span>Back to Products Catalog</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-700" />
            <span>{isEdit ? `Edit Garment: ${formData.name}` : "Add New Wholesale Garment"}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure garment specifications, wholesale pack ratio, color palette, and pricing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/products"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isEdit ? "Update Garment" : "Save Garment"}</span>
          </button>
        </div>
      </div>

      {/* 1. Garment Details & Basic Information */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Garment Details
        </h2>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
            Product Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Slim Fit Stretch Cotton Trouser or IMP-001"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all"
          />
        </div>

        {/* 1. Product Description (Collapsible Hamburger - OPEN by default) */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs transition-all">
          <button
            type="button"
            onClick={() => setIsDescriptionOpen((prev) => !prev)}
            className="w-full px-5 py-4 bg-gray-50/70 hover:bg-gray-100/70 transition-colors flex items-center justify-between text-left select-none border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-gray-800 shadow-2xs">
                <Menu className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                    Product Description
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full uppercase">
                    Collapsible
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fabric specifications, weave architecture, fit silhouette & pocket details
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-xs font-medium text-gray-400 hidden sm:inline">
                {isDescriptionOpen ? "Collapse" : "Expand"}
              </span>
              <div className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-600 transition-transform">
                {isDescriptionOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {isDescriptionOpen && (
            <div className="p-5 space-y-2 animate-fadeIn">
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Engineered from 4-way stretch high-twist twill with adaptive flex waistband. Perfect for boardroom elegance and 24/7 travel comfort..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all leading-relaxed placeholder:text-gray-400"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                <span>Markdown or clean text supported</span>
                <span>{formData.description.length} characters</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. Product Size Guide (Collapsible Accordion with Dedicated Header & Prefilled Rows) */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs transition-all">
          <div
            className="w-full px-5 py-4 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 select-none cursor-pointer hover:bg-gray-100/70 transition-colors"
            onClick={() => setIsSizeGuideOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-zinc-900 shadow-2xs">
                <Ruler className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                    Product Size Guide
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                    Fixed Sizes 28–44
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Brand sizes are fixed (28 to 44). You can customize Waist and Length in both IN and CM.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
              {/* Unit Toggle: IN or CM */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">Unit:</span>
                <div className="inline-flex rounded-lg bg-gray-200/70 p-0.5 border border-gray-300/80">
                  <button
                    type="button"
                    onClick={() => handleToggleSizeGuideUnit("IN")}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      sizeGuideUnit === "IN"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    IN (Inches)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSizeGuideUnit("CM")}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      sizeGuideUnit === "CM"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    CM (Centimeters)
                  </button>
                </div>
              </div>

              {/* Collapse/Expand button */}
              <button
                type="button"
                onClick={() => setIsSizeGuideOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black p-1.5 rounded-lg hover:bg-gray-200/60 transition-colors"
              >
                <span className="hidden sm:inline">
                  {isSizeGuideOpen ? "Collapse" : "Expand"}
                </span>
                {isSizeGuideOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {isSizeGuideOpen && (
            <div className="p-5 space-y-4 animate-fadeIn">
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase font-bold text-gray-700 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Brand Size (Fixed)
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Waist ({sizeGuideUnit}) *
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Length ({sizeGuideUnit}) *
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sizeGuideRows.map((row, idx) => (
                      <tr key={row.brandSize} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200/80 font-bold text-gray-900 text-xs sm:text-sm min-w-[50px]">
                            {row.brandSize}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                required
                                value={row.waist}
                                onChange={(e) =>
                                  handleSizeGuideChange(idx, "waist", e.target.value)
                                }
                                placeholder={`e.g. ${sizeGuideUnit === "CM" ? "71.1" : row.brandSize}`}
                                className="w-full max-w-[130px] px-3 py-1.5 rounded-lg border border-gray-300 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-black"
                              />
                              <span className="text-xs font-semibold text-gray-500">
                                {sizeGuideUnit}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400 font-medium">
                              ≈ {getConvertedEquivalent(row.waist, sizeGuideUnit)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                required
                                value={row.length}
                                onChange={(e) =>
                                  handleSizeGuideChange(idx, "length", e.target.value)
                                }
                                placeholder={`e.g. ${sizeGuideUnit === "CM" ? "104.1" : "41"}`}
                                className="w-full max-w-[130px] px-3 py-1.5 rounded-lg border border-gray-300 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-black"
                              />
                              <span className="text-xs font-semibold text-gray-500">
                                {sizeGuideUnit}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400 font-medium">
                              ≈ {getConvertedEquivalent(row.length, sizeGuideUnit)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-500">
                  Default preset: 28 28 41, 30 30 41, 32 32 41, 34 34 41, 36 36 41, 38 38 41, 40 40 41, 42 42 41, 44 44 41
                </p>

                <button
                  type="button"
                  onClick={handleResetSizeGuide}
                  className="text-xs text-gray-500 hover:text-gray-900 underline cursor-pointer"
                >
                  Reset to Standard Sizing
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Category & Wholesale Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Category *
              </label>
              {formData.category &&
                categoriesList.length > 0 &&
                !categoriesList.some((c) => c.toLowerCase() === formData.category.toLowerCase()) && (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full uppercase">
                    Category Deleted
                  </span>
                )}
            </div>

            {formData.category &&
              categoriesList.length > 0 &&
              !categoriesList.some((c) => c.toLowerCase() === formData.category.toLowerCase()) && (
                <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    Previous category <strong>&quot;{formData.category}&quot;</strong> was deleted from Categories. Please choose an active category below.
                  </p>
                </div>
              )}

            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all cursor-pointer"
            >
              {formData.category &&
                categoriesList.length > 0 &&
                !categoriesList.some((c) => c.toLowerCase() === formData.category.toLowerCase()) && (
                  <option value={formData.category} disabled>
                    {formData.category} (Category Deleted — Please Reassign)
                  </option>
                )}
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Mandatory Size Set Ratio (Wholesale Set Architecture) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Mandatory Size Ratio *
              </label>
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                {formData.sizesRatio} • {formData.pcsPerSet} pcs/set
              </span>
            </div>

            <div className="space-y-2">
              <select
                value={
                  STANDARD_SIZE_RATIOS.some(
                    (s) => s.value.toLowerCase() === (formData.sizesRatio || "").toLowerCase()
                  )
                    ? STANDARD_SIZE_RATIOS.find(
                        (s) => s.value.toLowerCase() === (formData.sizesRatio || "").toLowerCase()
                      )!.value
                    : "__custom__"
                }
                onChange={(e) => {
                  if (e.target.value !== "__custom__") {
                    handlePrimaryRatioChange(e.target.value, true);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all cursor-pointer font-medium"
              >
                {STANDARD_SIZE_RATIOS.map((std) => (
                  <option key={std.value} value={std.value}>
                    {std.label}
                  </option>
                ))}
                <option value="__custom__">Custom Ratio (Type below)...</option>
              </select>

              {/* Custom Ratio Input or quick editor */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. 28 to 40, 28 to 42, 38 to 40"
                  value={formData.sizesRatio}
                  onChange={(e) => handlePrimaryRatioChange(e.target.value, true)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-black"
                />
                <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap bg-gray-50 px-2 py-1 rounded border border-gray-200">
                  [{formData.sizesList}]
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Supports 2-size sets (e.g. 38 to 40), 5-size sets (28 to 36), up to 8-size sets (28 to 42, 26 to 40).
            </p>
          </div>

          {/* Dual Selling Price Configuration */}
          <div className="sm:col-span-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <span>Dual Selling Price Engine</span>
                <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  Retailer = MRP/2 • Wholesaler = MRP/2 - 100
                </span>
              </label>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                + 5% GST in Order
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-gray-200">
              {/* 1. MRP Input */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  MRP (Maximum Retail Price) (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formData.mrp}
                    onChange={(e) => handleMrpChange(e.target.value)}
                    placeholder="1000"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-black font-mono font-bold text-gray-900"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Base printed retail price tag</p>
              </div>

              {/* 2. Retailer Type Selling Price: MRP / 2 */}
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200/80">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-900">
                    Retailer Selling Price (₹)
                  </label>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded">
                    MRP / 2
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-blue-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.retailerPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        retailerPrice: val,
                        wholesalerPrice: Math.max(0, val - 100),
                        price: val,
                      });
                    }}
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-blue-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono font-bold text-blue-950"
                  />
                </div>
                <p className="text-[10px] text-blue-700 mt-1">Calculated as {formData.mrp ? Math.round(Number(formData.mrp) / 2) : 0} (MRP ÷ 2)</p>
              </div>

              {/* 3. Wholesaler Type Selling Price: MRP / 2 - 100 */}
              <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200/80">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-900">
                    Wholesaler Selling Price (₹)
                  </label>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded">
                    (MRP/2) - 100
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-purple-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.wholesalerPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wholesalerPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-purple-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-600 font-mono font-bold text-purple-950"
                  />
                </div>
                <p className="text-[10px] text-purple-700 mt-1">Calculated as Retailer Price - ₹100 / piece</p>
              </div>
            </div>

            {/* Costing & Loose Stock (Mix Pcs) for Admin Stock Tab */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200/60">
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/80">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    Costing / Piece (₹)
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                    Inventory Valuation
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-emerald-600 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        costPrice: e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="e.g. 450"
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono font-bold text-emerald-950"
                  />
                </div>
                <p className="text-[10px] text-emerald-700 mt-1">Costing basis shown on Admin Stock tab to calculate total valuation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Product Photos (Up to 10 photos - Multi-Photo Upload & Reorder) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-700" />
              <span>Product Photos (Up to 10)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Add up to 10 high-resolution photos. Photo #1 is the primary cover displayed on catalog cards.
            </p>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              imagesList.length >= MAX_IMAGES
                ? "bg-emerald-100 text-emerald-800"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {imagesList.length} / {MAX_IMAGES} {imagesList.length >= MAX_IMAGES ? "(Max)" : "Photos"}
          </span>
        </div>

        {/* Dropzone / Upload Button */}
        {imagesList.length < MAX_IMAGES ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-gray-300 hover:border-gray-900 bg-gray-50/60 hover:bg-gray-50 rounded-2xl p-8 text-center cursor-pointer transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-700 shadow-xs group-hover:scale-105 transition-transform">
                {uploadingImages ? (
                  <Loader2 className="w-6 h-6 animate-spin text-gray-900" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {uploadingImages
                    ? "Uploading photos..."
                    : `Click to upload photos from computer (Up to ${MAX_IMAGES - imagesList.length} more)`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, JPEG, PNG, WEBP supported • Up to 10 photos per garment
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center text-xs text-emerald-800 font-medium">
            Maximum 10 photos added. You can change cover, reorder, or delete any photo below.
          </div>
        )}

        {/* Image Grid Preview */}
        {imagesList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Uploaded Gallery ({imagesList.length} of {MAX_IMAGES})
              </label>
              <span className="text-[11px] text-gray-400">
                Hover to reorder or set cover
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              {imagesList.map((imgUrl, idx) => {
                const assignedColor = (() => {
                  for (const [col, url] of Object.entries(colorImages)) {
                    if (url === imgUrl) return col;
                  }
                  return "";
                })();

                return (
                  <div
                    key={idx}
                    className="group relative rounded-xl overflow-hidden bg-white border border-gray-200 shadow-xs flex flex-col justify-between"
                  >
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      <img
                        src={imgUrl}
                        alt={`Product photo ${idx + 1}`}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23f3f4f6'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%239ca3af'>Photo Unavailable</text></svg>";
                        }}
                      />

                      {/* Top Bar: Number badge & Delete */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs pointer-events-auto ${
                            idx === 0
                              ? "bg-black/90 text-white shadow-xs"
                              : "bg-black/65 text-white"
                          }`}
                        >
                          {idx === 0 ? (
                            <>
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>Cover</span>
                            </>
                          ) : (
                            <span>#{idx + 1}</span>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1.5 rounded-md bg-red-600/90 hover:bg-red-600 text-white shadow-xs pointer-events-auto transition-transform hover:scale-105 cursor-pointer"
                          title="Delete photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bottom Bar: Reorder arrows & Cover button on hover */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, idx - 1)}
                              className="p-1 rounded-md bg-white/95 hover:bg-white text-gray-800 shadow-xs cursor-pointer"
                              title="Move earlier"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {idx < imagesList.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, idx + 1)}
                              className="p-1 rounded-md bg-white/95 hover:bg-white text-gray-800 shadow-xs cursor-pointer"
                              title="Move later"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleMakeCover(idx)}
                            className="px-2 py-1 rounded-md bg-white/95 text-black text-[10px] font-semibold hover:bg-white shadow-xs cursor-pointer"
                            title="Set as Cover Photo"
                          >
                            Set Cover
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Color Assignment Selector */}
                    <div className="p-1.5 bg-gray-50 border-t border-gray-200">
                      <select
                        value={assignedColor}
                        onChange={(e) => {
                          const chosenColor = e.target.value;
                          setColorImages((prev) => {
                            const copy = { ...prev };
                            for (const [col, url] of Object.entries(copy)) {
                              if (url === imgUrl) delete copy[col];
                            }
                            if (chosenColor) {
                              copy[chosenColor] = imgUrl;
                            }
                            return copy;
                          });
                        }}
                        className={`w-full text-[11px] font-semibold rounded px-1.5 py-1 border transition-colors cursor-pointer ${
                          assignedColor
                            ? "bg-black text-white border-black font-bold"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                        title="Link this photo to a garment color"
                      >
                        <option value="" className="bg-white text-gray-900">
                          (General / Cover)
                        </option>
                        {selectedColors.map((col) => (
                          <option key={col} value={col} className="bg-white text-gray-900">
                            Color: {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Add by External URL toggle */}
        <div className="pt-2">
          {!showUrlInput ? (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="text-xs text-gray-500 hover:text-black font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Or add image via web URL</span>
            </button>
          ) : (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
              <label className="block text-xs font-semibold text-gray-700">
                Image Web URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={externalUrlInput}
                  onChange={(e) => setExternalUrlInput(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-black"
                />
                <button
                  type="button"
                  onClick={handleAddExternalUrl}
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Add URL
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Available Colors Section (Palette) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-gray-700" />
              <span>Available Colors Palette</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select or type the color variants available for this trouser design.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {imagesList.length > 0 && (
              <button
                type="button"
                onClick={handleDetectColorsFromImages}
                disabled={detectingColors}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-102"
                title="Scan uploaded garment photo and detect all colors automatically"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-600 ${detectingColors ? "animate-spin" : ""}`} />
                <span>{detectingColors ? "Detecting Colors..." : "Auto-Detect from Photo"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAllPresets}
              className="text-xs text-gray-600 hover:text-black font-medium underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={handleClearColors}
              className="text-xs text-gray-600 hover:text-black font-medium underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Standard Color Presets */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2.5">
            Standard Trouser Colors ({PRESET_COLORS.length})
          </label>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_COLORS.map((color) => {
              const isSelected = selectedColors.includes(color.name);
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => handleToggleColor(color.name)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-gray-900 text-white border-gray-900 shadow-xs ring-1 ring-black"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border shrink-0"
                    style={{
                      backgroundColor: color.hex,
                      borderColor: color.border ? "#cbd5e1" : "transparent",
                    }}
                  />
                  <span>{color.name}</span>
                  {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Added Color Shades (Clickable palette buttons) */}
        {customColorsList.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-900 mb-2.5 flex items-center justify-between">
              <span>Custom & Added Shades ({customColorsList.length})</span>
              <span className="text-[11px] text-gray-500 font-normal lowercase">Click to toggle active selection</span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {customColorsList.map((color) => {
                const isSelected = selectedColors.includes(color);
                const colorInfo = getColorHex(color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleToggleColor(color)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-gray-900 text-white border-gray-900 shadow-xs ring-1 ring-black"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: colorInfo.hex }}
                    />
                    <span>{color}</span>
                    {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Color Input */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Add Custom Color Name (If shade is not in palette above)
            </label>
            {customColorInput.trim() && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block shadow-2xs"
                  style={{ backgroundColor: getColorHex(customColorInput).hex }}
                />
                <span>Palette Preview: <code className="text-gray-900 font-mono text-[11px]">{getColorHex(customColorInput).hex}</code></span>
              </span>
            )}
          </div>
          <div className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="e.g. Royal Navy, Slate Blue, Stone Beige, Mint Green, Rust..."
                value={customColorInput}
                onChange={(e) => setCustomColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomColor();
                  }
                }}
                className="w-full px-3.5 py-2 pl-9 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-black"
              />
              <span
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-gray-300 shadow-2xs transition-colors"
                style={{
                  backgroundColor: customColorInput.trim()
                    ? getColorHex(customColorInput).hex
                    : "#cbd5e1",
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleAddCustomColor}
              disabled={!customColorInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors cursor-pointer disabled:opacity-40"
            >
              <span>+ Add Color</span>
            </button>
          </div>
        </div>

        {/* Currently Selected Colors Chips */}
        {selectedColors.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <p className="text-xs font-semibold text-gray-700">
              Selected Colors ({selectedColors.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedColors.map((color) => {
                const colorInfo = getColorHex(color);
                return (
                  <span
                    key={color}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-900 shadow-2xs"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: colorInfo.hex }}
                    />
                    <span>{color}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Color Alphabet Mapping (Admin Wholesale Codes: A -> Ice Grey, B -> Black) */}
        {selectedColors.length > 0 && (
          <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-950 uppercase tracking-wider block">
                    Color Alphabet Mapping (Admin Only)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-200/70 text-orange-900 rounded-md">
                    Admin Exclusive
                  </span>
                </div>
                <p className="text-[11px] text-orange-800/80 mt-0.5">
                  Assign wholesale letter codes (A, B, C, etc.) to each color below. Click and type any letter or code for each color.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {sortColorsByAlphabet(selectedColors, colorAlphabetMap).map((color, idx) => {
                const colorPreset = PRESET_COLORS.find(
                  (c) => c.name.toLowerCase() === color.toLowerCase()
                );
                const colorInfo = colorPreset
                  ? { hex: colorPreset.hex, isLight: colorPreset.border || false }
                  : getColorHex(color);

                // Look up custom assigned letter or fallback to sequential A, B, C...
                const assignedLetter =
                  Object.entries(colorAlphabetMap).find(
                    ([_, c]) => cleanColorName(c).toLowerCase() === cleanColorName(color).toLowerCase()
                  )?.[0]?.toUpperCase() || String.fromCharCode(65 + idx);

                const availableLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").slice(0, Math.max(selectedColors.length, 6));

                return (
                  <div
                    key={color}
                    className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-orange-200/90 shadow-2xs hover:border-orange-400 transition"
                  >
                    <div className="relative shrink-0 flex items-center gap-1">
                      <select
                        value={assignedLetter}
                        onChange={(e) => handleColorLetterChange(color, e.target.value)}
                        className="w-10 h-8 rounded-lg bg-zinc-900 text-white font-mono font-black text-xs text-center border border-zinc-700 uppercase focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-2xs pl-1.5"
                        title="Change wholesale letter code — automatically moves beside alphabets in order"
                      >
                        {availableLetters.map((ltr) => (
                          <option key={ltr} value={ltr}>
                            {ltr}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveColorAlphabet(color, -1)}
                          disabled={idx === 0}
                          className="w-4 h-3.5 flex items-center justify-center bg-orange-100 hover:bg-orange-200 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[8px] text-orange-950 font-bold cursor-pointer"
                          title="Move left to earlier alphabet (A <- B)"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColorAlphabet(color, 1)}
                          disabled={idx === selectedColors.length - 1}
                          className="w-4 h-3.5 flex items-center justify-center bg-orange-100 hover:bg-orange-200 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[8px] text-orange-950 font-bold cursor-pointer"
                          title="Move right to later alphabet (B -> C)"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    <span
                      className="w-4 h-4 rounded-full border shrink-0"
                      style={{
                        backgroundColor: colorInfo.hex,
                        borderColor: colorInfo.isLight ? "#cbd5e1" : "rgba(0,0,0,0.15)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-gray-900 truncate block">
                        {color}
                      </span>
                      <span className="text-[10px] text-orange-800 font-mono">
                        Code: <span className="font-bold">{assignedLetter}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Colorwise Inventory: Size Ratios & Loose Pieces */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-zinc-800" />
              <span>Colorwise Inventory (Ratios &amp; Loose Pieces)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Select each color tab to separately configure wholesale size packs and single loose pieces for retail storefront sales.
            </p>
          </div>

          {/* Quick Bulk Tools */}
          {selectedColors.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded-xl">
              <span className="text-xs font-semibold text-gray-600">Bulk Sets:</span>
              <input
                type="number"
                min="0"
                value={bulkSetsInput}
                onChange={(e) => setBulkSetsInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-16 px-2 py-1 text-center font-mono font-bold text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="button"
                onClick={() => handleBulkSetStock(bulkSetsInput)}
                className="px-3 py-1 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Apply to All
              </button>
              <button
                type="button"
                onClick={() => handleBulkSetStock(0)}
                className="px-2 py-1 text-gray-500 hover:text-red-600 text-xs font-semibold transition-colors cursor-pointer"
                title="Reset all colors to 0 sets"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {selectedColors.length === 0 ? (
          <div className="p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-center space-y-2">
            <Palette className="w-8 h-8 text-gray-400 mx-auto" />
            <div className="text-sm font-semibold text-gray-700">No Colors Selected</div>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Please select at least one color in the &quot;Available Colors Palette&quot; above to configure size ratios and loose inventory.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Color Navigation Tabs */}
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                Choose Color to Configure:
              </div>
              <div className="flex flex-wrap gap-2">
                {sortColorsByAlphabet(selectedColors, colorAlphabetMap).map((color, idx) => {
                  const clean = cleanColorName(color);
                  const ratios = colorRatioStockMap[clean] || {};
                  const loose = colorLooseStockMap[clean] || {};
                  const calc = calculateTotalColorPieces(ratios, loose, formData.pcsPerSet || 5);
                  const colorPreset = PRESET_COLORS.find(
                    (c) => c.name.toLowerCase() === color.toLowerCase()
                  );
                  const colorInfo = colorPreset ? { hex: colorPreset.hex, isLight: colorPreset.border || false } : getColorHex(color);
                  const hex = colorInfo.hex;
                  const isLight = colorInfo.isLight;
                  const isActive = (activeStockColor || selectedColors[0]) === color;
                  const assignedLetter =
                    Object.entries(colorAlphabetMap).find(
                      ([_, c]) => cleanColorName(c).toLowerCase() === cleanColorName(color).toLowerCase()
                    )?.[0]?.toUpperCase() || String.fromCharCode(65 + idx);

                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setActiveStockColor(color)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                          isActive ? "bg-white/20 text-white" : "bg-orange-100 text-orange-950 border border-orange-200"
                        }`}
                      >
                        {assignedLetter}
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border shrink-0"
                        style={{
                          backgroundColor: hex,
                          borderColor: isLight ? "#cbd5e1" : "rgba(0,0,0,0.15)",
                        }}
                      />
                      <span>{color}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {calc.totalSets} Sets · {calc.loosePcs} Loose
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Color Workspace Card */}
            {(() => {
              const currentColor = selectedColors.includes(activeStockColor)
                ? activeStockColor
                : selectedColors[0];
              const clean = cleanColorName(currentColor);
              const ratios = colorRatioStockMap[clean] || {};
              const loose = colorLooseStockMap[clean] || {};
              const calc = calculateTotalColorPieces(ratios, loose, formData.pcsPerSet || 5);
              const breakdown = calculateColorSizesBreakdown(ratios, loose);
              const colorPreset = PRESET_COLORS.find(
                (c) => c.name.toLowerCase() === currentColor.toLowerCase()
              );
              const colorInfo = colorPreset ? { hex: colorPreset.hex, isLight: colorPreset.border || false } : getColorHex(currentColor);
              const hex = colorInfo.hex;
              const isLight = colorInfo.isLight;

              // Default sizes list for loose piece stepper
              const standardLooseSizes = ["28", "30", "32", "34", "36", "38", "40", "42"];
              const allLooseSizes = Array.from(
                new Set([...standardLooseSizes, ...Object.keys(loose)])
              ).sort((a, b) => {
                const numA = parseInt(a, 10);
                const numB = parseInt(b, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
              });

              return (
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6">
                  {/* Top Bar of Active Color */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-5 h-5 rounded-full border shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: hex,
                          borderColor: isLight ? "#cbd5e1" : "rgba(0,0,0,0.15)",
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{currentColor}</span>
                          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            Total: {calc.totalPcs} PCS
                          </span>
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ₹{(calc.totalPcs * (formData.price || 0)).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {calc.totalSets} Wholesale Pack Sets + {calc.loosePcs} Loose Single Pieces
                        </p>
                      </div>
                    </div>

                    {selectedColors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleCopyColorToAll(currentColor)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-900 bg-white text-gray-700 hover:text-black text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        title={`Copy ${currentColor}'s size ratios and loose inventory to all other colors`}
                      >
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>Copy Setup to All Colors</span>
                      </button>
                    )}
                  </div>

                  {/* 2-Column Responsive Layout: Left = Ratios, Right = Loose Pieces */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: Wholesale Size Ratio Packs */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                            Wholesale Size Ratio Packs
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {calc.totalSets} Sets ({calc.setPcs} Pcs)
                        </span>
                      </div>

                      {/* Standard Ratio Pack Quick Buttons */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-gray-500 block">
                          Add Standard Pack (Click to Apply / Add):
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {STANDARD_SIZE_RATIOS.map((std) => {
                            const isPresent = ratios[std.value] !== undefined;
                            return (
                              <button
                                key={std.value}
                                type="button"
                                onClick={() => handleSetRatioForColor(currentColor, std.value)}
                                className={`px-2.5 py-2 rounded-xl text-center text-xs font-semibold border transition-all cursor-pointer ${
                                  isPresent
                                    ? "bg-blue-50/80 border-blue-400 text-blue-900 shadow-2xs"
                                    : "bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/40"
                                }`}
                              >
                                <div className="font-bold">{std.value}</div>
                                <div className="text-[10px] text-gray-500 font-normal">{std.pcs} pcs/set</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Add Custom Ratio Pack */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Or Custom Ratio: e.g. 28 to 34"
                          value={customRatioInput}
                          onChange={(e) => setCustomRatioInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (customRatioInput.trim()) {
                                handleSetRatioForColor(currentColor, customRatioInput.trim());
                                setCustomRatioInput("");
                              }
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customRatioInput.trim()) {
                              handleSetRatioForColor(currentColor, customRatioInput.trim());
                              setCustomRatioInput("");
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Pack</span>
                        </button>
                      </div>

                      {/* Configured Ratios List */}
                      <div className="space-y-2.5 pt-2 border-t border-gray-100">
                        <span className="text-[11px] font-bold text-gray-700 block">
                          Configured Sets for {currentColor}:
                        </span>

                        {Object.keys(ratios).length === 0 ? (
                          <div className="p-3 bg-gray-50 rounded-lg text-center text-xs text-gray-400 italic">
                            No ratio packs configured. Click a standard pack above.
                          </div>
                        ) : (
                          sortSizeRatioKeys(Object.keys(ratios)).map((ratioKey) => {
                            const setsCount = ratios[ratioKey];
                            const ratioSizes = getSizesFromRatio(ratioKey);
                            return (
                              <div
                                key={ratioKey}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gray-50/80 border border-gray-200 p-2.5 rounded-xl"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs text-gray-900 font-mono">
                                      {ratioKey}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-normal">
                                      ({ratioSizes.length} pcs/set: {ratioSizes.join(", ")})
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Stepper */}
                                  <div className="inline-flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleColorRatioSetChange(
                                          currentColor,
                                          ratioKey,
                                          setsCount - 1
                                        )
                                      }
                                      className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-sm cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={setsCount}
                                      onChange={(e) =>
                                        handleColorRatioSetChange(
                                          currentColor,
                                          ratioKey,
                                          parseInt(e.target.value, 10) || 0
                                        )
                                      }
                                      className="w-12 h-7 text-center font-mono font-bold text-xs bg-transparent border-x border-gray-200 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleColorRatioSetChange(
                                          currentColor,
                                          ratioKey,
                                          setsCount + 1
                                        )
                                      }
                                      className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-sm cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* Unpack 1 Set */}
                                  <button
                                    type="button"
                                    onClick={() => handleUnpackSet(currentColor, ratioKey)}
                                    disabled={setsCount <= 0}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                                    title="Unpacks 1 set into loose pieces so you can sell individual sizes"
                                  >
                                    <PackageOpen className="w-3.5 h-3.5" />
                                    <span>Unpack Set</span>
                                  </button>

                                  {/* Remove Ratio */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveRatioFromColor(currentColor, ratioKey)
                                    }
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Remove this ratio pack"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Single Size Loose Pieces (Retail Storefront) */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Scissors className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                            Single Size Loose Pieces (Retail)
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {calc.loosePcs} Loose Pcs
                        </span>
                      </div>

                      <p className="text-xs text-gray-500">
                        Adjust individual sizes directly or use &quot;Unpack Set&quot; on the left when a set is broken.
                      </p>

                      {/* Loose Sizes Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {allLooseSizes.map((size) => {
                          const count = loose[size] || 0;
                          return (
                            <div
                              key={size}
                              className={`p-2 rounded-xl border text-center transition-all ${
                                count > 0
                                  ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                                  : "bg-gray-50/60 border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-gray-800 font-mono">
                                  Size {size}
                                </span>
                                {count > 0 && (
                                  <span className="text-[9px] font-bold font-mono text-emerald-700 bg-emerald-100 px-1 rounded">
                                    {count} pcs
                                  </span>
                                )}
                              </div>
                              <div className="inline-flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs w-full justify-between">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleColorLoosePieceChange(currentColor, size, count - 1)
                                  }
                                  className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={count}
                                  onChange={(e) =>
                                    handleColorLoosePieceChange(
                                      currentColor,
                                      size,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-8 h-6 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleColorLoosePieceChange(currentColor, size, count + 1)
                                  }
                                  className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Custom Loose Size */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <input
                          type="text"
                          placeholder="Custom Size (e.g. 26 or 44)"
                          value={customLooseSizeInput}
                          onChange={(e) => setCustomLooseSizeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (customLooseSizeInput.trim()) {
                                handleAddLooseSizeToColor(
                                  currentColor,
                                  customLooseSizeInput.trim()
                                );
                                setCustomLooseSizeInput("");
                              }
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customLooseSizeInput.trim()) {
                              handleAddLooseSizeToColor(
                                currentColor,
                                customLooseSizeInput.trim()
                              );
                              setCustomLooseSizeInput("");
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Size</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM: Live Storefront Available Inventory for Active Color */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">
                        Live Storefront Inventory Breakdown for {currentColor}:
                      </span>
                      <span className="text-[11px] text-gray-500">
                        (What retail &amp; online customers can purchase)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.keys(breakdown).length === 0 ||
                      Object.values(breakdown).every((v) => v === 0) ? (
                        <div className="text-xs text-gray-400 italic">
                          0 pieces available in stock for {currentColor}.
                        </div>
                      ) : (
                        Object.entries(breakdown).map(([sizeKey, totalPcs]) => {
                          const looseCount = loose[sizeKey] || 0;
                          const fromSets = Math.max(0, totalPcs - looseCount);

                          return (
                            <div
                              key={sizeKey}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium flex items-center gap-2 ${
                                totalPcs > 0
                                  ? "bg-slate-50 border-slate-300 text-slate-800"
                                  : "bg-gray-50 border-gray-200 text-gray-400 opacity-50"
                              }`}
                            >
                              <span className="font-bold">Size {sizeKey}:</span>
                              <span className="font-bold text-zinc-900">{totalPcs} pcs</span>
                              {looseCount > 0 && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                                  {looseCount} loose
                                </span>
                              )}
                              {fromSets > 0 && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">
                                  {fromSets} in sets
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* All Colors Inventory Summary Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  All Colors Inventory Summary
                </h3>
                <span className="text-xs text-gray-500">
                  {selectedColors.length} colors active
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Color</th>
                      <th className="py-2.5 px-3">Wholesale Sets</th>
                      <th className="py-2.5 px-3">Loose Pieces</th>
                      <th className="py-2.5 px-3 text-center">Total Pcs</th>
                      <th className="py-2.5 px-3 text-right">Value (₹)</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedColors.map((color) => {
                      const clean = cleanColorName(color);
                      const ratios = colorRatioStockMap[clean] || {};
                      const loose = colorLooseStockMap[clean] || {};
                      const calc = calculateTotalColorPieces(ratios, loose, formData.pcsPerSet || 5);
                      const colorPreset = PRESET_COLORS.find(
                        (c) => c.name.toLowerCase() === color.toLowerCase()
                      );
                      const colorInfo = colorPreset ? { hex: colorPreset.hex, isLight: colorPreset.border || false } : getColorHex(color);
                      const hex = colorInfo.hex;
                      const isLight = colorInfo.isLight;
                      const val = calc.totalPcs * (formData.price || 0);

                      const ratiosSummary = Object.entries(ratios)
                        .filter(([_, count]) => count > 0)
                        .map(([r, count]) => `${r}: ${count} sets`)
                        .join(", ") || "0 sets";

                      const looseSummary = Object.entries(loose)
                        .filter(([_, count]) => count > 0)
                        .map(([sz, count]) => `${sz}: ${count} pcs`)
                        .join(", ") || "—";

                      return (
                        <tr key={color} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full border shrink-0"
                                style={{
                                  backgroundColor: hex,
                                  borderColor: isLight ? "#cbd5e1" : "rgba(0,0,0,0.15)",
                                }}
                              />
                              <span>{color}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-700">
                            {ratiosSummary}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-800">
                            {looseSummary}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-900">
                            {calc.totalPcs}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                            ₹{val.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveStockColor(color)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                    {(() => {
                      let grandSets = 0;
                      let grandLoose = 0;
                      let grandPcs = 0;
                      for (const c of selectedColors) {
                        const clean = cleanColorName(c);
                        const ratios = colorRatioStockMap[clean] || {};
                        const loose = colorLooseStockMap[clean] || {};
                        const calc = calculateTotalColorPieces(ratios, loose, formData.pcsPerSet || 5);
                        grandSets += calc.totalSets;
                        grandLoose += calc.loosePcs;
                        grandPcs += calc.totalPcs;
                      }
                      const grandVal = grandPcs * (formData.price || 0);

                      return (
                        <tr>
                          <td className="py-2.5 px-3">Total Inventory</td>
                          <td className="py-2.5 px-3 font-mono text-zinc-900 text-xs">
                            {grandSets} Sets
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-800 text-xs">
                            {grandLoose} Loose Pcs
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-zinc-900 text-sm">
                            {grandPcs} PCS
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-sm">
                            ₹{grandVal.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3"></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
            />
            <div>
              <span className="text-sm font-semibold text-gray-900 block">
                Active (Visible in Employee &amp; Customer Order Catalog)
              </span>
              <span className="text-xs text-gray-500">
                When enabled, employees can take orders and book sets for this garment up to available stock.
              </span>
            </div>
          </label>
        </div>
      </div>


      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </Link>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Garment...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEdit ? "Update Garment" : "Save Garment"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
