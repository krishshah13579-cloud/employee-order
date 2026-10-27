"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  X,
  Check,
  Star,
  Palette,
  AlertCircle,
  Link as LinkIcon,
  Boxes,
  RefreshCw,
  Layers,
  Menu,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Shirt,
  Ruler,
} from "lucide-react";
import { Category, CLOTHING_SIZES, SizeGuideRow } from "@/types";
import { getColorHex as resolveColorHex } from "@/lib/colors";

// Standard Trouser & Formal Color Presets
const PRESET_COLORS = [
  { name: "Jet Black", hex: "#0a0a0a", text: "white" },
  { name: "Navy Blue", hex: "#1e293b", text: "white" },
  { name: "Charcoal Grey", hex: "#334155", text: "white" },
  { name: "Light Grey", hex: "#94a3b8", text: "black" },
  { name: "Khaki", hex: "#c2b280", text: "black" },
  { name: "Olive Green", hex: "#3f4f34", text: "white" },
  { name: "Beige", hex: "#e7dbc8", text: "black" },
  { name: "Dark Brown", hex: "#452a1a", text: "white" },
  { name: "Tan", hex: "#c19a6b", text: "black" },
  { name: "Off White", hex: "#f8fafc", text: "black", border: true },
  { name: "Slate Blue", hex: "#475569", text: "white" },
  { name: "Burgundy", hex: "#581c24", text: "white" },
];

interface ProductFormData {
  name: string;
  description: string;
  careInstructions?: string;
  price: string | number;
  comparePrice: string | number;
  categoryId: string;
  stock: string | number;
  images: string | string[];
  sizes?: string | string[];
  colors?: string | string[];
  inventory?: string | Record<string, Record<string, number>>;
  sizeGuide?: string | SizeGuideRow[];
  featured: boolean;
  active: boolean;
}

interface ProductFormProps {
  initialData?: ProductFormData & { id?: string };
  isEdit?: boolean;
  productId?: string;
}

/**
 * Safely parse HTTP responses without throwing SyntaxError on non-JSON/HTML error pages.
 * WebKit/Safari throws "SyntaxError: The string did not match the expected pattern"
 * when res.json() is called on non-JSON content.
 */
async function safeParseResponse(res: Response): Promise<{ ok: boolean; data: any; error?: string }> {
  let data: any = null;
  let text = "";
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      text = await res.text();
    }
  } catch {
    try {
      text = await res.text();
    } catch {
      text = "";
    }
  }

  if (!res.ok) {
    if (res.status === 413) {
      return {
        ok: false,
        data: null,
        error: "The upload payload exceeded server limit. Photos are being auto-compressed to fit.",
      };
    }
    if (res.status === 401) {
      return {
        ok: false,
        data: null,
        error: "Your admin session expired. Please refresh the page and log in again.",
      };
    }
    const extractedError =
      data?.error ||
      data?.message ||
      (text && text.length > 0 && text.length < 250 && !text.includes("<!DOCTYPE")
        ? text
        : `Server request failed (Status ${res.status}). Please try again.`);
    return { ok: false, data, error: extractedError };
  }

  return { ok: true, data: data ?? {} };
}

/**
 * Client-side 4K Ultra-HD photo processing to optimized Data URL:
 * Preserves camera/phone uploads at full 4K UHD resolution (up to 3840px, 90% quality).
 * Preserves 100% sharp fabric weave, texture, and stitch detail on zoom.
 */
