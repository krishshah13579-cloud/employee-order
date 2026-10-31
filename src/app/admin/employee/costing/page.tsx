"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Layers,
  Building2,
  Sparkles,
  Calculator,
  AlertCircle,
  Check,
  RotateCcw,
  Edit2,
  Trash2,
  ExternalLink,
  FileSpreadsheet,
  TrendingUp,
  X,
  Package,
  Calendar,
  Tag,
  Box,
  Plus,
  Search,
  Image as ImageIcon,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { formatCurrency, formatDate, formatExactRate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";

interface UsedItem {
  itemId?: number;
  name: string;
  category: string;
  quantityUsed: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  imageUrl?: string | null;
  isNewItem?: boolean;
  initialStock?: number;
}

interface CostingItem {
  id: number;
  designNo: string;
  fabricName: string;
  purchasedFrom?: string | null;
  isJobwork?: boolean;
  isGR?: boolean;
  rateMode: string;
  fabricRate: number;
  mtrPerKg?: number | null;
  ratePerMeter: number;
  avgFabricPerPiece: number;
  fabricCost: number;
  jobworkCost: number;
  otherCost: number;
  pressCost: number;
  totalCosting: number;
  margin: number;
  sellingPrice: number;
  mrp: number;
  arrivalDate?: string | Date | null;
  totalMeters?: number | null;
  totalPcs?: number | null;
  itemsUsed?: string | null;
  itemCostPerPiece?: number | null;
  notes?: string | null;
  updatedAt: string;
  createdAt: string;
}

interface YearlyMetrics {
  currentYear: number;
  totalDesignsYearly: number;
  soldWholeDesignsYearly: number;
  grCountYearly: number;
  activeDesignsCount: number;
}

interface AccessoryStockItem {
  id: number;
  name: string;
  category: string;
  imageUrl?: string | null;
  quantity: number;
  unit: string;
  minAlertQty: number;
  costPerUnit: number;
}

export default function AdminCostingPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"ADD_PRODUCT" | "ITEMS_USED" | "MASTER_RECORDS">("ADD_PRODUCT");
  const [costings, setCostings] = useState<CostingItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingGRId, setTogglingGRId] = useState<number | null>(null);

  // Suggested next sequence
  const [suggestedNextDesignNo, setSuggestedNextDesignNo] = useState("IMP - 001");
  const [missingSequence, setMissingSequence] = useState<string | null>(null);

  // Yearly Metrics
  const [yearlyMetrics, setYearlyMetrics] = useState<YearlyMetrics | null>(null);

  // Search & filter in Master Records
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [recentlySavedDesignNo, setRecentlySavedDesignNo] = useState<string | null>(null);

  // In-Stock Trims / Accessories
  const [stockAccessories, setStockAccessories] = useState<AccessoryStockItem[]>([]);
  const [accessoryCategories, setAccessoryCategories] = useState<string[]>([
    "Buttons",
    "Tags",
    "Size Label",
    "Flag Label",
    "Zippers",
    "Thread",
    "Packaging",
    "Other",
  ]);
  const [selectedTrimCategory, setSelectedTrimCategory] = useState<string>("All");

  // Modal: Add New Trim/Accessory on-the-fly
  const [isAddTrimModalOpen, setIsAddTrimModalOpen] = useState(false);
  const [newTrimName, setNewTrimName] = useState("");
  const [newTrimCategory, setNewTrimCategory] = useState("Buttons");
  const [newTrimUnit, setNewTrimUnit] = useState("Pcs");
  const [newTrimInitialStock, setNewTrimInitialStock] = useState("");
  const [newTrimCostPerUnit, setNewTrimCostPerUnit] = useState("");
  const [newTrimQtyUsed, setNewTrimQtyUsed] = useState("");

  // Form fields
  const [arrivalDate, setArrivalDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [designNo, setDesignNo] = useState("");
  const [fabricName, setFabricName] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [selectedVendorOption, setSelectedVendorOption] = useState("SELECT_EXISTING");
  const [customVendor, setCustomVendor] = useState("");
  const [isJobwork, setIsJobwork] = useState(false);
  const [isGR, setIsGR] = useState(false);
  const [rateMode, setRateMode] = useState<"PER_METER" | "PER_KG">("PER_METER");
  const [fabricRate, setFabricRate] = useState<string>("");
  const [mtrPerKg, setMtrPerKg] = useState<string>("");
  const [totalMeters, setTotalMeters] = useState<string>("");
  const [avgFabricPerPiece, setAvgFabricPerPiece] = useState<string>("");
  const [jobworkCost, setJobworkCost] = useState<string>("");
  const [otherCost, setOtherCost] = useState<string>("");
  const [pressCost, setPressCost] = useState<string>("");
  const [margin, setMargin] = useState<string>("");

  // Items Used in current design
  const [itemsUsed, setItemsUsed] = useState<UsedItem[]>([]);

  // Selected item to add to itemsUsed
  const [selectedStockItemId, setSelectedStockItemId] = useState<string>("");
  const [selectedStockQtyUsed, setSelectedStockQtyUsed] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [costRes, accRes] = await Promise.all([
        fetch(`/api/admin/costing?_t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/admin/stock/accessories`, { cache: "no-store" }),
      ]);

      const costData = await costRes.json();
      if (costData.success) {
        setCostings(costData.costings || []);
        setProducts(costData.products || []);
        setVendors(costData.vendors || []);
        setMissingSequence(costData.missingSequence || null);
        if (costData.yearlyMetrics) {
          setYearlyMetrics(costData.yearlyMetrics);
        }
        const nextDNo = costData.suggestedNextDesignNo || "IMP - 001";
        setSuggestedNextDesignNo(nextDNo);

        if (!designNo) {
          setDesignNo(nextDNo);
        }
      }

      if (accRes.ok) {
        const accData = await accRes.json();
        setStockAccessories(accData.items || []);
        if (Array.isArray(accData.types) && accData.types.length > 0) {
          setAccessoryCategories(accData.types);
        }
      }
    } catch (err: any) {
      toast("Failed to load costing records: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live Auto-Calculations (ALL STRICTLY ROUNDED OFF)
  const numFabricRate = Math.max(0, parseFloat(fabricRate) || 0);
  const numMtrPerKg = Math.max(0, parseFloat(mtrPerKg) || 0);
  const numTotalMeters = Math.max(0, parseFloat(totalMeters) || 0);
  const numAvgFabric = Math.max(0, parseFloat(avgFabricPerPiece) || 0);
  const numJobwork = Math.max(0, parseFloat(jobworkCost) || 0);
  const numOther = Math.max(0, parseFloat(otherCost) || 0);
  const numPress = Math.max(0, parseFloat(pressCost) || 0);
  const numMargin = Math.max(0, parseFloat(margin) || 0);

  // Rate per meter (Round Off)
  const calculatedRatePerMtr = useMemo(() => {
    if (rateMode === "PER_KG") {
      return numMtrPerKg > 0 ? Math.round(numFabricRate / numMtrPerKg) : 0;
    }
    return Math.round(numFabricRate);
  }, [rateMode, numFabricRate, numMtrPerKg]);

  // Total Pieces Formula: METER * AVG (Round Off)
  const calculatedTotalPcs = useMemo(() => {
    if (numTotalMeters > 0 && numAvgFabric > 0) {
      return Math.round(numTotalMeters * numAvgFabric);
    }
    return 0;
  }, [numTotalMeters, numAvgFabric]);

  // Fabric Cost = Avg Fabric * Rate per Meter (Round Off)
  const calculatedFabricCost = useMemo(() => {
    return Math.round(numAvgFabric * calculatedRatePerMtr);
  }, [numAvgFabric, calculatedRatePerMtr]);

  // Total Items Used Cost
  const totalItemsUsedCost = useMemo(() => {
    return itemsUsed.reduce((sum, it) => sum + (it.totalCost || (it.quantityUsed * it.costPerUnit)), 0);
  }, [itemsUsed]);

  // Item Cost per Piece = Total Items Cost / Total Pieces (Round Off)
  const calculatedItemCostPerPiece = useMemo(() => {
    if (calculatedTotalPcs > 0 && totalItemsUsedCost > 0) {
      return Math.round(totalItemsUsedCost / calculatedTotalPcs);
    }
    return 0;
  }, [calculatedTotalPcs, totalItemsUsedCost]);

  // Keep otherCost in sync with calculatedItemCostPerPiece when itemsUsed are added
  useEffect(() => {
    if (itemsUsed.length > 0 && calculatedItemCostPerPiece > 0) {
      setOtherCost(String(calculatedItemCostPerPiece));
    }
  }, [calculatedItemCostPerPiece, itemsUsed.length]);

  // Total Costing = Fabric + Jobwork + Other + Press (Round Off)
  const effectiveOtherCost = numOther > 0 ? numOther : calculatedItemCostPerPiece;
  const calculatedTotalCosting = useMemo(() => {
    return Math.round(calculatedFabricCost + numJobwork + effectiveOtherCost + numPress);
  }, [calculatedFabricCost, numJobwork, effectiveOtherCost, numPress]);

  // Selling Price = Total Costing + Margin (Round Off)
  const calculatedSellingPrice = useMemo(() => {
    return Math.round(calculatedTotalCosting + numMargin);
  }, [calculatedTotalCosting, numMargin]);

  // MRP = (Price * 2) - 1 (Strict Round Off: e.g. 1400 -> 1399, 1450 -> 1449)
  const calculatedMrp = useMemo(() => {
    const raw = Math.round(calculatedSellingPrice * 2);
    return raw > 0 ? Math.max(0, raw - 1) : 0;
  }, [calculatedSellingPrice]);

  // Helper to parse sequence numbers
  function parseSequenceNumber(dNo: string): number {
    const match = dNo.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Check if current D.No. has repeating/duplicate sequence in records
  const duplicateRecord = useMemo(() => {
    if (!designNo.trim()) return null;
    const currentSeq = parseSequenceNumber(designNo);
    if (!currentSeq) return null;
    return costings.filter((c) => parseSequenceNumber(c.designNo) === currentSeq);
  }, [designNo, costings]);

  // Add selected stock item to itemsUsed
  const handleAddStockItemToCosting = () => {
    if (!selectedStockItemId) {
      toast("Please select an item from stock", "error");
      return;
    }
    const item = stockAccessories.find((it) => it.id === parseInt(selectedStockItemId, 10));
    if (!item) return;

    const qty = parseInt(selectedStockQtyUsed, 10) || 0;
    if (qty <= 0) {
      toast("Please enter quantity used", "error");
      return;
    }

    // Check if already in list
    const existingIndex = itemsUsed.findIndex((u) => u.itemId === item.id);
    if (existingIndex >= 0) {
      const updated = [...itemsUsed];
      const newQty = updated[existingIndex].quantityUsed + qty;
      updated[existingIndex].quantityUsed = newQty;
      updated[existingIndex].totalCost = Number((newQty * item.costPerUnit).toFixed(2));
      setItemsUsed(updated);
    } else {
      setItemsUsed([
        ...itemsUsed,
        {
          itemId: item.id,
          name: item.name,
          category: item.category,
          quantityUsed: qty,
          unit: item.unit,
          costPerUnit: item.costPerUnit,
          totalCost: Number((qty * item.costPerUnit).toFixed(2)),
          imageUrl: item.imageUrl,
        },
      ]);
    }

    toast(`Added ${qty} ${item.unit} of ${item.name} to items used`, "success");
    setSelectedStockItemId("");
    setSelectedStockQtyUsed("");
  };

  // Remove item from itemsUsed
  const handleRemoveUsedItem = (index: number) => {
    setItemsUsed(itemsUsed.filter((_, i) => i !== index));
  };

  // Add new trim on-the-fly modal handler
  const handleCreateNewTrimOnTheFly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrimName.trim()) {
      toast("Item name is required", "error");
      return;
    }

    const initStock = parseInt(newTrimInitialStock, 10) || 0;
    const qtyUsed = parseInt(newTrimQtyUsed, 10) || 0;
    const cost = parseFloat(newTrimCostPerUnit) || 0;

    // Add to itemsUsed list
    const newItem: UsedItem = {
      name: newTrimName.trim(),
      category: newTrimCategory,
      quantityUsed: qtyUsed > 0 ? qtyUsed : (initStock > 0 ? initStock : 100),
      unit: newTrimUnit,
      costPerUnit: cost,
      totalCost: Math.round((qtyUsed > 0 ? qtyUsed : initStock) * cost),
      isNewItem: true,
      initialStock: initStock,
    };

    setItemsUsed([...itemsUsed, newItem]);

    // Also create in stockAccessories via API
    try {
      const res = await fetch("/api/admin/stock/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTrimName.trim(),
          category: newTrimCategory,
          quantity: initStock,
          unit: newTrimUnit,
          costPerUnit: cost,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setStockAccessories([...stockAccessories, data.item]);
          newItem.itemId = data.item.id;
        }
      }
    } catch {}

    toast(`New item "${newTrimName}" added and included in items used!`, "success");
    setIsAddTrimModalOpen(false);
    setNewTrimName("");
    setNewTrimInitialStock("");
    setNewTrimCostPerUnit("");
    setNewTrimQtyUsed("");
  };

  // Populate form with existing costing record and switch to ADD PRODUCT tab
  const handleSelectCosting = (item: CostingItem) => {
    setIsEditing(true);
    setDesignNo(item.designNo);
    setFabricName(item.fabricName);
    setIsJobwork(Boolean(item.isJobwork));
    setIsGR(Boolean(item.isGR));

    if (item.arrivalDate) {
      setArrivalDate(new Date(item.arrivalDate).toISOString().split("T")[0]);
    } else if (item.createdAt) {
      setArrivalDate(new Date(item.createdAt).toISOString().split("T")[0]);
    }

    setTotalMeters(item.totalMeters ? String(item.totalMeters) : "");

    const vendor = item.purchasedFrom || "";
    setPurchasedFrom(vendor);
    if (vendors.includes(vendor)) {
      setSelectedVendorOption(vendor);
      setCustomVendor("");
    } else if (vendor) {
      setSelectedVendorOption("NEW_VENDOR");
      setCustomVendor(vendor);
    } else {
      setSelectedVendorOption("");
      setCustomVendor("");
    }

    setRateMode((item.rateMode as any) || "PER_METER");
    setFabricRate(item.fabricRate ? String(Math.round(item.fabricRate)) : "");
    setMtrPerKg(item.mtrPerKg ? String(item.mtrPerKg) : "");
    setAvgFabricPerPiece(item.avgFabricPerPiece ? String(item.avgFabricPerPiece) : "");
    setJobworkCost(item.jobworkCost ? String(Math.round(item.jobworkCost)) : "");
    setOtherCost(item.otherCost ? String(Math.round(item.otherCost)) : "");
    setPressCost(item.pressCost ? String(Math.round(item.pressCost)) : "");
    setMargin(item.margin ? String(Math.round(item.margin)) : "");

    // Load itemsUsed if saved
    if (item.itemsUsed) {
      try {
        const parsed = JSON.parse(item.itemsUsed);
        setItemsUsed(Array.isArray(parsed) ? parsed : []);
      } catch {
        setItemsUsed([]);
      }
    } else {
      setItemsUsed([]);
    }

    setActiveTab("ADD_PRODUCT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset form to next incremental sequence
  const handleResetForm = (overrideDesignNo?: string) => {
    setIsEditing(false);
    setDesignNo(overrideDesignNo || suggestedNextDesignNo || "IMP - 001");
    setArrivalDate(new Date().toISOString().split("T")[0]);
    setFabricName("");
    setPurchasedFrom("");
    setSelectedVendorOption("");
    setCustomVendor("");
    setIsJobwork(false);
    setIsGR(false);
    setRateMode("PER_METER");
    setFabricRate("");
    setMtrPerKg("");
    setTotalMeters("");
    setAvgFabricPerPiece("");
    setJobworkCost("");
    setOtherCost("");
    setPressCost("");
    setMargin("");
    setItemsUsed([]);
  };

  // Toggle Goods Return (GR) Status
  const handleToggleGR = async (item: CostingItem) => {
    const newStatus = !item.isGR;
    const confirmMsg = newStatus
      ? `Mark "${item.designNo}" as Goods Return (GR)?\n\nThis marks the fabric as returned to vendor/mill. This D.No. will be strictly hidden from New Product Page, Wholesale/Retail Catalog, and Profit tabs.`
      : `Unmark "${item.designNo}" from Goods Return (GR)?\n\nThis design will become active again in master costing.`;

    if (!window.confirm(confirmMsg)) return;

    setTogglingGRId(item.id);
    try {
      const res = await fetch("/api/admin/costing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isGR: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update GR status");
      toast(data.message || `GR status updated for ${item.designNo}`, "success");
      fetchData();
    } catch (err: any) {
      toast("Error updating GR status: " + err.message, "error");
    } finally {
      setTogglingGRId(null);
    }
  };

  // Save or Update Costing
  const handleSaveCosting = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!designNo.trim()) {
      toast("Please enter the Design Number", "error");
      return;
    }

    if (!fabricName.trim()) {
      toast("Please enter the Fabric Name", "error");
      return;
    }

    const finalPurchasedFrom =
      selectedVendorOption === "NEW_VENDOR"
        ? customVendor.trim()
        : selectedVendorOption.trim() || purchasedFrom.trim();

    // Validation: If NOT Jobwork, all fields mandatory
    if (!isJobwork) {
      if (!fabricRate || parseFloat(fabricRate) <= 0) {
        toast("Mandatory: Please enter Fabric Rate (or check 'Jobwork' if not applicable)", "error");
        return;
      }
      if (!avgFabricPerPiece || parseFloat(avgFabricPerPiece) <= 0) {
        toast("Mandatory: Please enter Avg Fabric per Piece (or check 'Jobwork')", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designNo: designNo.trim().toUpperCase(),
          fabricName: fabricName.trim(),
          purchasedFrom: finalPurchasedFrom,
          isJobwork,
          isGR,
          rateMode,
          fabricRate: Math.round(numFabricRate),
          mtrPerKg: rateMode === "PER_KG" ? numMtrPerKg : null,
          avgFabricPerPiece: numAvgFabric,
          jobworkCost: Math.round(numJobwork),
          otherCost: Math.round(effectiveOtherCost),
          pressCost: Math.round(numPress),
          margin: Math.round(numMargin),
          arrivalDate,
          totalMeters: numTotalMeters,
          totalPcs: calculatedTotalPcs,
          itemsUsed,
          itemCostPerPiece: calculatedItemCostPerPiece,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.missingSequence) {
          toast(data.error, "error");
          setMissingSequence(data.missingSequence);
          setDesignNo(data.missingSequence);
          return;
        }
        throw new Error(data.error || "Failed to save costing");
      }

      const savedDNo = designNo.trim().toUpperCase();
      toast(data.message || `Costing saved for ${savedDNo}! Master records updated.`, "success");
      setRecentlySavedDesignNo(savedDNo);

      // Re-fetch latest master records immediately
      const freshData = await fetchData();
      const nextSequence = (freshData as any)?.suggestedNextDesignNo || suggestedNextDesignNo;

      // Reset form with new sequence
      handleResetForm(nextSequence);

      // Switch to Master Records
      setActiveTab("MASTER_RECORDS");
    } catch (err: any) {
      toast("Error saving costing: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Filtered master records by search query
  const filteredCostings = useMemo(() => {
    if (!searchQuery.trim()) return costings;
    const q = searchQuery.toLowerCase().trim();
    return costings.filter(
      (c) =>
        c.designNo.toLowerCase().includes(q) ||
        c.fabricName.toLowerCase().includes(q) ||
        (c.purchasedFrom && c.purchasedFrom.toLowerCase().includes(q))
    );
  }, [costings, searchQuery]);

  // Filtered stock accessories by category
  const filteredStockAccessories = useMemo(() => {
    if (selectedTrimCategory === "All") return stockAccessories;
    return stockAccessories.filter(
      (it) => it.category.toLowerCase() === selectedTrimCategory.toLowerCase()
    );
  }, [stockAccessories, selectedTrimCategory]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Emerald Yearly Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 rounded-3xl text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-100 flex items-center gap-1.5">
              <Calendar size={14} />
              TOTAL DESIGNS YEARLY ({yearlyMetrics?.currentYear || new Date().getFullYear()})
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-1 font-mono">
              {yearlyMetrics?.totalDesignsYearly ?? costings.length} Designs
            </h2>
            <p className="text-xs text-emerald-100 mt-1 max-w-xl">
              Catalog &amp; production designs overview for the year {yearlyMetrics?.currentYear || new Date().getFullYear()} including active, sold whole designs, and goods returns (GR).
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/20">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Active Designs</span>
              <span className="text-xl font-black font-mono">
                {yearlyMetrics?.activeDesignsCount ?? costings.filter((c) => !c.isGR).length}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Sold Whole Designs</span>
              <span className="text-xl font-black font-mono">
                {yearlyMetrics?.soldWholeDesignsYearly ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Goods Returns (GR)</span>
              <span className="text-xl font-black font-mono text-rose-200">
                {yearlyMetrics?.grCountYearly ?? costings.filter((c) => c.isGR).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: 1. ADD PRODUCT | 2. ITEMS USED | 3. MASTER RECORDS */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("ADD_PRODUCT")}
          className={`px-5 py-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "ADD_PRODUCT"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-2xl shadow-xs"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <PlusCircle size={17} className={activeTab === "ADD_PRODUCT" ? "text-emerald-600" : "text-slate-400"} />
          <span>1. Add Product Costing</span>
          {isEditing && (
            <span className="ml-1 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full font-bold">
              Editing {designNo}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ITEMS_USED")}
          className={`px-5 py-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "ITEMS_USED"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-2xl shadow-xs"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Tag size={17} className={activeTab === "ITEMS_USED" ? "text-emerald-600" : "text-slate-400"} />
          <span>2. Items Used (Trims &amp; Stock)</span>
          <span className={`ml-1 px-2 py-0.5 text-[10px] rounded-full font-mono font-bold ${
            itemsUsed.length > 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
          }`}>
            {itemsUsed.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MASTER_RECORDS")}
          className={`px-5 py-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "MASTER_RECORDS"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-2xl shadow-xs"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Layers size={17} className={activeTab === "MASTER_RECORDS" ? "text-emerald-600" : "text-slate-400"} />
          <span>3. Master Records</span>
          <span className="ml-1 px-2.5 py-0.5 text-xs bg-slate-200 text-slate-800 rounded-full font-mono font-bold">
            {costings.length}
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: ADD PRODUCT COSTING FORM
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "ADD_PRODUCT" && (
        <form
          onSubmit={handleSaveCosting}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-6"
        >
          {/* Header of Form */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">
                ₹
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEditing ? `Edit Design Costing: ${designNo}` : "Add New Product Costing"}
                </h2>
                <p className="text-xs text-slate-500">
                  Calculates fabric cost, manufacturing, items used, and auto-syncs selling prices &amp; MRPs with Product catalog.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleResetForm()}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl font-bold cursor-pointer transition"
            >
              <RotateCcw size={13} />
              <span>Reset to New ({suggestedNextDesignNo})</span>
            </button>
          </div>

          {/* JOBWORK CHECKBOX */}
          <div
            className={`p-4 border rounded-2xl flex items-center justify-between transition ${
              isJobwork ? "bg-blue-50/90 border-blue-300" : "bg-slate-50 border-slate-200"
            }`}
          >
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isJobwork}
                onChange={(e) => setIsJobwork(e.target.checked)}
                className="w-5 h-5 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Jobwork (Outsourced / Labor Only)
                </span>
                <p className="text-xs text-slate-500">
                  {isJobwork
                    ? "✓ YES: Only basic product details (Fabric Name & Purchased From) are required. Fabric rate/yield are optional."
                    : "✗ NO: Standard in-house manufacturing. All fabric rate, yield, and costing details are MANDATORY."}
                </p>
              </div>
            </label>

            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isJobwork
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {isJobwork ? "Jobwork: YES" : "Jobwork: NO"}
            </span>
          </div>

          {/* GOODS RETURN (GR) CHECKBOX */}
          <div
            className={`p-4 border rounded-2xl flex items-center justify-between transition ${
              isGR ? "bg-red-50/90 border-red-300" : "bg-slate-50 border-slate-200"
            }`}
          >
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isGR}
                onChange={(e) => setIsGR(e.target.checked)}
                className="w-5 h-5 text-red-600 rounded-md border-slate-300 focus:ring-red-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <span>Goods Return (GR)</span>
                  {isGR && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-600 text-white font-bold">
                      RETURNED
                    </span>
                  )}
                </span>
                <p className="text-xs text-slate-500">
                  {isGR
                    ? "⚠️ MARKED AS GR: Fabric/product returned to vendor/mill. Strictly hidden from New Product Page, Wholesale/Retail Catalog, and Profit tabs."
                    : "Active in catalog. Check this if fabric or product is returned (GR)."}
                </p>
              </div>
            </label>

            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isGR
                  ? "bg-red-100 text-red-800 border border-red-200"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {isGR ? "GR: YES (RETURNED)" : "GR: NO"}
            </span>
          </div>

          {/* Top Fields: Date Arrived, Design No, Fabric Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Date of Product Arrived */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-emerald-600" />
                <span>Date of Product Arrived *</span>
              </label>
              <input
                type="date"
                required
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Powers Aging Stock (&gt; 3 Months) analysis.
              </span>
            </div>

            {/* Design Number (D.No.) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Design Number (D.No.) *
                </label>
                {duplicateRecord && duplicateRecord.length > 1 && (
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                    ⚠️ Repeating Sequence ({duplicateRecord.length} records)
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                placeholder="e.g. IMP - 001, IMP - 002"
                value={designNo}
                onChange={(e) => setDesignNo(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none uppercase font-mono tracking-wide"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Strict incremental sequence (e.g. IMP - 001).
              </span>
            </div>

            {/* Fabric Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                2. Fabric Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Premium Cotton Twill, 4-Way Lycra"
                value={fabricName}
                onChange={(e) => setFabricName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Fabric specification linked to design.
              </span>
            </div>
          </div>

          {/* Purchased From (Vendor) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-slate-400" />
              <span>3. Purchased From (Vendor / Mill Dropdown)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={selectedVendorOption}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedVendorOption(val);
                  if (val !== "NEW_VENDOR") {
                    setPurchasedFrom(val);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none cursor-pointer"
              >
                <option value="">-- Select Mill / Vendor from List --</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
                <option value="NEW_VENDOR">+ Add Another / New Vendor...</option>
              </select>

              {(selectedVendorOption === "NEW_VENDOR" || !vendors.length || vendors.indexOf(selectedVendorOption) === -1) && (
                <input
                  type="text"
                  placeholder="Type new vendor / mill name..."
                  value={customVendor}
                  onChange={(e) => {
                    setCustomVendor(e.target.value);
                    setPurchasedFrom(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-emerald-400 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              )}
            </div>
          </div>

          {/* 4. Fabric Rate & Rate Mode (Per Meter vs Per KG) */}
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block">
                  4. Fabric Rate &amp; Rate Mode {!isJobwork && "*"}
                </span>
                <span className="text-xs text-emerald-700">
                  Select whether you purchase in Meters or Kilograms (with mtr/kg conversion)
                </span>
              </div>

              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-emerald-300">
                <button
                  type="button"
                  onClick={() => setRateMode("PER_METER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    rateMode === "PER_METER"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rate per Meter
                </button>
                <button
                  type="button"
                  onClick={() => setRateMode("PER_KG")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    rateMode === "PER_KG"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rate per KG
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                  Fabric Rate (₹) {!isJobwork && "*"}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required={!isJobwork}
                  placeholder={rateMode === "PER_METER" ? "e.g. 185 per mtr" : "e.g. 480 per kg"}
                  value={fabricRate}
                  onChange={(e) => setFabricRate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                />
              </div>

              {rateMode === "PER_KG" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                    Meters per KG (mtr/kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 2.50 mtr/kg"
                    value={mtrPerKg}
                    onChange={(e) => setMtrPerKg(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                  Effective Rate per Meter (₹ Round Off)
                </label>
                <div className="px-3 py-2 bg-emerald-100/70 border border-emerald-300 rounded-xl text-sm font-black text-emerald-950 font-mono">
                  {formatCurrency(calculatedRatePerMtr)} / mtr
                </div>
              </div>
            </div>
          </div>

          {/* 5. Total Meters, Avg Fabric & Total Pieces Calculation */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              5. Fabric Yield &amp; Total Pieces Calculation (Meters × Avg)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total Meters Purchased */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Total Fabric (Meters)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1000, 1250 meters"
                  value={totalMeters}
                  onChange={(e) => setTotalMeters(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Purchased fabric quantity in meters
                </span>
              </div>

              {/* Avg. Fabric per Piece */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Avg. Fabric per Piece (Meters) {!isJobwork && "*"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required={!isJobwork}
                  placeholder="e.g. 1.25, 1.30 meters"
                  value={avgFabricPerPiece}
                  onChange={(e) => setAvgFabricPerPiece(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Yield factor per trouser
                </span>
              </div>

              {/* Calculated Total Pieces */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 mb-1">
                  Total Pieces (Meters × Avg)
                </label>
                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-950 font-mono">
                  {calculatedTotalPcs > 0 ? `${calculatedTotalPcs} PCS` : "—"}
                </div>
                <span className="text-[10px] text-blue-700 mt-0.5 block font-semibold">
                  {numTotalMeters > 0 && numAvgFabric > 0
                    ? `Round Off: ${numTotalMeters}m × ${numAvgFabric} = ${calculatedTotalPcs} pcs`
                    : "Enter meters and avg to compute total pcs"}
                </span>
              </div>
            </div>

            {/* Direct Fabric Cost Summary */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Fabric Cost per Piece (Direct Round Off):</span>
              <span className="font-mono font-black text-blue-700 text-sm">
                {formatCurrency(calculatedFabricCost)} / piece
              </span>
            </div>
          </div>

          {/* 6. Items Used (Trims & Stock Integration Card) */}
          <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900 block flex items-center gap-1.5">
                  <Tag size={14} className="text-purple-600" />
                  <span>Items Used in this Design (Buttons, Tags, Labels &amp; Trims)</span>
                </span>
                <span className="text-xs text-purple-700">
                  Select items from stock. Used quantities automatically deduct from inventory on saving.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTrimModalOpen(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>+ Add New Item to Stock</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills & Add Item Row */}
            <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filter Trims:</span>
                {["All", "Buttons", "Tags", "Size Label", "Flag Label", "Zippers", "Other"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedTrimCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedTrimCategory === cat
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Selector row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Select Item from Available Stock ({filteredStockAccessories.length} items available)
                  </label>
                  <select
                    value={selectedStockItemId}
                    onChange={(e) => setSelectedStockItemId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Choose item from stock (e.g. Navy Button, Brand Tag) --</option>
                    {filteredStockAccessories.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} [{it.category}] • Available: {it.quantity} {it.unit} • ₹{it.costPerUnit}/{it.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Qty Used
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500 pcs"
                      value={selectedStockQtyUsed}
                      onChange={(e) => setSelectedStockQtyUsed(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStockItemToCosting}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Added items list */}
            {itemsUsed.length > 0 && (
              <div className="border border-purple-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-purple-100/60 text-purple-900 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Item Name</th>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-center">Qty Used</th>
                      <th className="p-2 text-right">Cost/Unit</th>
                      <th className="p-2 text-right">Total Cost</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {itemsUsed.map((it, idx) => (
                      <tr key={idx} className="hover:bg-purple-50/30">
                        <td className="p-2 font-bold text-slate-900">{it.name}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {it.category}
                          </span>
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-purple-700">
                          {it.quantityUsed} {it.unit}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600">
                          {formatExactRate(it.costPerUnit)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-purple-700">
                          {formatExactRate(it.totalCost)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveUsedItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Calculations Box: Total Item Cost / Total Pieces */}
            <div className="p-3 bg-white border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider block">
                  Total Items Cost (Round Off)
                </span>
                <span className="text-base font-black font-mono text-purple-900">
                  {formatCurrency(totalItemsUsedCost)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Across {itemsUsed.length} item(s) selected
                </span>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider block">
                  Item Cost per Piece (Total Items Cost ÷ Total Pieces)
                </span>
                <span className="text-xl font-black font-mono text-purple-700">
                  {formatCurrency(calculatedItemCostPerPiece)} / piece
                </span>
                <span className="text-[10px] text-purple-700 font-semibold block">
                  {calculatedTotalPcs > 0
                    ? `₹${totalItemsUsedCost} ÷ ${calculatedTotalPcs} pcs = ₹${calculatedItemCostPerPiece}`
                    : "Enter total meters and avg fabric to compute per-piece cost"}
                </span>
              </div>
            </div>
          </div>

          {/* 7. Manufacturing & Finishing Costs */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">
              7. Manufacturing &amp; Finishing Costs (Round Off)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* JOBWORK COST */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  JOBWORK COST (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 110"
                    value={jobworkCost}
                    onChange={(e) => setJobworkCost(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Stitching / tailoring charges</span>
              </div>

              {/* OTHER COST / ITEM COSTING */}
              <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-900 mb-1">
                  ITEM COSTING / OTHER (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 35"
                    value={otherCost}
                    onChange={(e) => setOtherCost(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-purple-300 rounded-xl text-sm font-black text-purple-950 focus:ring-2 focus:ring-purple-600 outline-none font-mono"
                  />
                </div>
                <span className="text-[10px] text-purple-700 mt-1 block font-semibold">
                  Auto-filled from Items Used (₹{calculatedItemCostPerPiece}/pc)
                </span>
              </div>

              {/* PRESS COST */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  PRESS COST (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 15"
                    value={pressCost}
                    onChange={(e) => setPressCost(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Steam pressing &amp; folding</span>
              </div>
            </div>
          </div>

          {/* 8. TOTAL COSTING, MARGIN, SELLING PRICE & MRP (ROUND OFF) */}
          <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Calculator size={14} />
                <span>8. Final Calculations &amp; Margin</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Formula: Fabric + Jobwork + Items + Press
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  TOTAL COSTING (Round Off)
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                  {formatCurrency(calculatedTotalCosting)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Production unit cost
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Added Margin (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 150"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-emerald-400 outline-none font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Selling profit margin
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  SELLING PRICE (Round Off)
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {formatCurrency(calculatedSellingPrice)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Wholesale baseline
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                  MRP (Round Off - 1)
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-purple-400">
                  {formatCurrency(calculatedMrp)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Strict: (Price × 2) - 1
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleResetForm()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel &amp; Reset
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Costing &amp; Deducting Stock...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Save Costing for {designNo || "Design"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: DEDICATED ITEMS USED (TRIMS & STOCK) VIEW
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "ITEMS_USED" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Tag size={18} className="text-purple-600" />
                  <span>Items Used in Active Design ({designNo || "IMP - 001"})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage buttons, tags, size labels, and flag labels. Quantities used deduct from stock when the costing is saved.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddTrimModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>+ Add Item Not in Stock</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  Total Items Cost
                </span>
                <span className="text-2xl font-black font-mono text-purple-900 mt-1 block">
                  {formatCurrency(totalItemsUsedCost)}
                </span>
                <span className="text-[10px] text-purple-700">Across {itemsUsed.length} item(s)</span>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Total Garment Pieces
                </span>
                <span className="text-2xl font-black font-mono text-blue-900 mt-1 block">
                  {calculatedTotalPcs > 0 ? `${calculatedTotalPcs} PCS` : "—"}
                </span>
                <span className="text-[10px] text-blue-700">Calculated via Meters × Avg</span>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Item Cost per Garment (Round Off)
                </span>
                <span className="text-2xl font-black font-mono text-emerald-900 mt-1 block">
                  {formatCurrency(calculatedItemCostPerPiece)} / piece
                </span>
                <span className="text-[10px] text-emerald-700">Applied to Other Cost</span>
              </div>
            </div>

            {/* In-Stock Items Selector */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filter Trims:</span>
                {["All", "Buttons", "Tags", "Size Label", "Flag Label", "Zippers", "Other"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedTrimCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedTrimCategory === cat
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Select Available Trim from Warehouse Stock
                  </label>
                  <select
                    value={selectedStockItemId}
                    onChange={(e) => setSelectedStockItemId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Select trim item (e.g. Navy Button, Brand Tag) --</option>
                    {filteredStockAccessories.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} [{it.category}] • Stock: {it.quantity} {it.unit} • ₹{it.costPerUnit}/{it.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Qty Used
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500"
                      value={selectedStockQtyUsed}
                      onChange={(e) => setSelectedStockQtyUsed(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStockItemToCosting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    + Add to Design
                  </button>
                </div>
              </div>
            </div>

            {/* List of items currently in this design */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Quantity Used</th>
                    <th className="p-3 text-right">Cost Per Unit</th>
                    <th className="p-3 text-right">Total Line Cost</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsUsed.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <Tag size={28} className="mx-auto mb-2 text-slate-300" />
                        <span>No trims or items added to this design yet.</span>
                      </td>
                    </tr>
                  ) : (
                    itemsUsed.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{it.name}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {it.category}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-purple-700">
                          {it.quantityUsed} {it.unit}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">
                          {formatExactRate(it.costPerUnit)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-700">
                          {formatExactRate(it.totalCost)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveUsedItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("ADD_PRODUCT")}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Apply to Costing Form</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: MASTER COSTING RECORDS TABLE
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "MASTER_RECORDS" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search D.No., fabric name, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{filteredCostings.length}</strong> master records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">D.No. (Sequence)</th>
                  <th className="py-3 px-4">Arrival Date</th>
                  <th className="py-3 px-4">Fabric Name</th>
                  <th className="py-3 px-4">Purchased From</th>
                  <th className="py-3 px-4 text-center">Meters / Pcs</th>
                  <th className="py-3 px-4 text-right">Fabric Cost</th>
                  <th className="py-3 px-4 text-right text-purple-700">Items Cost</th>
                  <th className="py-3 px-4 text-right text-emerald-700">Total Costing</th>
                  <th className="py-3 px-4 text-right">Margin</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Price</th>
                  <th className="py-3 px-4 text-right text-purple-700">MRP</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCostings.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Package size={28} className="mx-auto mb-2 text-slate-300" />
                      <span>{searchQuery ? "No costing records match your search." : "No costing records saved yet."}</span>
                    </td>
                  </tr>
                ) : (
                  filteredCostings.map((c, idx) => {
                    const isRecentlySaved = recentlySavedDesignNo === c.designNo;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/70 transition ${
                          isRecentlySaved ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-300" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={c.isGR ? "line-through text-slate-400" : ""}>{c.designNo}</span>
                            {c.isGR && (
                              <span className="text-[10px] text-red-700 font-bold bg-red-100 border border-red-300 px-1.5 py-0.2 rounded-md">
                                GR (Returned)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {c.arrivalDate ? formatDate(c.arrivalDate) : (c.createdAt ? formatDate(c.createdAt) : "—")}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">{c.fabricName}</td>
                        <td className="py-3 px-4 text-slate-600">{c.purchasedFrom || "—"}</td>

                        <td className="py-3 px-4 text-center font-mono">
                          {c.totalMeters || c.totalPcs ? (
                            <span className="text-slate-700 font-bold">
                              {c.totalMeters ? `${c.totalMeters}m` : "—"} / {c.totalPcs ? `${c.totalPcs}p` : "—"}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatCurrency(c.fabricCost)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                          {c.otherCost ? formatCurrency(c.otherCost) : "—"}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                          {formatCurrency(c.totalCosting)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono">
                          +{formatCurrency(c.margin)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(c.sellingPrice)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                          {formatCurrency(c.mrp)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectCosting(c)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Edit Costing & Items"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleGR(c)}
                              disabled={togglingGRId === c.id}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                c.isGR
                                  ? "text-red-700 bg-red-100 hover:bg-red-200"
                                  : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                              }`}
                              title={c.isGR ? "Unmark from GR" : "Mark as Goods Return (GR)"}
                            >
                              <span className="text-[10px] font-bold">GR</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: ADD NEW TRIM / ACCESSORY ON-THE-FLY
          ═══════════════════════════════════════════════════════════ */}
      {isAddTrimModalOpen && (
        <Modal
          isOpen={isAddTrimModalOpen}
          onClose={() => setIsAddTrimModalOpen(false)}
          title="+ Add New Item Not In Stock"
          size="md"
        >
          <form onSubmit={handleCreateNewTrimOnTheFly} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Item Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Matte Metal Button, Rubberized Flag Label"
                value={newTrimName}
                onChange={(e) => setNewTrimName(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={newTrimCategory}
                  onChange={(e) => setNewTrimCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                >
                  {accessoryCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Unit
                </label>
                <select
                  value={newTrimUnit}
                  onChange={(e) => setNewTrimUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Gross">Gross</option>
                  <option value="Meters">Meters</option>
                  <option value="Rolls">Rolls</option>
                  <option value="Boxes">Boxes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 5000"
                  value={newTrimInitialStock}
                  onChange={(e) => setNewTrimInitialStock(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Cost/Unit (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1.25"
                  value={newTrimCostPerUnit}
                  onChange={(e) => setNewTrimCostPerUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-900 mb-1">
                  Qty Used Now
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 500"
                  value={newTrimQtyUsed}
                  onChange={(e) => setNewTrimQtyUsed(e.target.value)}
                  className="w-full px-3 py-2 bg-purple-50 border border-purple-300 rounded-xl text-xs font-bold text-purple-900 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddTrimModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Add &amp; Use in Design
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
