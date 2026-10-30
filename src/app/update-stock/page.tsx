"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Search,
  Package,
  Layers,
  Edit,
  Save,
  X,
  Check,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  Scissors,
  DollarSign,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Camera,
  Image as ImageIcon,
  Tag,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, getProductCoverImage, sortProductsByImpSequence } from "@/lib/utils";
import { getColorHex, getColorHexCode } from "@/lib/colors";
import {
  cleanColorName,
  getPcsFromRatio,
  getSizesFromRatio,
  sortSizeRatioKeys,
} from "@/lib/stock";
import { STANDARD_SIZE_RATIOS } from "@/lib/types";

interface StockProduct {
  id: number;
  name: string;
  category: string;
  imageUrl: string;
  colorsAvailable: string;
  colorMapping?: string | null;
  colors: string[];
  sizesRatio: string;
  pcsPerSet: number;
  mrp?: number | null;
  retailerPrice?: number | null;
  wholesalerPrice?: number | null;
  price: number;
  costPrice?: number | null;
  mixPcs: number;
  totalSets: number;
  totalSetPcs: number;
  totalPcs: number;
  setsColorwise?: string | null;
  detailedRatioSets?: Record<string, Record<string, number>>;
  isActive: boolean;
}

interface AccessoryItemData {
  id: number;
  name: string;
  category: string;
  imageUrl?: string | null;
  quantity: number;
  unit: string;
  minAlertQty: number;
  costPerUnit: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const ACCESSORY_TARGET_CATEGORIES = [
  "All Trims",
  "Buttons",
  "Tags",
  "Size Label",
  "Flag Label",
  "Zippers",
  "Pocketing",
  "Care Label",
  "Others",
];

export default function UpdateStockPage() {
  const router = useRouter();
  const { employee, loading: sessionLoading, refreshSession } = useEmployee();
  const { toast } = useToast();

  // Top Section Mode: "GARMENTS" or "ACCESSORIES"
  const [stockSection, setStockSection] = useState<"GARMENTS" | "ACCESSORIES">("GARMENTS");

  // Garment Products state
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Accessories state (Buttons, Tags, Size & Flag Labels)
  const [accessories, setAccessories] = useState<AccessoryItemData[]>([]);
  const [accessoriesLoading, setAccessoriesLoading] = useState<boolean>(false);
  const [selectedAccessoryCategory, setSelectedAccessoryCategory] = useState<string>("All Trims");
  const [accessorySearch, setAccessorySearch] = useState<string>("");
  const [editingAccessory, setEditingAccessory] = useState<AccessoryItemData | null>(null);
  const [isAddAccessoryOpen, setIsAddAccessoryOpen] = useState<boolean>(false);
  const [savingAccessory, setSavingAccessory] = useState<boolean>(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

  const [accessoryForm, setAccessoryForm] = useState({
    name: "",
    category: "Buttons",
    imageUrl: "",
    quantity: "1000",
    unit: "Pcs",
    minAlertQty: "200",
    costPerUnit: "1.00",
    notes: "",
  });

  // Edit Stock Modal State (Garments)
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [modalRatio, setModalRatio] = useState<string>("30 to 38");
  const [modalColorSets, setModalColorSets] = useState<Record<string, number>>({});
  const [modalCostPrice, setModalCostPrice] = useState<string>("");
  const [modalImageUrl, setModalImageUrl] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Strict authorization check: Only allowed if explicitly granted or super admin
  const isAuthorized = Boolean(
    employee?.canUpdateStock === true ||
    (employee?.id === 0 && (employee?.designation === "Administrator" || employee?.designation?.includes("Admin")))
  );

  const fetchStockProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stock", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        toast("Access Revoked: You do not have permission to update stock.", "error");
        router.replace("/");
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load stock data (${res.status})`);
      }
      const data = await res.json();
      setProducts(data.stockItems || []);
    } catch (err: any) {
      toast("Error loading stock: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  const fetchAccessories = useCallback(async () => {
    try {
      setAccessoriesLoading(true);
      const res = await fetch("/api/admin/stock/accessories", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load accessories");
      const data = await res.json();
      setAccessories(data.items || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAccessoriesLoading(false);
    }
  }, []);

  // Periodic real-time check against DB: Revoke right away if admin removed access
  useEffect(() => {
    let active = true;

    const verifyFreshAccess = async () => {
      try {
        const res = await fetch("/api/employee/auth/check", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const hasAccess = Boolean(
            data.authenticated &&
            (data.isAdmin || data.employee?.canUpdateStock === true)
          );
          if (!hasAccess && active) {
            toast("Access Revoked: Stock update permission removed by administrator.", "error");
            router.replace("/");
            return false;
          }
        }
      } catch {}
      return true;
    };

    if (!sessionLoading) {
      if (!isAuthorized) {
        toast("Access Denied: You do not have permission to update stock.", "error");
        router.replace("/");
        return;
      }
      fetchStockProducts();
      fetchAccessories();
    }

    // Verify continuously every 10 seconds to revoke right away
    const interval = setInterval(verifyFreshAccess, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionLoading, isAuthorized, fetchStockProducts, fetchAccessories, router, toast]);

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim().toUpperCase());
      }
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const matchCat =
        selectedCategory === "All" ||
        p.category.toUpperCase() === selectedCategory.toUpperCase();
      const term = search.toLowerCase().trim();
      const matchSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.colorsAvailable && p.colorsAvailable.toLowerCase().includes(term)) ||
        (p.sizesRatio && p.sizesRatio.toLowerCase().includes(term));
      return matchCat && matchSearch;
    });
    return sortProductsByImpSequence(list);
  }, [products, selectedCategory, search]);

  // Filtered accessories: Buttons, Tags, Size Label, Flag Label, etc.
  const filteredAccessories = useMemo(() => {
    return accessories.filter((item) => {
      const matchCat =
        selectedAccessoryCategory === "All Trims" ||
        item.category.toLowerCase() === selectedAccessoryCategory.toLowerCase();
      const term = accessorySearch.toLowerCase().trim();
      const matchSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        (item.notes && item.notes.toLowerCase().includes(term));
      return matchCat && matchSearch;
    });
  }, [accessories, selectedAccessoryCategory, accessorySearch]);

  const handleOpenEdit = (p: StockProduct) => {
    setEditingProduct(p);
    setModalRatio(p.sizesRatio || "30 to 38");
    setModalCostPrice(p.costPrice !== null && p.costPrice !== undefined ? String(p.costPrice) : "");
    setModalImageUrl(p.imageUrl || "");

    // Pre-populate color sets from detailedRatioSets or setsColorwise
    const colorCounts: Record<string, number> = {};
    const primaryRatio = p.sizesRatio || "30 to 38";

    if (p.detailedRatioSets) {
      for (const [col, rMap] of Object.entries(p.detailedRatioSets)) {
        const clean = cleanColorName(col);
        const count = rMap[primaryRatio] !== undefined ? rMap[primaryRatio] : Object.values(rMap).reduce((a, b) => a + b, 0);
        colorCounts[clean] = count || 0;
      }
    }

    // Ensure all product colors have an entry
    p.colors.forEach((col) => {
      const clean = cleanColorName(col);
      if (colorCounts[clean] === undefined) {
        colorCounts[clean] = 0;
      }
    });

    setModalColorSets(colorCounts);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload photo");
      }

      const data = await res.json();
      setModalImageUrl(data.url);
      toast("Product photo uploaded! Click Save Stock Changes to apply.", "success");
    } catch (err: any) {
      toast("Photo upload failed: " + err.message, "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleColorCountChange = (color: string, val: number) => {
    setModalColorSets((prev) => ({
      ...prev,
      [color]: Math.max(0, val),
    }));
  };

  const handleQuickAddAll = (delta: number) => {
    setModalColorSets((prev) => {
      const next: Record<string, number> = {};
      for (const [col, count] of Object.entries(prev)) {
        next[col] = Math.max(0, count + delta);
      }
      return next;
    });
  };

  const handleResetAll = () => {
    setModalColorSets((prev) => {
      const next: Record<string, number> = {};
      for (const col of Object.keys(prev)) {
        next[col] = 0;
      }
      return next;
    });
  };

  const modalPcsPerSet = useMemo(() => {
    const rSizes = getSizesFromRatio(modalRatio);
    return rSizes.length > 0 && rSizes[0] !== modalRatio ? rSizes.length : 5;
  }, [modalRatio]);

  const modalTotalSets = useMemo(() => {
    return Object.values(modalColorSets).reduce((a, b) => a + (Number(b) || 0), 0);
  }, [modalColorSets]);

  const modalTotalPcs = useMemo(() => {
    return modalTotalSets * modalPcsPerSet;
  }, [modalTotalSets, modalPcsPerSet]);

  const handleSaveStock = async () => {
    if (!editingProduct) return;
    try {
      setSaving(true);

      // Structure setsColorwise JSON mapping
      const nextStockMap: Record<string, { ratios: Record<string, number>; loosePcs: Record<string, number> }> = {};
      for (const [col, count] of Object.entries(modalColorSets)) {
        const clean = cleanColorName(col);
        nextStockMap[clean] = {
          ratios: {
            [modalRatio]: count,
          },
          loosePcs: {},
        };
      }

      const res = await fetch("/api/admin/stock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          sizesRatio: modalRatio,
          costPrice: modalCostPrice ? parseFloat(modalCostPrice) || null : null,
          setsColorwise: JSON.stringify(nextStockMap),
          imageUrl: modalImageUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stock");
      }

      toast(`✅ Successfully updated stock & photo for ${editingProduct.name} (${modalTotalSets} Sets · ${modalTotalPcs} Pcs)!`, "success");
      setEditingProduct(null);
      fetchStockProducts();
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Quick adjust accessory quantity (+100, -100, +500)
  const handleAdjustAccessoryQty = async (id: number, delta: number) => {
    try {
      const it = accessories.find((a) => a.id === id);
      if (!it) return;
      const newQty = Math.max(0, it.quantity + delta);

      const res = await fetch("/api/admin/stock/accessories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quantity: newQty }),
      });

      if (!res.ok) throw new Error("Failed to adjust quantity");
      setAccessories((prev) =>
        prev.map((a) => (a.id === id ? { ...a, quantity: newQty } : a))
      );
      toast(`Updated stock for ${it.name} to ${newQty.toLocaleString("en-IN")} ${it.unit}`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to adjust stock", "error");
    }
  };

  const handleOpenAddAccessory = () => {
    setEditingAccessory(null);
    setAccessoryForm({
      name: "",
      category: "Buttons",
      imageUrl: "",
      quantity: "1000",
      unit: "Pcs",
      minAlertQty: "200",
      costPerUnit: "1.00",
      notes: "",
    });
    setIsAddAccessoryOpen(true);
  };

  const handleOpenEditAccessory = (item: AccessoryItemData) => {
    setEditingAccessory(item);
    setAccessoryForm({
      name: item.name,
      category: item.category,
      imageUrl: item.imageUrl || "",
      quantity: String(item.quantity),
      unit: item.unit,
      minAlertQty: String(item.minAlertQty),
      costPerUnit: String(item.costPerUnit),
      notes: item.notes || "",
    });
    setIsAddAccessoryOpen(true);
  };

  const handleSaveAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingAccessory(true);
      const isEdit = !!editingAccessory;
      const url = "/api/admin/stock/accessories";
      const method = isEdit ? "PUT" : "POST";
      const payload: any = {
        name: accessoryForm.name.trim(),
        category: accessoryForm.category.trim(),
        imageUrl: accessoryForm.imageUrl.trim() || null,
        quantity: parseInt(accessoryForm.quantity, 10) || 0,
        unit: accessoryForm.unit.trim() || "Pcs",
        minAlertQty: parseInt(accessoryForm.minAlertQty, 10) || 0,
        costPerUnit: parseFloat(accessoryForm.costPerUnit) || 0,
        notes: accessoryForm.notes.trim() || null,
      };
      if (isEdit) {
        payload.id = editingAccessory.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save trim/accessory item");
      }

      toast(`✅ ${accessoryForm.name} stock saved successfully!`, "success");
      setIsAddAccessoryOpen(false);
      setEditingAccessory(null);
      fetchAccessories();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSavingAccessory(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Verifying Stock Management Authorization...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-black text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500">
            You do not have permission to update stock. Please contact the Administrator to request stock update access.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition hover:bg-slate-800"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ═══════════════════════════════════════════
          HEADER BANNER (MATCHING STOREFRONT STYLE)
          ═══════════════════════════════════════════ */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Link href="/" className="hover:text-white transition">
                  Home
                </Link>
                <span>/</span>
                <span className="text-orange-400 font-bold">Stock Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Boxes className="text-orange-500" />
                <span>Stock Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Update live garment piece counts, size ratios, and trims/accessories (Buttons, Tags, Size &amp; Flag Labels).
              </p>
            </div>

            {/* Quick Section Switcher Pill */}
            <div className="flex items-center gap-2 p-1.5 bg-white/10 border border-white/15 rounded-2xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStockSection("GARMENTS")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  stockSection === "GARMENTS"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Package size={14} />
                <span>Garments ({products.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setStockSection("ACCESSORIES")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  stockSection === "ACCESSORIES"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Tag size={14} />
                <span>Buttons, Tags &amp; Labels ({accessories.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ═══════════════════════════════════════════
            SECTION 1: BUTTONS, TAGS, SIZE & FLAG LABELS
            ═══════════════════════════════════════════ */}
        {stockSection === "ACCESSORIES" ? (
          <div className="space-y-6">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {ACCESSORY_TARGET_CATEGORIES.map((cat) => {
                    const isSelected = selectedAccessoryCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedAccessoryCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddAccessory}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Add Trim / Accessory</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-md">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search buttons, hangtags, size & flag labels..."
                    value={accessorySearch}
                    onChange={(e) => setAccessorySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchAccessories}
                    disabled={accessoriesLoading}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition cursor-pointer"
                    title="Refresh trims"
                  >
                    <RefreshCw size={14} className={accessoriesLoading ? "animate-spin" : ""} />
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    Showing <strong className="text-slate-900 font-bold">{filteredAccessories.length}</strong> trim/label item(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Trims Grid / Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3 w-14 text-center">Photo</th>
                      <th className="py-3 px-4">Trim / Accessory Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-center">Min Alert Level</th>
                      <th className="py-3 px-4 text-center">Quick Adjust</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {accessoriesLoading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-300" />
                          <span>Loading accessories &amp; trims stock...</span>
                        </td>
                      </tr>
                    ) : filteredAccessories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <Tag size={32} className="mx-auto mb-2 text-slate-300" />
                          <span>No buttons, tags or labels found matching your filter.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredAccessories.map((item) => {
                        const isLow = item.quantity <= item.minAlertQty;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-center">
                              {item.imageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingImage({ url: item.imageUrl!, title: item.name })}
                                  className="w-10 h-10 mx-auto rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:scale-105 transition-transform cursor-pointer shadow-2xs block"
                                  title="Click to view full photo"
                                >
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <div className="w-10 h-10 mx-auto rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                                  <ImageIcon size={16} />
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 block text-xs">
                                {item.name}
                              </span>
                              {item.notes && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {item.notes}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                <Tag size={10} className="text-slate-500" />
                                <span>{item.category}</span>
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center font-mono font-black text-sm">
                              <span className={isLow ? "text-red-600" : "text-slate-900"}>
                                {item.quantity.toLocaleString("en-IN")} {item.unit}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center font-mono text-xs">
                              {isLow ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  <ShieldAlert size={11} />
                                  <span>Low &le; {item.minAlertQty}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">&ge; {item.minAlertQty} {item.unit}</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAdjustAccessoryQty(item.id, -100)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs cursor-pointer"
                                  title="Deduct 100"
                                >
                                  -100
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustAccessoryQty(item.id, 100)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-xs cursor-pointer"
                                  title="Add 100"
                                >
                                  +100
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustAccessoryQty(item.id, 500)}
                                  className="px-2 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 font-bold text-blue-700 flex items-center justify-center text-[10px] cursor-pointer"
                                  title="Add 500"
                                >
                                  +500
                                </button>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAccessory(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold transition cursor-pointer"
                                title="Edit stock or details"
                              >
                                <Edit size={12} />
                                <span>Edit</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════
              SECTION 2: GARMENT STOCK
              ═══════════════════════════════════════════ */
          <div className="space-y-6">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => {
                  const isSelected = selectedCategory.toUpperCase() === cat.toUpperCase();
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-md">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search products by style name, color, sizes..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 transition shadow-2xs"
                  />
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  Showing <strong className="text-slate-900 font-bold">{filteredProducts.length}</strong> available trouser style(s)
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                <p className="text-xs text-slate-500 font-bold">Loading inventory styles...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <Package size={22} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">No Styles Found</h3>
                <p className="text-xs text-slate-500">
                  No products matched your search or category filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredProducts.map((p) => {
                  const coverImage = getProductCoverImage(p.imageUrl);
                  const displayMrp = p.mrp || Math.round((p.retailerPrice || p.price) * 1.5);
                  const availableColors = p.colors || [];

                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col group"
                    >
                      {/* Product Image Cover */}
                      <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon size={32} />
                          </div>
                        )}

                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                          {p.category || "Trouser"}
                        </span>

                        <span className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-white/95 backdrop-blur-xs text-slate-900 text-xs font-black rounded-xl font-mono shadow-xs">
                          {p.totalSets} Sets · {p.totalPcs} Pcs
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-black text-slate-900 text-sm tracking-tight line-clamp-1">
                            {p.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {p.sizesRatio || "30 to 38"}
                            </span>
                            <span>•</span>
                            <span>{p.pcsPerSet || 5} Pcs / Set</span>
                          </div>
                        </div>

                        {/* Colors Swatches */}
                        {availableColors.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {availableColors.slice(0, 6).map((c) => {
                              const hex = getColorHexCode(c);
                              return (
                                <span
                                  key={c}
                                  title={c}
                                  className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                                  style={{ backgroundColor: hex }}
                                />
                              );
                            })}
                            {availableColors.length > 6 && (
                              <span className="text-[10px] font-bold text-slate-400 self-center">
                                +{availableColors.length - 6}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Price & Action Button */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              Rate per PC
                            </div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-bold text-slate-400 line-through font-mono">
                                ₹{displayMrp}
                              </span>
                              <span className="text-base font-black text-slate-900 font-mono">
                                ₹{p.retailerPrice || p.price}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer active:scale-95 shrink-0"
                          >
                            <Edit size={13} />
                            <span>Update Stock</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════
          MODAL: ADD / EDIT TRIM & ACCESSORY STOCK
          ═══════════════════════════════════════════ */}
      {isAddAccessoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Tag size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {editingAccessory ? "Update Trim / Accessory Stock" : "Add Trim / Accessory Item"}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Buttons, tags, size labels, flag labels inventory
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddAccessoryOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAccessory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IQ Metallic Shank Button, Pocket Flag Label..."
                  value={accessoryForm.name}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={accessoryForm.category}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Buttons">Buttons</option>
                    <option value="Tags">Tags</option>
                    <option value="Size Label">Size Label</option>
                    <option value="Flag Label">Flag Label</option>
                    <option value="Zippers">Zippers</option>
                    <option value="Pocketing">Pocketing</option>
                    <option value="Care Label">Care Label</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Stock Unit
                  </label>
                  <select
                    value={accessoryForm.unit}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Gross">Gross (144 pcs)</option>
                    <option value="Meters">Meters</option>
                    <option value="Rolls">Rolls</option>
                    <option value="Boxes">Boxes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Current Quantity in Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={accessoryForm.quantity}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Min Alert Level (Pcs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={accessoryForm.minAlertQty}
                    onChange={(e) => setAccessoryForm({ ...accessoryForm, minAlertQty: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Notes / Shade Specs (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Copper antique finish for Black & Navy trousers"
                  value={accessoryForm.notes}
                  onChange={(e) => setAccessoryForm({ ...accessoryForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddAccessoryOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccessory}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {savingAccessory ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>{editingAccessory ? "Update Stock" : "Add Trim Item"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          TRIM PHOTO VIEWER MODAL
          ═══════════════════════════════════════════ */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 animate-in fade-in duration-150 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900 truncate">
                {viewingImage.title}
              </span>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="w-full max-h-[70vh] flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="w-full h-auto max-h-[68vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          GARMENT STOCK & PHOTO UPDATE MODAL
          ═══════════════════════════════════════════ */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                  <Boxes size={22} />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 uppercase tracking-wider">
                    {editingProduct.category || "Trouser"}
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    Update Stock &amp; Photo — {editingProduct.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* 1. Photo Upload / Replacement */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Garment Cover Photo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {modalImageUrl ? (
                      <img
                        src={modalImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={28} className="text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs">
                        <Camera size={14} />
                        <span>{uploadingPhoto ? "Uploading..." : "Upload New Photo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </label>

                      {modalImageUrl && (
                        <button
                          type="button"
                          onClick={() => setModalImageUrl("")}
                          className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl font-bold transition"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Upload from phone gallery or take photo to update this trouser style in catalogue.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Size Ratio Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Standard Size Ratio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STANDARD_SIZE_RATIOS.map((r) => {
                    const isSelected = modalRatio === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setModalRatio(r.value)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? "bg-orange-50 border-orange-500 text-orange-950 shadow-2xs ring-1 ring-orange-500"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="text-xs font-bold font-mono block">
                          {r.value}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {r.pcs} Pcs / Set
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Colorwise Sets Stepper */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Sets Count by Color
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAddAll(1)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700"
                    >
                      +1 to All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddAll(5)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700"
                    >
                      +5 to All
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="px-2 py-0.5 bg-red-50 hover:bg-red-100 rounded text-[10px] font-bold text-red-700"
                    >
                      Reset 0
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(modalColorSets).map(([color, count]) => {
                    const hex = getColorHexCode(color);
                    const pcsThisColor = count * modalPcsPerSet;

                    return (
                      <div
                        key={color}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-5 h-5 rounded-full border border-black/15 shrink-0 shadow-2xs"
                            style={{ backgroundColor: hex }}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 block truncate">
                              {color}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono font-medium block">
                              {pcsThisColor} Pcs ({modalRatio})
                            </span>
                          </div>
                        </div>

                        {/* Interactive Stepper */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleColorCountChange(color, count - 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm transition cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={count}
                            onChange={(e) =>
                              handleColorCountChange(
                                color,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-14 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => handleColorCountChange(color, count + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-sm transition cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Cost Price Input (Optional) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Product Cost Price (Optional)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Used on Admin Stock tab to calculate total valuation and profits
                  </span>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 450"
                    value={modalCostPrice}
                    onChange={(e) => setModalCostPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 border border-slate-300 bg-white rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* 5. Live Stock Summary Pill */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                    Total Inventory Summary
                  </span>
                  <span className="text-lg font-black text-emerald-950 font-mono">
                    {modalTotalSets} Sets ({modalTotalPcs} Pcs)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                    Estimated Stock Value
                  </span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatCurrency(modalTotalPcs * (editingProduct.retailerPrice || editingProduct.price))}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveStock}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Stock &amp; Photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
