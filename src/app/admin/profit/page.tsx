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
  CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface SoldProfitBreakdownItem {
  productId: number;
  productName: string;
  category: string;
  unitsSold: number;
  sellingRevenue: number;
  avgSellingPrice: number;
  costPrice: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
}

interface BillProfitBreakdownItem {
  billNo: string;
  orderId: number;
  customerName: string;
  date: string;
  totalPcs: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
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
  billProfitBreakdown?: BillProfitBreakdownItem[];
}

export default function AdminProfitPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [profitSearch, setProfitSearch] = useState("");
  const [profitSubView, setProfitSubView] = useState<"BILLS" | "STYLES">("BILLS");

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

  // Filtered style-wise profit breakdown
  const filteredProfitBreakdown = useMemo(() => {
    const list = metrics?.soldProfitBreakdown || [];
    if (!profitSearch.trim()) return list;
    const q = profitSearch.toLowerCase();
    return list.filter(
      (it) =>
        it.productName.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
    );
  }, [metrics?.soldProfitBreakdown, profitSearch]);

  // Filtered bill-wise profit breakdown (Bill #1 to #39)
  const filteredBillProfitBreakdown = useMemo(() => {
    const list = metrics?.billProfitBreakdown || [];
    if (!profitSearch.trim()) return list;
    const q = profitSearch.toLowerCase();
    return list.filter(
      (it) =>
        it.billNo.toLowerCase().includes(q) ||
        it.customerName.toLowerCase().includes(q) ||
        String(it.orderId).includes(q)
    );
  }, [metrics?.billProfitBreakdown, profitSearch]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <TrendingUp size={14} /> Wholesale Sold Profit Analysis
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Profit &amp; Margins Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Realized gross profit on fulfilled wholesale orders, bill-wise margins, and product profitability.
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
              Total Sold Units Profit Summary (Bill #1 – #{metrics?.billProfitBreakdown?.length || 39})
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-1 font-mono">
              {formatCurrency(metrics?.grandTotalSoldProfit ?? 0)}
            </h2>
            <p className="text-xs text-emerald-100 mt-1 max-w-xl">
              Total gross profit accurately calculated across all confirmed & fulfilled orders (Bill #1 to #{metrics?.billProfitBreakdown?.length || 39}) minus actual garment cost price.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/10 backdrop-blur-xs p-4 rounded-2xl border border-white/20">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Sold Units</span>
              <span className="text-xl font-black font-mono">{metrics?.grandTotalSoldUnits ?? 0}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Sales Revenue</span>
              <span className="text-xl font-black font-mono">{formatCurrency(metrics?.grandTotalSalesRevenue ?? 0)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Cost of Sold</span>
              <span className="text-xl font-black font-mono">{formatCurrency(metrics?.grandTotalCostOfSold ?? 0)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block">Overall Margin</span>
              <span className="text-xl font-black font-mono text-emerald-300">+{metrics?.overallMarginPercent ?? 0}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-view switcher & Search bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProfitSubView("BILLS")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profitSubView === "BILLS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText size={14} />
            <span>Bill-wise Profit (Bill #1 – #{metrics?.billProfitBreakdown?.length || 39})</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              profitSubView === "BILLS" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
            }`}>
              {metrics?.billProfitBreakdown?.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProfitSubView("STYLES")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profitSubView === "STYLES"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Package size={14} />
            <span>Product / Style Profit</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              profitSubView === "STYLES" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
            }`}>
              {metrics?.soldProfitBreakdown?.length ?? 0}
            </span>
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={profitSubView === "BILLS" ? "Search Bill #, customer name or order ID..." : "Search style or category..."}
            value={profitSearch}
            onChange={(e) => setProfitSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600 transition"
          />
        </div>
      </div>

      {/* VIEW A: BILL-WISE PROFIT BREAKDOWN (BILL #1 TO #39) */}
      {profitSubView === "BILLS" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Bill-wise Sales & Profit Statement (Bill #1 to #{metrics?.billProfitBreakdown?.length || 39})
              </h3>
              <p className="text-[11px] text-slate-500">
                Showing {filteredBillProfitBreakdown.length} invoices. Every invoice revenue, cost, and gross profit breakdown.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Total Profit: {formatCurrency(metrics?.grandTotalSoldProfit ?? 0)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bill / Invoice #</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Bill Revenue</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredBillProfitBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                      <span>No bills match your search criteria.</span>
                    </td>
                  </tr>
                ) : (
                  filteredBillProfitBreakdown.map((row) => (
                    <tr key={row.orderId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-mono font-bold text-[11px]">
                          <FileText size={12} className="text-slate-500" />
                          Bill #{row.billNo}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {row.customerName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(row.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
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
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        +{formatCurrency(row.profit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          row.marginPercent >= 25
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : row.marginPercent > 0
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        }`}>
                          {row.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${row.orderId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-2.5 py-1 rounded-lg bg-blue-50/70 hover:bg-blue-100 transition"
                        >
                          <span>View Order</span>
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

      {/* VIEW B: PRODUCT / STYLE-WISE PROFIT BREAKDOWN */}
      {profitSubView === "STYLES" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Product / Style Gross Profit Analysis
              </h3>
              <p className="text-[11px] text-slate-500">
                Showing {filteredProfitBreakdown.length} products sold across all bills.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Style Code</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Avg Selling Rate</th>
                  <th className="py-3 px-4 text-right">Cost Price / Unit</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                  <th className="py-3 px-4 text-right">Gross Profit</th>
                  <th className="py-3 px-4 text-center">Margin %</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProfitBreakdown.length === 0 ? (
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
                        {row.productName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-700">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        {row.unitsSold} pcs
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
    </div>
  );
}
