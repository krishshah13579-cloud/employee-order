"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calculator,
  Save,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Package,
  Trash2,
  Sparkles,
  Layers,
  Building2,
  PlusCircle,
  X,
  Edit2,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface CostingItem {
  id: number;
  designNo: string;
  fabricName: string;
  purchasedFrom?: string | null;
  isJobwork?: boolean;
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
  notes?: string | null;
  updatedAt: string;
}

interface ProductSummary {
  id: number;
  name: string;
  costPrice?: number | null;
  price: number;
  mrp?: number | null;
}

function parseSequenceNumber(dNo: string): number {
  const match = dNo.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function CostingPage() {
  const { toast } = useToast();

  // Tabs: 1. ADD PRODUCT, 2. Master Records
  const [activeTab, setActiveTab] = useState<"ADD_PRODUCT" | "MASTER_RECORDS">("ADD_PRODUCT");

  const [costings, setCostings] = useState<CostingItem[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [missingSequence, setMissingSequence] = useState<string | null>(null);
  const [suggestedNextDesignNo, setSuggestedNextDesignNo] = useState<string>("IMP - 001");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [recentlySavedDesignNo, setRecentlySavedDesignNo] = useState<string | null>(null);

  // Form fields
  const [designNo, setDesignNo] = useState("");
  const [fabricName, setFabricName] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [selectedVendorOption, setSelectedVendorOption] = useState("SELECT_EXISTING");
  const [customVendor, setCustomVendor] = useState("");
  const [isJobwork, setIsJobwork] = useState(false);
  const [rateMode, setRateMode] = useState<"PER_METER" | "PER_KG">("PER_METER");
  const [fabricRate, setFabricRate] = useState<string>("");
  const [mtrPerKg, setMtrPerKg] = useState<string>("");
  const [avgFabricPerPiece, setAvgFabricPerPiece] = useState<string>("");
  const [jobworkCost, setJobworkCost] = useState<string>("");
  const [otherCost, setOtherCost] = useState<string>("");
  const [pressCost, setPressCost] = useState<string>("");
  const [margin, setMargin] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/costing?_t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setCostings(data.costings || []);
        setProducts(data.products || []);
        setVendors(data.vendors || []);
        setMissingSequence(data.missingSequence || null);
        const nextDNo = data.suggestedNextDesignNo || "IMP - 001";
        setSuggestedNextDesignNo(nextDNo);

        // Pre-populate designNo if empty or not editing
        if (!designNo) {
          setDesignNo(nextDNo);
        }
        return data;
      }
    } catch (err: any) {
      toast("Failed to load costing records: " + err.message, "error");
    } finally {
      setLoading(false);
    }
    return null;
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live Auto-Calculations (ALL STRICTLY ROUNDED OFF)
  const numFabricRate = Math.max(0, parseFloat(fabricRate) || 0);
  const numMtrPerKg = Math.max(0, parseFloat(mtrPerKg) || 0);
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

  // Fabric Cost = Avg Fabric * Rate per Meter (Round Off)
  const calculatedFabricCost = useMemo(() => {
    return Math.round(numAvgFabric * calculatedRatePerMtr);
  }, [numAvgFabric, calculatedRatePerMtr]);

  // Total Costing = Fabric + Jobwork + Other + Press (Round Off)
  const calculatedTotalCosting = useMemo(() => {
    return Math.round(calculatedFabricCost + numJobwork + numOther + numPress);
  }, [calculatedFabricCost, numJobwork, numOther, numPress]);

  // Selling Price = Total Costing + Margin (Round Off)
  const calculatedSellingPrice = useMemo(() => {
    return Math.round(calculatedTotalCosting + numMargin);
  }, [calculatedTotalCosting, numMargin]);

  // MRP = Price * 2 - 1 (Strict Round Off: e.g. 1400 -> 1399, 1450 -> 1449)
  const calculatedMrp = useMemo(() => {
    if (calculatedSellingPrice <= 0) return 0;
    const doublePrice = Math.round(calculatedSellingPrice * 2);
    return Math.max(0, doublePrice - 1);
  }, [calculatedSellingPrice]);

  // Check if current D.No. has repeating/duplicate sequence in records
  const duplicateRecord = useMemo(() => {
    if (!designNo.trim()) return null;
    const currentSeq = parseSequenceNumber(designNo);
    if (!currentSeq) return null;
    return costings.filter((c) => parseSequenceNumber(c.designNo) === currentSeq);
  }, [designNo, costings]);

  // Populate form with existing costing record and switch to ADD PRODUCT tab
  const handleSelectCosting = (item: CostingItem) => {
    setIsEditing(true);
    setDesignNo(item.designNo);
    setFabricName(item.fabricName);
    setIsJobwork(Boolean(item.isJobwork));

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

    setActiveTab("ADD_PRODUCT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset form to next incremental sequence
  const handleResetForm = (overrideDesignNo?: string) => {
    setIsEditing(false);
    setDesignNo(overrideDesignNo || suggestedNextDesignNo || "IMP - 001");
    setFabricName("");
    setPurchasedFrom("");
    setSelectedVendorOption("");
    setCustomVendor("");
    setIsJobwork(false);
    setRateMode("PER_METER");
    setFabricRate("");
    setMtrPerKg("");
    setAvgFabricPerPiece("");
    setJobworkCost("");
    setOtherCost("");
    setPressCost("");
    setMargin("");
  };

  // Delete duplicate or repeating costing
  const handleDeleteCosting = async (id: number, dNo: string) => {
    if (!window.confirm(`Are you sure you want to delete costing record "${dNo}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/costing?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete");
      toast(`Deleted costing for ${dNo}`, "success");
      await fetchData();
    } catch (err: any) {
      toast("Error deleting: " + err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Save Costing
  const handleSaveCosting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designNo.trim()) {
      toast("Please enter or select a Design Number (D.No.)", "error");
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
          rateMode,
          fabricRate: Math.round(numFabricRate),
          mtrPerKg: rateMode === "PER_KG" ? numMtrPerKg : null,
          avgFabricPerPiece: numAvgFabric,
          jobworkCost: Math.round(numJobwork),
          otherCost: Math.round(numOther),
          pressCost: Math.round(numPress),
          margin: Math.round(numMargin),
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
      const nextSequence = freshData?.suggestedNextDesignNo || suggestedNextDesignNo;

      // Reset form with new sequence
      handleResetForm(nextSequence);

      // Automatically switch to Master Records tab so user sees updated list
      setActiveTab("MASTER_RECORDS");
    } catch (err: any) {
      toast("Error saving costing: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Filtered and Sequence-Sorted costings
  const filteredCostings = useMemo(() => {
    const list = [...costings].sort((a, b) => {
      const seqA = parseSequenceNumber(a.designNo);
      const seqB = parseSequenceNumber(b.designNo);
      if (seqA !== seqB) return seqA - seqB;
      return a.designNo.localeCompare(b.designNo);
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.designNo.toLowerCase().includes(q) ||
        c.fabricName.toLowerCase().includes(q) ||
        (c.purchasedFrom && c.purchasedFrom.toLowerCase().includes(q))
    );
  }, [costings, searchQuery]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <Calculator size={14} /> Master Costing Engine (Incremental Series)
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Costing &amp; Pricing Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict incremental sequence (IMP - 001, IMP - 002...), raw fabric yield, jobwork mode, and rounded-off MRP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/employee/stock"
            className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <Package size={14} />
            <span>Stock Page</span>
          </Link>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-bold bg-slate-900 hover:bg-black text-white rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* MISSING SEQUENCE ALERT BANNER */}
      {missingSequence && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                Missing Middle Sequence Detected: <span className="font-mono underline text-amber-950 font-black">{missingSequence}</span>
              </p>
              <p className="text-xs text-amber-800">
                A gap was detected in your design sequence. Please add sequence <strong className="font-mono">{missingSequence}</strong> first to keep your master inventory continuous.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setDesignNo(missingSequence);
              setIsEditing(false);
              setActiveTab("ADD_PRODUCT");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition cursor-pointer"
          >
            Fill {missingSequence} Now
          </button>
        </div>
      )}

      {/* 2 SEPARATE TABS: 1. ADD PRODUCT | 2. Master Records */}
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
          <span>1. ADD PRODUCT</span>
          {isEditing && (
            <span className="ml-1 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full font-bold">
              Editing {designNo}
            </span>
          )}
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
          <span>2. Master Records</span>
          <span className="ml-1 px-2.5 py-0.5 text-xs bg-slate-200 text-slate-800 rounded-full font-mono font-bold">
            {costings.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ADD PRODUCT */}
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
                <span className="text-xs text-slate-500">
                  {isEditing
                    ? "Updating existing master record and syncing pricing."
                    : <>Suggested Next Sequence: <strong className="font-mono text-emerald-700 font-bold">{suggestedNextDesignNo}</strong></>}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => handleResetForm()}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <X size={13} />
                  <span>Cancel Edit &amp; Add New</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResetForm()}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Reset Form
                </button>
              )}
            </div>
          </div>

          {/* Editing Banner */}
          {isEditing && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-blue-900 text-xs">
              <span className="flex items-center gap-2">
                <Edit2 size={14} className="text-blue-600" />
                <span>You are currently editing <strong>{designNo}</strong>. Changes will automatically update Master Records &amp; Products.</span>
              </span>
              <button
                type="button"
                onClick={() => handleResetForm()}
                className="font-bold underline text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Switch to Add Mode
              </button>
            </div>
          )}

          {/* JOBWORK CHECKBOX (YES -> NOT MANDATORY TO FILL ALL DETAILS, NO -> MANDATORY TO FILL ALL DETAILS) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
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

          {/* 1. Design Number (D.No.) & 2. Fabric Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. IMP - 001, IMP - 002"
                  value={designNo}
                  onChange={(e) => setDesignNo(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none uppercase font-mono tracking-wide"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Strict incremental sequence (e.g. IMP - 001, IMP - 002, IMP - 003).
              </span>
            </div>

            {/* 2. Fabric Name (Separately) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                2. Fabric Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Premium Cotton Twill, Micro Poly, 4-Way Lycra"
                value={fabricName}
                onChange={(e) => setFabricName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Separate distinct fabric specification linked to this design.
              </span>
            </div>
          </div>

          {/* 3. Purchased From (Dropdown Menu + Custom Vendor Option) */}
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
            <span className="text-[11px] text-slate-400 mt-1 block">
              Select an existing vendor from the dropdown or type any other new mill/supplier name.
            </span>
          </div>

          {/* 4. Fabric Rate & Rate Mode (Per Meter vs Per KG) */}
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block">
                  4. Fabric Rate Mode &amp; Pricing {isJobwork ? "(Optional in Jobwork)" : "*"}
                </span>
                <span className="text-[11px] text-emerald-700">
                  Choose whether fabric was bought per meter or per kilogram (KG). All numbers rounded off.
                </span>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-300">
                <button
                  type="button"
                  onClick={() => setRateMode("PER_METER")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    rateMode === "PER_METER"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Per Meter
                </button>
                <button
                  type="button"
                  onClick={() => setRateMode("PER_KG")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    rateMode === "PER_KG"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Per KG
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                  {rateMode === "PER_KG" ? "Rate of Fabric (₹ / KG)" : "Rate of Fabric (₹ / Meter)"}
                  {!isJobwork && " *"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-emerald-600 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required={!isJobwork}
                    placeholder={rateMode === "PER_KG" ? "e.g. 450 per KG" : "e.g. 180 per meter"}
                    value={fabricRate}
                    onChange={(e) => setFabricRate(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                  />
                </div>
              </div>

              {rateMode === "PER_KG" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                    Meters per KG (Yield) {!isJobwork && "*"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required={!isJobwork}
                    placeholder="e.g. 3.2 meters per KG"
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

          {/* 5. Avg Fabric per Piece & Direct Fabric Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                5. Avg. Fabric per Piece (Meters) {!isJobwork && "*"}
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
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 mb-1">
                Fabric Cost (Direct Round Off)
              </label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-950 font-mono">
                {formatCurrency(calculatedFabricCost)} / piece
              </div>
              <span className="text-[10px] text-blue-700 mt-1 block">
                Round Off: {numAvgFabric} mtr × ₹{calculatedRatePerMtr} = ₹{calculatedFabricCost}
              </span>
            </div>
          </div>

          {/* 6. Jobwork, Other & Press Cost */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">
              Manufacturing &amp; Finishing Costs (Entered Separately — Round Off)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* JOBWORK COST */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  6. JOBWORK COST (₹)
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

              {/* OTHER COST */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  7. OTHER COST (₹)
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
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Trims, tags, buttons, polybag</span>
              </div>

              {/* PRESS COST */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  8. PRESS COST (₹)
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

          {/* 9. TOTAL COSTING, MARGIN, SELLING PRICE & MRP (ROUND OFF) */}
          <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={14} /> Total Costing &amp; Pricing (Round Off)
              </span>
              <span className="text-[10px] text-slate-400">
                Total Costing = Fabric + Jobwork + Other + Press | MRP = (Price × 2) - 1
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* TOTAL COSTING */}
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Costing (Round Off)
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight block">
                  {formatCurrency(calculatedTotalCosting)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                  ₹{calculatedFabricCost} + ₹{numJobwork} + ₹{numOther} + ₹{numPress}
                </span>
              </div>

              {/* MANUAL MARGIN */}
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                  Add Margin (₹ Round Off)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-amber-300 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 150"
                    value={margin}
                    onChange={(e) => setMargin(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 bg-white/10 border border-amber-400/40 rounded-xl text-base font-black text-amber-300 focus:bg-white/20 focus:ring-1 focus:ring-amber-400 outline-none font-mono"
                  />
                </div>
              </div>

              {/* SELLING PRICE */}
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
                  Selling Price (₹)
                </span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight block">
                  {formatCurrency(calculatedSellingPrice)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Costing + Margin
                </span>
              </div>

              {/* MRP = (PRICE * 2) - 1 */}
              <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                  MRP ((Price × 2) - 1)
                </span>
                <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono tracking-tight block">
                  {formatCurrency(calculatedMrp)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  MRP - 1 (e.g. 1399, 1449)
                </span>
              </div>
            </div>
          </div>

          {/* Submit & Cleanup Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {duplicateRecord && duplicateRecord.length > 1 && (
                <span className="text-red-600 font-bold flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  Repeating sequence found! Delete duplicate entries in Master Records to keep series unique.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("MASTER_RECORDS")}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition cursor-pointer"
              >
                View Master Records ({costings.length})
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saving ? "Saving & Syncing..." : `Save ${designNo} (Round Off)`}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: MASTER RECORDS (STRICT INCREMENTAL SEQUENCE) */}
      {activeTab === "MASTER_RECORDS" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
          {/* Top Bar with Add Button and Search */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Costing Master Records (In Strict Sequence)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-mono font-bold">
                  Total {costings.length} Designs
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sorted strictly by sequence (IMP - 001 upwards). Duplicates highlighted for quick clean-up.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sequence, fabric, vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  handleResetForm();
                  setActiveTab("ADD_PRODUCT");
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>+ Add Product ({suggestedNextDesignNo})</span>
              </button>
            </div>
          </div>

          {/* Recently Saved Banner */}
          {recentlySavedDesignNo && (
            <div className="mx-5 my-4 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 text-xs">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  Design <strong>{recentlySavedDesignNo}</strong> was saved successfully and updated in Master Records!
                </span>
              </span>
              <button
                type="button"
                onClick={() => setRecentlySavedDesignNo(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">D.No. (Sequence)</th>
                  <th className="py-3 px-4">Fabric Name</th>
                  <th className="py-3 px-4">Purchased From</th>
                  <th className="py-3 px-4 text-center">Jobwork</th>
                  <th className="py-3 px-4 text-right">Fabric Rate</th>
                  <th className="py-3 px-4 text-right">Fabric Cost</th>
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
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package size={28} className="text-slate-300" />
                        <span>{searchQuery ? "No costing records match your search." : "No costing records saved yet."}</span>
                        <button
                          type="button"
                          onClick={() => {
                            handleResetForm();
                            setActiveTab("ADD_PRODUCT");
                          }}
                          className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                        >
                          Add First Product Costing
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCostings.map((c, idx) => {
                    const isDuplicate =
                      idx > 0 &&
                      parseSequenceNumber(filteredCostings[idx - 1].designNo) === parseSequenceNumber(c.designNo);
                    const isRecentlySaved = recentlySavedDesignNo === c.designNo;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/70 transition ${
                          isRecentlySaved
                            ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-300"
                            : isDuplicate
                            ? "bg-red-50/50"
                            : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{c.designNo}</span>
                            {isRecentlySaved && (
                              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-200 px-1.5 py-0.2 rounded-md">
                                Just Saved
                              </span>
                            )}
                            {isDuplicate && (
                              <span className="text-[10px] text-red-600 font-bold bg-red-100 px-1.5 py-0.2 rounded">
                                Duplicate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{c.fabricName}</td>
                        <td className="py-3 px-4 text-slate-500">{c.purchasedFrom || "—"}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              c.isJobwork ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {c.isJobwork ? "YES" : "NO"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(c.fabricRate)} {c.rateMode === "PER_KG" ? "/kg" : "/mtr"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-blue-700 font-bold">
                          {formatCurrency(c.fabricCost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                          {formatCurrency(c.totalCosting)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-700 font-bold">
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
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer flex items-center gap-1"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCosting(c.id, c.designNo)}
                              disabled={deletingId === c.id}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                              title="Delete this sequence / duplicate"
                            >
                              <Trash2 size={13} />
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
    </div>
  );
}
