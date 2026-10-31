"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Search,
  RefreshCw,
  FileText,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  Clock,
  Tag,
  AlertTriangle,
  ArrowDownUp,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface SoldProfitBreakdownItem {
  productId: number;
  productName: string;
  category: string;
  soldUnits: number;
  sellingRevenue: number;
  avgSellingPrice: number;
  costPrice: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
}

interface BillProfitBreakdownItem {
  billNo: string;
  orderId: number | string;
  customerName: string;
  customerCity?: string;
  customerType?: string;
  date: string;
  totalPcs: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  isFinalInvoice?: boolean;
}

interface AgingStockBreakdownItem {
  productId: number;
  productName: string;
  category: string;
  arrivalDate: string;
  ageInDays: number;
  ageInMonths: number;
  totalSets: number;
  mixPcs: number;
  totalPcs: number;
  costPrice: number;
  stockValuation: number;
}

interface StockMetrics {
  totalStyles: number;
  activeInStock: number;
  grandTotalSets: number;
  grandTotalMixPcs: number;
  grandTotalPcs: number;
  grandTotalValuation: number;
  grandTotalSoldUnits?: number;
  grandTotalSalesRevenue?: number;
  grandTotalCostOfSold?: number;
  grandTotalSoldProfit?: number;
  overallMarginPercent?: number;
  soldProfitBreakdown?: SoldProfitBreakdownItem[];
  finalInvoiceProfitBreakdown?: BillProfitBreakdownItem[];
  billProfitBreakdown?: BillProfitBreakdownItem[];
  agingStockBreakdown?: AgingStockBreakdownItem[];
  finalInvoicesTotalRevenue?: number;
  finalInvoicesTotalProfit?: number;
  billsTotalRevenue?: number;
  billsTotalProfit?: number;
  agingStockTotalValuation?: number;
  agingStockTotalPcs?: number;
}

