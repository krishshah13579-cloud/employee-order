"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calculator,
  Save,
  RefreshCw,
  Search,
  CheckCircle2,
  DollarSign,
  Package,
  ArrowRight,
  Sparkles,
  Layers,
  HelpCircle,
  Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface CostingItem {
  id: number;
  designNo: string;
  fabricName: string;
  purchasedFrom?: string | null;
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

export default function CostingPage() {
  const { toast } = useToast();

  const [costings, setCostings] = useState<CostingItem[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form fields
  const [designNo, setDesignNo] = useState("");
  const [fabricName, setFabricName] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
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
      const res = await fetch("/api/admin/costing", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setCostings(data.costings || []);
        setProducts(data.products || []);
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

  // Live Auto-Calculations
  const numFabricRate = Math.max(0, parseFloat(fabricRate) || 0);
  const numMtrPerKg = Math.max(0, parseFloat(mtrPerKg) || 0);
  const numAvgFabric = Math.max(0, parseFloat(avgFabricPerPiece) || 0);
  const numJobwork = Math.max(0, parseFloat(jobworkCost) || 0);
  const numOther = Math.max(0, parseFloat(otherCost) || 0);
  const numPress = Math.max(0, parseFloat(pressCost) || 0);
  const numMargin = Math.max(0, parseFloat(margin) || 0);

  // Rate per meter
  const calculatedRatePerMtr = useMemo(() => {
    if (rateMode === "PER_KG") {
      return numMtrPerKg > 0 ? Math.round((numFabricRate / numMtrPerKg) * 100) / 100 : 0;
    }
    return numFabricRate;
  }, [rateMode, numFabricRate, numMtrPerKg]);

  // Direct Calculation: Fabric Cost = Avg Fabric * Rate per Meter
  const calculatedFabricCost = useMemo(() => {
    return Math.round(numAvgFabric * calculatedRatePerMtr * 100) / 100;
  }, [numAvgFabric, calculatedRatePerMtr]);

  // Direct Calculation: Total Costing = Fabric + Jobwork + Other + Press
  const calculatedTotalCosting = useMemo(() => {
    return (
      Math.round(
        (calculatedFabricCost + numJobwork + numOther + numPress) * 100
      ) / 100
    );
  }, [calculatedFabricCost, numJobwork, numOther, numPress]);

  // Direct Calculation: Selling Price = Total Costing + Margin
  const calculatedSellingPrice = useMemo(() => {
    return Math.round((calculatedTotalCosting + numMargin) * 100) / 100;
  }, [calculatedTotalCosting, numMargin]);

  // Direct Calculation: MRP = Price * 2
  const calculatedMrp = useMemo(() => {
    return Math.round(calculatedSellingPrice * 2 * 100) / 100;
  }, [calculatedSellingPrice]);

  // Handle populating an existing costing record
  const handleSelectCosting = (item: CostingItem) => {
    setDesignNo(item.designNo);
    setFabricName(item.fabricName);
    setPurchasedFrom(item.purchasedFrom || "");
    setRateMode((item.rateMode as any) || "PER_METER");
    setFabricRate(String(item.fabricRate || ""));
    setMtrPerKg(item.mtrPerKg ? String(item.mtrPerKg) : "");
    setAvgFabricPerPiece(String(item.avgFabricPerPiece || ""));
    setJobworkCost(String(item.jobworkCost || ""));
    setOtherCost(String(item.otherCost || ""));
    setPressCost(String(item.pressCost || ""));
    setMargin(String(item.margin || ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Reset form
  const handleResetForm = () => {
    setDesignNo("");
    setFabricName("");
    setPurchasedFrom("");
    setRateMode("PER_METER");
    setFabricRate("");
    setMtrPerKg("");
    setAvgFabricPerPiece("");
    setJobworkCost("");
    setOtherCost("");
    setPressCost("");
    setMargin("");
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

    setSaving(true);
    try {
      const res = await fetch("/api/admin/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designNo: designNo.trim(),
          fabricName: fabricName.trim(),
          purchasedFrom: purchasedFrom.trim(),
          rateMode,
          fabricRate: numFabricRate,
          mtrPerKg: rateMode === "PER_KG" ? numMtrPerKg : null,
          avgFabricPerPiece: numAvgFabric,
          jobworkCost: numJobwork,
          otherCost: numOther,
          pressCost: numPress,
          margin: numMargin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save costing");
      }

      toast(data.message || `Costing saved for D.No. ${designNo}!`, "success");
      await fetchData();
    } catch (err: any) {
      toast("Error saving costing: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredCostings = useMemo(() => {
    if (!searchQuery.trim()) return costings;
    const q = searchQuery.toLowerCase();
    return costings.filter(
      (c) =>
        c.designNo.toLowerCase().includes(q) ||
        c.fabricName.toLowerCase().includes(q) ||
        (c.purchasedFrom && c.purchasedFrom.toLowerCase().includes(q))
    );
  }, [costings, searchQuery]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <Calculator size={14} /> Master Costing Engine
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Costing &amp; Pricing Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure raw fabric yield, tailoring jobwork, finishing costs, and locked margin per design number.
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
            className="px-3.5 py-2 text-xs font-bold bg-slate-900 hover:bg-black text-white rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Costing Calculator Form */}
      <form
        onSubmit={handleSaveCosting}
        className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-7 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">
              ₹
            </span>
            <span>Design Costing Calculator</span>
          </h2>
          <button
            type="button"
            onClick={handleResetForm}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Clear Form
          </button>
        </div>

        {/* 1. Design Number (D.No.) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Design Number (D.No.) *
            </label>
            <div className="relative">
              <input
                type="text"
                list="design-suggestions"
                required
                placeholder="e.g. IMP - 001, IMP - 002"
                value={designNo}
                onChange={(e) => setDesignNo(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none uppercase font-mono tracking-wide"
              />
              <datalist id="design-suggestions">
                {products.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} (Current Cost: ₹{p.costPrice ?? "—"}, MRP: ₹{p.mrp ?? "—"})
                  </option>
                ))}
              </datalist>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Type or select design number. Linked directly to Product Catalog and Stock Valuation.
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

        {/* 3. Purchased From (Directly Below Fabric Name) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400" />
            <span>3. Purchased From</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Arvind Mills, Raymond Textile, Local Wholesale Trader (Surat/Bhiwandi)"
            value={purchasedFrom}
            onChange={(e) => setPurchasedFrom(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600 outline-none"
          />
          <span className="text-[11px] text-slate-400 mt-1 block">
            Mill, vendor, or supplier name where the fabric was procured.
          </span>
        </div>

        {/* 4. Fabric Rate & Rate Mode (Per Meter vs Per KG) */}
        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 block">
                4. Fabric Rate Mode &amp; Pricing
              </span>
              <span className="text-[11px] text-emerald-700">
                Choose whether fabric was bought per meter or per kilogram (KG).
              </span>
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-300">
              <button
                type="button"
                onClick={() => setRateMode("PER_METER")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
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
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
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
                {rateMode === "PER_KG" ? "Rate of Fabric (₹ / KG) *" : "Rate of Fabric (₹ / Meter) *"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-emerald-600 font-bold text-xs">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
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
                  Meters per KG (Yield) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 3.2 meters per KG"
                  value={mtrPerKg}
                  onChange={(e) => setMtrPerKg(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                />
                <span className="text-[10px] text-emerald-700 mt-1 block">
                  How many meters come out of 1 KG fabric.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1">
                Effective Rate per Meter (₹)
              </label>
              <div className="px-3 py-2 bg-emerald-100/70 border border-emerald-300 rounded-xl text-sm font-black text-emerald-950 font-mono">
                {formatCurrency(calculatedRatePerMtr)} / mtr
              </div>
              <span className="text-[10px] text-emerald-700 mt-1 block">
                {rateMode === "PER_KG"
                  ? `Computed: ₹${numFabricRate} ÷ ${numMtrPerKg || 1} mtr`
                  : "Direct meter rate"}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Avg Fabric per Piece & Direct Fabric Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              5. Avg. Fabric per Piece (Meters) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 1.25, 1.30 meters"
              value={avgFabricPerPiece}
              onChange={(e) => setAvgFabricPerPiece(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Average fabric consumed to stitch 1 trouser.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 mb-1">
              Fabric Cost (Direct Calculation)
            </label>
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm font-black text-blue-950 font-mono">
              {formatCurrency(calculatedFabricCost)} / piece
            </div>
            <span className="text-[10px] text-blue-700 mt-1 block">
              Directly calculated: {numAvgFabric} mtr × ₹{calculatedRatePerMtr}/mtr
            </span>
          </div>
        </div>

        {/* 6. Jobwork, Other & Press Cost (Entered Separately) */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">
            Manufacturing &amp; Finishing Costs (Entered Separately)
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
                  step="0.01"
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
                  step="0.01"
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
                  step="0.01"
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

        {/* 9. TOTAL COSTING, MARGIN, SELLING PRICE & MRP (SUMMARY BAR) */}
        <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={14} /> Total Costing &amp; Pricing Formula
            </span>
            <span className="text-[10px] text-slate-400">
              Formula: (Fabric + Jobwork + Other + Press) + Margin = Price, MRP = Price × 2
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* TOTAL COSTING */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Costing (Direct)
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
                Manually Add Margin (₹)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-amber-300 font-bold text-xs">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 150"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 bg-white/10 border border-amber-400/40 rounded-xl text-base font-black text-amber-300 focus:bg-white/20 focus:ring-1 focus:ring-amber-400 outline-none font-mono"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Your target profit / piece</span>
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

            {/* MRP = PRICE * 2 */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                MRP (Price × 2)
              </span>
              <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono tracking-tight block">
                {formatCurrency(calculatedMrp)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Maximum Retail Price
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? "Saving & Syncing..." : "Save Costing & Sync to Products"}</span>
          </button>
        </div>
      </form>

      {/* Saved Costings Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Costing Master Records</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              All saved fabric costing records linked directly to stock valuation and wholesale order profit.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by D.No., Fabric..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">D.No.</th>
                <th className="py-3 px-4">Fabric Name</th>
                <th className="py-3 px-4">Purchased From</th>
                <th className="py-3 px-4 text-right">Fabric Rate</th>
                <th className="py-3 px-4 text-right">Avg (mtrs)</th>
                <th className="py-3 px-4 text-right">Fabric Cost</th>
                <th className="py-3 px-4 text-right">Job/Other/Press</th>
                <th className="py-3 px-4 text-right text-emerald-700">Total Costing</th>
                <th className="py-3 px-4 text-right">Margin</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Price</th>
                <th className="py-3 px-4 text-right text-purple-700">MRP</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCostings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    {searchQuery ? "No costing records match your search." : "No costing records saved yet."}
                  </td>
                </tr>
              ) : (
                filteredCostings.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.designNo}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{c.fabricName}</td>
                    <td className="py-3 px-4 text-slate-500">{c.purchasedFrom || "—"}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCurrency(c.fabricRate)} {c.rateMode === "PER_KG" ? "/kg" : "/mtr"}
                      {c.rateMode === "PER_KG" && (
                        <span className="block text-[9px] text-slate-400">
                          (₹{c.ratePerMeter}/mtr)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{c.avgFabricPerPiece} mtr</td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 font-bold">
                      {formatCurrency(c.fabricCost)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                      ₹{c.jobworkCost} + ₹{c.otherCost} + ₹{c.pressCost}
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
                      <button
                        type="button"
                        onClick={() => handleSelectCosting(c)}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