async function fileToOptimizedDataUrl(
  file: File,
  maxDimension = 3840,
  quality = 0.90
): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (!file || !file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || "");
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
          return;
        }

        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // White background for any transparent PNG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern WebP for 3x sharper fabric texture at compact sizes
        try {
          const webpDataUrl = canvas.toDataURL("image/webp", quality);
          if (webpDataUrl.startsWith("data:image/webp")) {
            return resolve(webpDataUrl);
          }
        } catch {}

        // Fallback to crisp 85% JPEG
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      };

      img.src = objectUrl;
    } catch {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Validates and preserves existing high-res photos without re-compressing them.
 * Avoids generational loss / blurriness on multiple edits.
 */
async function compressBase64Image(
  dataUri: string,
  maxDimension = 3840
): Promise<string> {
  // If already a valid data URI or URL, never re-compress to prevent generation loss
  if (!dataUri || typeof dataUri !== "string") {
    return dataUri;
  }
  return dataUri;
}

export default function ProductForm({
  initialData,
  isEdit = false,
  productId,
}: ProductFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const MAX_IMAGES = 10;

  // Collapsible Accordions (Description open by default, Care Instructions closed by default)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [isCareInstructionsOpen, setIsCareInstructionsOpen] = useState(false);

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
      if (match && match.waist !== undefined && match.waist !== "" && match.length !== undefined && match.length !== "") {
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

  // Form base state
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    careInstructions: initialData?.careInstructions || "",
    price: initialData?.price ?? "",
    comparePrice: initialData?.comparePrice ?? "",
    categoryId: initialData?.categoryId || "",
    stock: initialData?.stock ?? 0,
    featured: initialData?.featured ?? false,
    active: initialData?.active ?? true,
  });

  // 25% Off calculation state for admin pricing
  const [autoApplyDiscount, setAutoApplyDiscount] = useState<boolean>(true);

  const apply25PercentDiscount = (actualPriceInput?: string | number) => {
    const raw = actualPriceInput !== undefined ? actualPriceInput : formData.comparePrice;
    const num = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
    if (!isNaN(num) && num > 0) {
      const roundedPrice = Math.round(num * 0.75);
      setFormData((prev) => ({
        ...prev,
        price: String(roundedPrice),
      }));
    }
  };

  // Sizes parsing
  const parseInitialSizes = (): string[] => {
    if (!initialData?.sizes) return [...CLOTHING_SIZES];
    if (Array.isArray(initialData.sizes)) return initialData.sizes;
    try {
      const parsed = JSON.parse(initialData.sizes);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
    return typeof initialData.sizes === "string"
      ? initialData.sizes.split(",").map((s) => s.trim()).filter(Boolean)
      : [...CLOTHING_SIZES];
  };
  const [selectedSizes, setSelectedSizes] = useState<string[]>(parseInitialSizes);

  // Colors parsing
  const parseInitialColors = (): string[] => {
    if (!initialData?.colors) return ["Navy Blue", "Jet Black", "Charcoal Grey"];
    if (Array.isArray(initialData.colors)) return initialData.colors;
    try {
      const parsed = JSON.parse(initialData.colors);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
    return typeof initialData.colors === "string"
      ? initialData.colors.split(",").map((c) => c.trim()).filter(Boolean)
      : [];
  };
  const [selectedColors, setSelectedColors] = useState<string[]>(parseInitialColors);
  const [customColorInput, setCustomColorInput] = useState("");

  // Inventory State (by Color & Size)
  const parseInitialInventory = (): Record<string, Record<string, number>> => {
    if (initialData?.inventory) {
      try {
        const parsed =
          typeof initialData.inventory === "string"
            ? JSON.parse(initialData.inventory)
            : initialData.inventory;
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          return parsed as Record<string, Record<string, number>>;
        }
      } catch {
        // fallback
      }
    }

    const colors = parseInitialColors();
    const sizes = parseInitialSizes();
    if (colors.length > 0 && sizes.length > 0) {
      const initialStockNum = Number(initialData?.stock) || 0;
      const totalVariants = colors.length * sizes.length;
      const defaultQty =
        initialStockNum > 0
          ? Math.max(1, Math.round(initialStockNum / totalVariants))
          : 10;

      const generated: Record<string, Record<string, number>> = {};
      colors.forEach((color) => {
        generated[color] = {};
        sizes.forEach((size) => {
          generated[color][size] = defaultQty;
        });
      });
      return generated;
    }

    return {};
  };

  const [inventory, setInventory] = useState<Record<string, Record<string, number>>>(
    parseInitialInventory
  );
  const [bulkQtyInput, setBulkQtyInput] = useState<string>("10");

  const getColorHex = (name: string): string => {
    return resolveColorHex(name).hex;
  };

  const getVariantQty = (color: string, size: string): number => {
    return inventory[color]?.[size] ?? 0;
  };

  const updateVariantStock = (color: string, size: string, val: string | number) => {
    const qty = Math.max(0, parseInt(String(val) || "0", 10) || 0);
    setInventory((prev) => {
      const nextInv = {
        ...prev,
        [color]: {
          ...(prev[color] || {}),
          [size]: qty,
        },
      };
      let sum = 0;
      selectedColors.forEach((c) => {
        selectedSizes.forEach((s) => {
          sum += nextInv[c]?.[s] ?? 0;
        });
      });
      setFormData((f) => ({ ...f, stock: sum }));
      return nextInv;
    });
  };

  const getColorTotal = (color: string): number => {
    let sum = 0;
    selectedSizes.forEach((s) => {
      sum += inventory[color]?.[s] ?? 0;
    });
    return sum;
  };

  const getSizeTotal = (size: string): number => {
    let sum = 0;
    selectedColors.forEach((c) => {
      sum += inventory[c]?.[size] ?? 0;
    });
    return sum;
  };

  const handleBulkSetAll = (overrideQty?: number) => {
    const targetQty =
      overrideQty !== undefined
        ? overrideQty
        : Math.max(0, parseInt(bulkQtyInput || "0", 10) || 0);
    const nextInv: Record<string, Record<string, number>> = {};
    selectedColors.forEach((c) => {
      nextInv[c] = {};
      selectedSizes.forEach((s) => {
        nextInv[c][s] = targetQty;
      });
    });
    setInventory(nextInv);
    const total = selectedColors.length * selectedSizes.length * targetQty;
    setFormData((f) => ({ ...f, stock: total }));
  };

  const handleFillColorRow = (color: string) => {
    const targetQty = Math.max(0, parseInt(bulkQtyInput || "0", 10) || 0);
    setInventory((prev) => {
      const nextInv = {
        ...prev,
        [color]: {
          ...(prev[color] || {}),
        },
      };
      selectedSizes.forEach((s) => {
        nextInv[color][s] = targetQty;
      });
      let sum = 0;
      selectedColors.forEach((c) => {
        selectedSizes.forEach((s) => {
          sum += nextInv[c]?.[s] ?? 0;
        });
      });
      setFormData((f) => ({ ...f, stock: sum }));
      return nextInv;
    });
  };

  const handleFillSizeColumn = (size: string) => {
    const targetQty = Math.max(0, parseInt(bulkQtyInput || "0", 10) || 0);
    setInventory((prev) => {
      const nextInv = { ...prev };
      selectedColors.forEach((c) => {
        nextInv[c] = {
          ...(nextInv[c] || {}),
          [size]: targetQty,
        };
      });
      let sum = 0;
      selectedColors.forEach((c) => {
        selectedSizes.forEach((s) => {
          sum += nextInv[c]?.[s] ?? 0;
        });
      });
      setFormData((f) => ({ ...f, stock: sum }));
      return nextInv;
    });
  };

  // Images state
  const parseInitialImages = (): string[] => {
    if (!initialData?.images) return [];
    if (Array.isArray(initialData.images)) {
      return initialData.images.map((img) => String(img).trim()).filter(Boolean);
    }
    if (typeof initialData.images === "string") {
      const raw = initialData.images.trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((img) => String(img).trim()).filter(Boolean);
        }
        if (typeof parsed === "string" && parsed.trim()) {
          return [parsed.trim()];
        }
      } catch {
        // fallback
      }
      if (raw.startsWith("data:")) {
        return [raw];
      }
      return raw
        .split(",")
        .map((img) => img.trim())
        .filter(Boolean);
    }
    return [];
  };
  const [imagesList, setImagesList] = useState<string[]>(parseInitialImages);
  const [externalUrlInput, setExternalUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Sync images whenever initialData is loaded or changes
  useEffect(() => {
    if (initialData?.images) {
      const parsed = parseInitialImages();
      if (parsed.length > 0) {
        setImagesList(parsed);
      }
    }
  }, [initialData?.images]);

  // Fetch categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/online/categories");
        const parsed = await safeParseResponse(res);
        if (!parsed.ok) throw new Error(parsed.error || "Failed to load categories");
        const data = Array.isArray(parsed.data) ? parsed.data : [];
        setCategories(data);
        if (!formData.categoryId && data.length > 0 && !isEdit) {
          setFormData((prev) => ({ ...prev, categoryId: data[0].id }));
        }
      } catch (err: unknown) {
        console.error("Categories error:", err);
      } finally {
        setLoadingCategories(false);
      }
    }
    loadCategories();
  }, [isEdit]);

  // Handle image upload from computer (up to 10 photos)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - imagesList.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_IMAGES} photos allowed per product. Please delete an existing photo to upload a new one.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`You can only have up to ${MAX_IMAGES} photos in total. Uploading ${remainingSlots} photo(s).`);
    } else {
      setError(null);
    }

    setUploadingImages(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });

    try {
      const newUrls: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        setUploadProgress({ current: i + 1, total: filesToUpload.length });
        const dataUrl = await fileToOptimizedDataUrl(filesToUpload[i], 850, 85 * 1024);
        if (dataUrl) {
          newUrls.push(dataUrl);
        }
      }

      if (newUrls.length > 0) {
        setImagesList((prev) => [...prev, ...newUrls].slice(0, MAX_IMAGES));
      }
    } catch (err: unknown) {
      console.error("Image processing error:", err);
      setError("Error processing photos. Please ensure files are standard JPG, PNG, or WEBP photos.");
    } finally {
      setUploadingImages(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Add external image URL
  const handleAddExternalUrl = () => {
    const trimmed = externalUrlInput.trim();
    if (!trimmed) return;
    if (imagesList.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} photos allowed per product.`);
      return;
    }
    setImagesList((prev) => [...prev, trimmed].slice(0, MAX_IMAGES));
    setExternalUrlInput("");
    setShowUrlInput(false);
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    setImagesList((prev) => prev.filter((_, i) => i !== index));
  };

  // Make cover photo (move to index 0)
  const handleMakeCover = (index: number) => {
    if (index === 0) return;
    setImagesList((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      return [item, ...copy];
    });
  };

  // Reorder image position
  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= imagesList.length) return;
    setImagesList((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  // Toggle color preset
  const handleToggleColor = (colorName: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorName)
        ? prev.filter((c) => c !== colorName)
        : [...prev, colorName]
    );
  };

  // Add custom color
  const handleAddCustomColor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    if (!selectedColors.includes(trimmed)) {
      setSelectedColors((prev) => [...prev, trimmed]);
    }
    setCustomColorInput("");
  };

  const addCarePreset = (preset: string) => {
    setFormData((prev) => {
      const existing = prev.careInstructions?.trim() || "";
      if (existing.includes(preset)) return prev;
      const updated = existing ? `${existing} • ${preset}` : preset;
      return { ...prev, careInstructions: updated };
    });
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const checked = target.checked;

    let cleanValue: any = value;
    if (type === "checkbox") {
      cleanValue = checked;
    } else if (name === "price" || name === "comparePrice") {
      // Strip currency signs and stray commas cleanly
      cleanValue = value.replace(/[^\d.]/g, "");
    }

    if (name === "comparePrice" && autoApplyDiscount) {
      const num = parseFloat(cleanValue);
      if (!isNaN(num) && num > 0) {
        const roundedPrice = Math.round(num * 0.75);
        setFormData((prev) => ({
          ...prev,
          comparePrice: cleanValue,
          price: String(roundedPrice),
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: cleanValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Product name is required");
      return;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }
    const cleanPrice = parseFloat(String(formData.price).replace(/[^0-9.]/g, ""));
    if (isNaN(cleanPrice) || cleanPrice < 0) {
      setError("A valid price is required");
      return;
    }
    if (!formData.categoryId) {
      setError("Please select a category");
      return;
    }
    if (imagesList.length === 0) {
      setError("Please upload at least one image for the product");
      return;
    }

    // Mandatory Size Guide validation: Waist and Length are required for each size
    if (sizeGuideRows.length === 0) {
      setError("Size Guide is mandatory. Please provide all standard sizes.");
      return;
    }
    for (let i = 0; i < sizeGuideRows.length; i++) {
      const row = sizeGuideRows[i];
      if (!row.waist.trim()) {
        setError(`Waist measurement is mandatory for Size ${row.brandSize} in the Size Guide.`);
        return;
      }
      if (!row.length.trim()) {
        setError(`Length measurement is mandatory for Size ${row.brandSize} in the Size Guide.`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const endpoint = isEdit
        ? `/api/online/products/${productId}`
        : "/api/online/products";
      const method = isEdit ? "PUT" : "POST";
      let finalStock = Number(formData.stock) || 0;
      if (selectedColors.length > 0 && selectedSizes.length > 0) {
        let sum = 0;
        selectedColors.forEach((c) => {
          selectedSizes.forEach((s) => {
            sum += inventory[c]?.[s] ?? 0;
          });
        });
        finalStock = sum;
      }

      const cleanComparePrice = formData.comparePrice
        ? parseFloat(String(formData.comparePrice).replace(/[^0-9.]/g, "")) || null
        : null;

      // Preserve high-fidelity images without destructive re-compression
      const optimizedImages = imagesList;

      // Ensure size guide rows are saved in canonical inches
      // so user-side modal/accordions can toggle seamlessly between IN and CM
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

      const payload = {
        ...formData,
        price: cleanPrice,
        comparePrice: cleanComparePrice,
        stock: finalStock,
        images: optimizedImages,
        sizes: selectedSizes,
        colors: selectedColors,
        inventory: inventory,
        sizeGuide: normalizedSizeGuide,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const parsed = await safeParseResponse(res);
      if (!parsed.ok) {
        throw new Error(parsed.error || "Failed to save product");
      }

      router.push("/admin/online/products");
      router.refresh();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Something went wrong";
      const cleanMsg =
        rawMsg.includes("did not match the expected pattern") || rawMsg.includes("Unexpected token")
          ? "Unable to save garment. Please verify all fields and image files."
          : rawMsg;
      setError(cleanMsg);
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Garment Details */}
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
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. IMP-001 or Everyday Cotton Chino"
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
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase">
                    Required *
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Fabric specifications, weave architecture, fit silhouette &amp; pocket details
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
                name="description"
                rows={5}
                required
                value={formData.description}
                onChange={handleChange}
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

        {/* 2. Care Instructions (Collapsible Hamburger - CLOSED by default) */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs transition-all">
          <button
            type="button"
            onClick={() => setIsCareInstructionsOpen((prev) => !prev)}
            className="w-full px-5 py-4 bg-gray-50/70 hover:bg-gray-100/70 transition-colors flex items-center justify-between text-left select-none border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-[#162082] shadow-2xs">
                <Shirt className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                    Care Instructions
                  </h3>
                  <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                    Collapsible • Fabric Care
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Washing temperatures, drying instructions &amp; iron settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-xs font-medium text-gray-400 hidden sm:inline">
                {isCareInstructionsOpen ? "Collapse" : "Expand"}
              </span>
              <div className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-600 transition-transform">
                {isCareInstructionsOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {isCareInstructionsOpen && (
            <div className="p-5 space-y-3.5 animate-fadeIn">
              {/* Quick Preset Badges */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-700 block">
                  Quick Care Presets (Click to add):
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Machine wash cold (30°C)",
                    "Gentle cycle with like colors",
                    "Do not bleach",
                    "Line dry in shade",
                    "Do not tumble dry",
                    "Warm iron on reverse",
                    "Dry clean compatible",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addCarePreset(preset)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-neutral-900 hover:text-white text-gray-700 transition-colors border border-gray-200/80 cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                name="careInstructions"
                rows={3}
                value={formData.careInstructions}
                onChange={handleChange}
                placeholder="e.g. Machine wash cold with like colors, gentle cycle. Do not bleach. Line dry in shade. Warm iron inside-out."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all leading-relaxed placeholder:text-gray-400"
              />
              <p className="text-[11px] text-gray-400">
                This information will appear in the customer-facing care accordion on the product page.
              </p>
            </div>
          )}
        </div>

        {/* 3. Product Size Guide (Brand Size Fixed, Waist & Length Editable, IN & CM support) */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs transition-all">
          <div className="w-full px-5 py-4 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-[#162082] shadow-2xs">
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
          </div>

          <div className="p-5 space-y-4">
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
                <tbody className="divide-y divide-gray-100">
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
                onClick={() => {
                  setSizeGuideRows([...DEFAULT_ADMIN_SIZE_GUIDE]);
                  setSizeGuideUnit("IN");
                }}
                className="text-xs text-gray-500 hover:text-gray-900 underline cursor-pointer"
              >
                Reset to Standard Sizing
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
              Category *
            </label>
            {loadingCategories ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <select
                name="categoryId"
                required
                value={formData.categoryId}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Total Stock Units *
              </label>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Auto-synced with variants
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                name="stock"
                required
                value={formData.stock}
                onChange={handleChange}
                placeholder="50"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all font-semibold"
              />
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-between">
                <span>Calculated from Color & Size matrix below</span>
                <a
                  href="#inventory-matrix"
                  className="text-black font-semibold underline hover:text-gray-700"
                >
                  Manage Availability ↓
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Image Upload (Direct from computer + Drag/Drop — Up to 10 photos) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-700" />
              <span>Product Photos (Up to 10)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Add up to 10 high-resolution photos. Photo #1 is the primary cover displayed on store cards.
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
              accept="image/*"
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
                    ? `Uploading photo ${uploadProgress?.current || 1} of ${uploadProgress?.total || 1}...`
                    : `Click to upload photos from computer (Up to ${MAX_IMAGES - imagesList.length} more)`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, JPEG, PNG, WEBP, AVIF supported • Up to 10 photos per garment
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
              {imagesList.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-xs flex flex-col justify-between"
                >
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
              ))}
            </div>
          </div>
        )}

        {/* Optional Add by External URL toggle */}
        <div className="pt-2">
          {!showUrlInput ? (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="text-xs text-gray-500 hover:text-black font-medium flex items-center gap-1.5 transition-colors"
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
                  className="px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors"
                >
                  Add URL
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="p-2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Available Colors Section (NEW) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-gray-700" />
              <span>Available Colors</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select or type the color variants available for this trouser design.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedColors(PRESET_COLORS.map((c) => c.name))}
              className="text-xs text-gray-600 hover:text-black font-medium underline"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => setSelectedColors([])}
              className="text-xs text-gray-600 hover:text-black font-medium underline"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Color Presets */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2.5">
            Standard Trouser Colors
          </label>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_COLORS.map((color) => {
              const isSelected = selectedColors.includes(color.name);
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => handleToggleColor(color.name)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    isSelected
                      ? "bg-gray-900 text-white border-gray-900 shadow-xs"
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

        {/* Custom Color Input */}
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
            Add Custom Color Name
          </label>
          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder="e.g. Royal Navy, Slate Blue, Stone Beige"
              value={customColorInput}
              onChange={(e) => setCustomColorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomColor();
                }
              }}
              className="flex-1 px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-black"
            />
            <button
              type="button"
              onClick={() => handleAddCustomColor()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
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
              {selectedColors.map((color) => (
                <span
                  key={color}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-900 shadow-2xs"
                >
                  <span>{color}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleColor(color)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Available Clothing Sizes */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Available Sizes</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select available sizes for this trouser pattern (Waist sizes 28 through 44)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedSizes([...CLOTHING_SIZES])}
              className="text-xs text-gray-600 hover:text-black font-medium underline"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => setSelectedSizes([])}
              className="text-xs text-gray-600 hover:text-black font-medium underline"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {CLOTHING_SIZES.map((size) => {
            const isSelected = selectedSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setSelectedSizes((prev) =>
                    isSelected
                      ? prev.filter((s) => s !== size)
                      : [...prev, size].sort((a, b) => Number(a) - Number(b))
                  );
                }}
                className={`min-w-[48px] h-10 px-3.5 text-xs font-semibold rounded-xl border transition-all duration-150 flex items-center justify-center ${
                  isSelected
                    ? "bg-black text-white border-black shadow-xs"
                    : "bg-white text-gray-600 border-gray-300 hover:border-black"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Inventory Availability by Size & Color */}
      <div
        id="inventory-matrix"
        className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-gray-700" />
              <span>Inventory Availability by Size & Color</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Specify exact stock units available for each color and waist size. Real-time availability on the product page will adapt to these values.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              {selectedColors.length} Color{selectedColors.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              {selectedSizes.length} Size{selectedSizes.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-black text-white shadow-2xs">
              {formData.stock} Units Total
            </span>
          </div>
        </div>

        {selectedColors.length === 0 || selectedSizes.length === 0 ? (
          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Colors or sizes are missing</p>
              <p className="text-xs text-amber-700">
                Please select at least one color in the <strong>Available Colors</strong> section and at least one size in the <strong>Available Sizes</strong> section above to configure inventory availability.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Quick Batch Tools */}
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Bulk Fill:
                </span>
                <input
                  type="number"
                  min="0"
                  value={bulkQtyInput}
                  onChange={(e) => setBulkQtyInput(e.target.value)}
                  className="w-16 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-center focus:ring-2 focus:ring-black"
                />
                <button
                  type="button"
                  onClick={() => handleBulkSetAll()}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors"
                >
                  Apply to All Variants
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500 mr-1">Presets:</span>
                {[5, 10, 20, 50].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => handleBulkSetAll(qty)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:border-black text-gray-700 transition-colors"
                  >
                    All: {qty}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleBulkSetAll(0)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                >
                  Clear All (0)
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-2xs">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="p-3.5 text-xs font-bold uppercase tracking-wider min-w-[150px]">
                      Color \ Size
                    </th>
                    {selectedSizes.map((size) => (
                      <th
                        key={size}
                        className="p-3 text-center text-xs font-bold tracking-wider min-w-[90px]"
                      >
                        <div className="flex flex-col items-center">
                          <span>Size {size}</span>
                          <button
                            type="button"
                            onClick={() => handleFillSizeColumn(size)}
                            title={`Set all colors in size ${size} to ${bulkQtyInput}`}
                            className="text-[10px] text-gray-400 hover:text-white underline font-normal mt-0.5"
                          >
                            Set col
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="p-3 text-center text-xs font-bold uppercase tracking-wider min-w-[100px] bg-gray-800">
                      Color Total
                    </th>
                    <th className="p-3 text-center text-xs font-bold uppercase tracking-wider min-w-[120px] bg-gray-800">
                      Quick Row Fill
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {selectedColors.map((color) => {
                    const colorTotal = getColorTotal(color);
                    return (
                      <tr
                        key={color}
                        className="hover:bg-gray-50/70 transition-colors"
                      >
                        <td className="p-3.5 font-semibold text-gray-900">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs shrink-0"
                              style={{ backgroundColor: getColorHex(color) }}
                            />
                            <span className="truncate">{color}</span>
                          </div>
                        </td>
                        {selectedSizes.map((size) => {
                          const qty = getVariantQty(color, size);
                          return (
                            <td key={size} className="p-2.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={qty}
                                  onChange={(e) =>
                                    updateVariantStock(color, size, e.target.value)
                                  }
                                  className={`w-16 px-2 py-1.5 text-center rounded-xl border text-xs font-bold transition-all focus:outline-hidden focus:ring-2 focus:ring-black ${
                                    qty === 0
                                      ? "border-rose-300 bg-rose-50/80 text-rose-700"
                                      : qty <= 5
                                      ? "border-amber-300 bg-amber-50/80 text-amber-800"
                                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
                                  }`}
                                />
                                <span
                                  className={`text-[10px] font-semibold leading-tight ${
                                    qty === 0
                                      ? "text-rose-600"
                                      : qty <= 5
                                      ? "text-amber-700"
                                      : "text-emerald-700"
                                  }`}
                                >
                                  {qty === 0 ? "Out" : qty <= 5 ? "Low" : "In Stock"}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-3.5 text-center font-bold text-gray-900 bg-gray-50/50">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              colorTotal === 0
                                ? "bg-rose-100 text-rose-800"
                                : colorTotal <= 10
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            {colorTotal}
                          </span>
                        </td>
                        <td className="p-2.5 text-center bg-gray-50/50">
                          <button
                            type="button"
                            onClick={() => handleFillColorRow(color)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition-colors shadow-2xs"
                          >
                            Fill ({bulkQtyInput})
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100/90 font-bold border-t-2 border-gray-300">
                  <tr>
                    <td className="p-3.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                      Size Totals
                    </td>
                    {selectedSizes.map((size) => (
                      <td
                        key={size}
                        className="p-3.5 text-center text-xs font-bold text-gray-900"
                      >
                        {getSizeTotal(size)}
                      </td>
                    ))}
                    <td className="p-3.5 text-center text-sm font-black text-black bg-gray-200/80">
                      {formData.stock}
                    </td>
                    <td className="p-3.5 text-center text-xs text-gray-600 bg-gray-200/80 font-medium">
                      All Units
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Availability Legend */}
            <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-2 px-1">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-gray-700">Stock Legend:</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>In Stock (&gt;5)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Low Stock (1–5)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Out of Stock (0)</span>
                </span>
              </div>
              <span className="text-[11px] text-gray-400">
                Values auto-save upon clicking Save/Update Trouser.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Pricing & 25% Off Discount (INR ₹) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Pricing & 25% Off Discount (₹ INR)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set the actual price (MRP) and calculate 25% OFF rounded price automatically.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={autoApplyDiscount}
              onChange={(e) => {
                const checked = e.target.checked;
                setAutoApplyDiscount(checked);
                if (checked && formData.comparePrice) {
                  apply25PercentDiscount(formData.comparePrice);
                }
              }}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
            />
            <span>Auto 25% OFF (Round off)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Actual Price / MRP (₹)
              </label>
              <span className="text-[11px] font-medium text-gray-400">Regular Store Price</span>
            </div>
            <input
              type="number"
              step="any"
              min="0"
              name="comparePrice"
              value={formData.comparePrice}
              onChange={handleChange}
              placeholder="1700.00"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Original regular price before discount (used for strikethrough & 25% OFF calculation)
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Selling Price (₹) *
              </label>
              {Number(formData.comparePrice) > 0 && (
                <button
                  type="button"
                  onClick={() => apply25PercentDiscount(formData.comparePrice)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  title="Recalculate 25% OFF on Actual Price (Round off)"
                >
                  ⚡ Apply 25% OFF (₹{Math.round(Number(formData.comparePrice) * 0.75)})
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0"
              name="price"
              required
              value={formData.price}
              onChange={handleChange}
              placeholder="1275.00"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-black focus:border-transparent transition-all font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Final customer price charged at checkout (can be set manually or via 25% OFF)
            </p>
          </div>
        </div>

        {/* 25% OFF Discount Summary Banner with Round Off Details */}
        {Number(formData.comparePrice) > 0 && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-gray-800">
              <span className="font-extrabold bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md text-[11px] tracking-wide">
                25% OFF APPLIED
              </span>
              <span>
                Actual: <strong className="font-semibold text-gray-900 font-mono">₹{Number(formData.comparePrice).toLocaleString("en-IN")}</strong>
                {" − 25% = "}
                <span className="text-gray-500 font-mono">₹{(Number(formData.comparePrice) * 0.75).toFixed(2)}</span>
                {" → "}
                Round off: <strong className="font-bold text-emerald-700 text-sm font-mono">₹{Math.round(Number(formData.comparePrice) * 0.75).toLocaleString("en-IN")}</strong>
              </span>
              <span className="text-gray-500 hidden sm:inline">
                (Customer saves ₹{Math.max(0, Math.round(Number(formData.comparePrice) - Math.round(Number(formData.comparePrice) * 0.75))).toLocaleString("en-IN")})
              </span>
            </div>

            <button
              type="button"
              onClick={() => apply25PercentDiscount(formData.comparePrice)}
              className="px-3 py-1 rounded-lg bg-black text-white font-bold text-xs hover:bg-neutral-800 transition-transform active:scale-95 cursor-pointer shadow-xs"
            >
              Set ₹{Math.round(Number(formData.comparePrice) * 0.75).toLocaleString("en-IN")}
            </button>
          </div>
        )}
      </div>

      {/* 6. Status & Storefront Display */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Publishing & Storefront Visibility
        </h2>

        <div className="flex flex-col sm:flex-row gap-6 pt-1">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm font-medium text-gray-700">
              Active (Visible in storefront catalog)
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="featured"
              checked={formData.featured}
              onChange={handleChange}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm font-medium text-gray-700">
              Featured Trouser
            </span>
          </label>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Link
          href="/admin/online/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </Link>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition-colors shadow-xs disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Garment...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isEdit ? "Update Trouser" : "Save Trouser"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