export default function AdminProfitPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [profitSearch, setProfitSearch] = useState("");

  // Tabs: STYLES | FINAL_INVOICES | BILLS | AGING_STOCK
  const [profitSubView, setProfitSubView] = useState<"STYLES" | "FINAL_INVOICES" | "BILLS" | "AGING_STOCK">("STYLES");

  const fetchStockMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stock?includeProfit=1", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load profit metrics");
      const data = await res.json();
      setMetrics(data.metrics || null);
    } catch (err: any) {
      toast("Error loading profit data: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockMetrics();
  }, []);

  // Filtered style-wise profit breakdown (in sequence with IMP - 001 at bottom)
  const filteredProfitBreakdown = useMemo(() => {
    const list = (metrics?.soldProfitBreakdown || []).filter(
      (it) => !it.productName.toUpperCase().includes("IMPORTED TROUSER")
    );
    if (!profitSearch.trim()) return list;
    const q = profitSearch.toLowerCase();
    return list.filter(
      (it) =>
        it.productName.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
    );
  }, [metrics?.soldProfitBreakdown, profitSearch]);

  // Filtered Final Invoices (With GST)
  const filteredFinalInvoicesBreakdown = useMemo(() => {
    const list = metrics?.finalInvoiceProfitBreakdown || [];
    if (!profitSearch.trim()) return list;
    const q = profitSearch.toLowerCase();
    return list.filter(
      (it) =>
        it.billNo.toLowerCase().includes(q) ||
        it.customerName.toLowerCase().includes(q) ||
        (it.customerCity && it.customerCity.toLowerCase().includes(q)) ||
        String(it.orderId).includes(q)
    );
  }, [metrics?.finalInvoiceProfitBreakdown, profitSearch]);

  // Filtered Bills (Without GST)
  const filteredBillProfitBreakdown = useMemo(() => {
    const list = metrics?.billProfitBreakdown || [];
    if (!profitSearch.trim()) return list;
    const q = profitSearch.toLowerCase();
    return list.filter(
      (it) =>
        it.billNo.toLowerCase().includes(q) ||
        it.customerName.toLowerCase().includes(q) ||
        (it.customerCity && it.customerCity.toLowerCase().includes(q)) ||
        String(it.orderId).includes(q)
    );
  }, [metrics?.billProfitBreakdown, profitSearch]);

  // Filtered Aging Stock (> 3 Months)
  const filteredAgingStockBreakdown = useMemo(() => {
    const list = metrics?.agingStockBreakdown || [];
    if (!profitSearch.trim()) return list;
    const q = profitSearch.toLowerCase();
    return list.filter(
      (it) =>
        it.productName.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
    );
  }, [metrics?.agingStockBreakdown, profitSearch]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <TrendingUp size={14} /> Wholesale Sold Profit Analysis
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Profit &amp; Margins Report (Per Product Sold)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profit calculated strictly per product sold using Total Costing from Master Costing Engine (bills with Imported Trousers Mix excluded for Retailer/Wholesaler Without GST, returns automatically deducted).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStockMetrics}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Profit</span>
        </button>
      </div>

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 rounded-3xl text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-100">
              Total Net Gross Profit (After Returns)
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-1 font-mono">
              {formatCurrency(metrics?.grandTotalSoldProfit ?? 0)}
            </h2>
            <p className="text-xs text-emerald-100 mt-1 max-w-xl">
              Gross profit calculated across all confirmed &amp; fulfilled orders minus garment cost price. Returned bills and pieces are strictly deducted.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/20">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Sold Units</span>
              <span className="text-xl font-black font-mono">{metrics?.grandTotalSoldUnits ?? 0} PCS</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Sales Revenue</span>
              <span className="text-xl font-black font-mono">{formatCurrency(metrics?.grandTotalSalesRevenue ?? 0)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Cost Price</span>
              <span className="text-xl font-black font-mono">{formatCurrency(metrics?.grandTotalCostOfSold ?? 0)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Net Margin %</span>
              <span className="text-xl font-black font-mono">{metrics?.overallMarginPercent ?? 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub KPI Cards: Final Invoices, Bills, Aging Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Final Invoices (With GST) KPI */}
        <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
              Final Invoices Profit (With GST)
            </span>
            <span className="text-2xl font-black text-blue-700 font-mono mt-0.5 block">
              {formatCurrency(metrics?.finalInvoicesTotalProfit ?? 0)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {metrics?.finalInvoiceProfitBreakdown?.length || 0} Tax Invoices • Rev: {formatCurrency(metrics?.finalInvoicesTotalRevenue ?? 0)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Receipt size={22} />
          </div>
        </div>

        {/* Bills (Without GST) KPI */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
              Bills Profit (Without GST)
            </span>
            <span className="text-2xl font-black text-amber-700 font-mono mt-0.5 block">
              {formatCurrency(metrics?.billsTotalProfit ?? 0)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {metrics?.billProfitBreakdown?.length || 0} Bills • Rev: {formatCurrency(metrics?.billsTotalRevenue ?? 0)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <FileText size={22} />
          </div>
        </div>

        {/* Aging Stock (> 3 Months) KPI */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
              Aging Stock Value (&gt; 3 Months)
            </span>
            <span className="text-2xl font-black text-rose-700 font-mono mt-0.5 block">
              {formatCurrency(metrics?.agingStockTotalValuation ?? 0)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {metrics?.agingStockBreakdown?.length || 0} Designs • {metrics?.agingStockTotalPcs ?? 0} Unsold Pcs
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: Product / Style Profit */}
          <button
            type="button"
            onClick={() => setProfitSubView("STYLES")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profitSubView === "STYLES"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Package size={14} />
            <span>Product / Style Profit</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              profitSubView === "STYLES" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {metrics?.soldProfitBreakdown?.length || 0}
            </span>
          </button>

          {/* Tab 2: Final Invoices (With GST) */}
          <button
            type="button"
            onClick={() => setProfitSubView("FINAL_INVOICES")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profitSubView === "FINAL_INVOICES"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Receipt size={14} />
            <span>Final Invoices (With GST)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              profitSubView === "FINAL_INVOICES" ? "bg-white text-blue-700 font-bold" : "bg-slate-200 text-slate-700"
            }`}>
              {metrics?.finalInvoiceProfitBreakdown?.length || 0}
            </span>
          </button>

          {/* Tab 3: Bills (Without GST) */}
          <button
            type="button"
            onClick={() => setProfitSubView("BILLS")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profitSubView === "BILLS"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText size={14} />
            <span>Bills (Without GST)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              profitSubView === "BILLS" ? "bg-white text-amber-700 font-bold" : "bg-slate-200 text-slate-700"
            }`}>
              {metrics?.billProfitBreakdown?.length || 0}
            </span>
          </button>

          {/* Tab 4: Aging Stock (> 3 Months) */}
          <button
            type="button"
            onClick={() => setProfitSubView("AGING_STOCK")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profitSubView === "AGING_STOCK"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Clock size={14} />
            <span>Old Stock (&gt; 3 Months)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              profitSubView === "AGING_STOCK" ? "bg-white text-rose-700 font-bold" : "bg-slate-200 text-slate-700"
            }`}>
              {metrics?.agingStockBreakdown?.length || 0}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              profitSubView === "STYLES"
                ? "Search style, category..."
                : profitSubView === "FINAL_INVOICES"
                ? "Search Invoice #, customer..."
                : profitSubView === "BILLS"
                ? "Search Bill #, customer..."
                : "Search old design name..."
            }
            value={profitSearch}
            onChange={(e) => setProfitSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: PRODUCT / STYLE-WISE PROFIT BREAKDOWN (IMP - 001 at bottom)
          ═══════════════════════════════════════════════════════════ */}
      {profitSubView === "STYLES" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Product / Style Gross Profit Analysis</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Sequential Order (IMP - 001 at Bottom)
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Showing {filteredProfitBreakdown.length} products. Returned pieces and revenues are strictly deducted.
              </p>
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              *Cost Price sourced directly from Costing Master (Total Costing)
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Style Code</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Units Sold (Net)</th>
                  <th className="py-3 px-4 text-right">Avg Selling Rate</th>
                  <th className="py-3 px-4 text-right">Cost Price / Unit</th>
                  <th className="py-3 px-4 text-right">Total Net Revenue</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span>Calculating product profit metrics...</span>
                    </td>
                  </tr>
                ) : filteredProfitBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <TrendingUp size={32} className="mx-auto mb-2 text-slate-300" />
                      <span>No sold items found matching search criteria.</span>
                    </td>
                  </tr>
                ) : (
                  filteredProfitBreakdown.map((row) => (
                    <tr key={row.productId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {row.productName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {row.soldUnits} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatCurrency(row.avgSellingPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(row.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.sellingRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(row.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        +{formatCurrency(row.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {row.marginPercent}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: FINAL INVOICES (WITH GST) PROFIT BREAKDOWN
          ═══════════════════════════════════════════════════════════ */}
      {profitSubView === "FINAL_INVOICES" && (
        <div className="bg-white rounded-3xl border border-blue-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/40">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Final Invoices Profit Analysis (With GST)</span>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  Official Tax Invoices
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Showing {filteredFinalInvoicesBreakdown.length} official tax invoices. Returned invoices are strictly omitted.
              </p>
            </div>

            <div className="text-xs font-mono font-bold text-blue-700">
              Total Profit: {formatCurrency(metrics?.finalInvoicesTotalProfit ?? 0)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer Firm Name</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-center">Sold Units</th>
                  <th className="py-3 px-4 text-right">Invoice Revenue</th>
                  <th className="py-3 px-4 text-right">Garment Cost</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredFinalInvoicesBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                      <span>No Final Invoices found matching search criteria.</span>
                    </td>
                  </tr>
                ) : (
                  filteredFinalInvoicesBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-blue-700">
                        #{row.billNo}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                        {row.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {row.customerCity || "—"}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {row.totalPcs} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(row.cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-blue-700 text-sm">
                        +{formatCurrency(row.profit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                          {row.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/employee/orders/${row.orderId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-2.5 py-1 rounded-lg bg-blue-50/70 hover:bg-blue-100 transition"
                        >
                          <span>View Invoice</span>
                          <ArrowUpRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: BILLS (WITHOUT GST) PROFIT BREAKDOWN
          ═══════════════════════════════════════════════════════════ */}
      {profitSubView === "BILLS" && (
        <div className="bg-white rounded-3xl border border-amber-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/40">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Bills Profit Analysis (Without GST)</span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Without GST Bills
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Showing {filteredBillProfitBreakdown.length} bills without GST. Imported Trouser Mix bills from Retailer/Wholesaler (Without GST) and returned bills are strictly excluded.
              </p>
            </div>

            <div className="text-xs font-mono font-bold text-amber-700">
              Total Profit: {formatCurrency(metrics?.billsTotalProfit ?? 0)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill No.</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer Firm Name</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-center">Sold Units</th>
                  <th className="py-3 px-4 text-right">Bill Revenue</th>
                  <th className="py-3 px-4 text-right">Garment Cost</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredBillProfitBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                      <span>No Without GST Bills found matching search criteria.</span>
                    </td>
                  </tr>
                ) : (
                  filteredBillProfitBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-amber-700">
                        #{row.billNo}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 uppercase">
                        {row.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {row.customerCity || "—"}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {row.totalPcs} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(row.cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-amber-700 text-sm">
                        +{formatCurrency(row.profit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                          {row.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/employee/orders/${row.orderId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline px-2.5 py-1 rounded-lg bg-amber-50/70 hover:bg-amber-100 transition"
                        >
                          <span>View Bill</span>
                          <ArrowUpRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 4: AGING STOCK (> 3 MONTHS) BREAKDOWN
          ═══════════════════════════════════════════════════════════ */}
      {profitSubView === "AGING_STOCK" && (
        <div className="bg-white rounded-3xl border border-rose-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50/40">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Aging Inventory Report (&gt; 3 Months in Stock)</span>
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  Arrival Date from Costing Master
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Products arrived more than 90 days ago that still have active unsold stock in warehouse. Arranged in sequential order.
              </p>
            </div>

            <div className="text-xs font-mono font-bold text-rose-700">
              Tied-Up Valuation: {formatCurrency(metrics?.agingStockTotalValuation ?? 0)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Design Code</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Arrival Date (Costing)</th>
                  <th className="py-3 px-4 text-center">Stock Age</th>
                  <th className="py-3 px-4 text-center">Unsold Sets</th>
                  <th className="py-3 px-4 text-center">Mix Pcs</th>
                  <th className="py-3 px-4 text-center">Total Unsold Pcs</th>
                  <th className="py-3 px-4 text-right">Cost Price</th>
                  <th className="py-3 px-4 text-right">Tied-Up Valuation</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredAgingStockBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Clock size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">No aging stock older than 3 months found!</p>
                      <p className="text-[11px] mt-1 text-slate-400">
                        All current inventory arrived within the last 90 days or has been fully sold out.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAgingStockBreakdown.map((row) => (
                    <tr key={row.productId} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-slate-900">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {row.productName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {formatDate(row.arrivalDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle size={10} />
                          <span>{row.ageInMonths} Mos ({row.ageInDays} Days)</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {row.totalSets} sets
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-600">
                        {row.mixPcs} pcs
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-rose-700 text-sm">
                        {row.totalPcs} PCS
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 font-semibold">
                        {formatCurrency(row.costPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-700 text-sm">
                        {formatCurrency(row.stockValuation)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
