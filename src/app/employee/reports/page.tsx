"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Mail,
  Download,
  Filter,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  Package,
  Layers,
  Store,
  CreditCard,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ORDER_STATUSES, STATUS_COLORS } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ReportOrder {
  id: number;
  orderNumber: string;
  taxInvoiceNumber?: string;
  date?: string;
  taxInvoiceDate?: string;
  orderDate?: string;
  createdAt: string;
  status: string;
  placedBy: string;
  businessType: string;
  creditDays: number;
  totalAmount: number;
  subtotal: number;
  gstAmount: number;
  notes?: string;
  totalSets: number;
  totalPcs: number;
  itemsCount: number;
  customer: {
    id: number;
    shopName: string;
    gstPanNo: string;
    phoneNumber: string;
    city: string;
    businessType: string;
    creditDays: number;
  };
  items: Array<{
    id: number;
    productName: string;
    category?: string;
    sizeRatio?: string;
    totalSets?: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  totalSets: number;
  totalPcs: number;
  retailerOrdersCount: number;
  wholesalerOrdersCount: number;
  retailerRevenue: number;
  wholesalerRevenue: number;
  year: number;
  month: string;
}

export default function AdminReportsPage() {
  const { toast } = useToast();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [lastEmailSentAt, setLastEmailSentAt] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let url = `/api/employee/reports?month=${selectedMonth}&year=${selectedYear}`;
      if (statusFilter !== "all") {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load reports");
      }
      const data = await res.json();
      setSummary(data.summary);
      setOrders(data.orders || []);
    } catch (err: any) {
      toast("Error fetching reports: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedMonth, selectedYear, statusFilter]);

  // Client-side search filtering
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.shopName.toLowerCase().includes(q) ||
        o.customer.gstPanNo.toLowerCase().includes(q) ||
        o.customer.phoneNumber.includes(q) ||
        (o.placedBy && o.placedBy.toLowerCase().includes(q))
    );
  }, [orders, search]);

  const handleSendMonthlyEmail = async () => {
    const monthNum = selectedMonth === "all" ? currentDate.getMonth() + 1 : parseInt(selectedMonth, 10);
    const monthName = MONTH_NAMES[monthNum - 1] || "Monthly";

    if (!confirm(`Generate and email the ${monthName} ${selectedYear} Processed Orders Report to your registered admin email?`)) {
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/employee/reports/email-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: monthNum,
          year: parseInt(selectedYear, 10),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast(`✅ Monthly report for ${monthName} successfully emailed!`, "success");
        setLastEmailSentAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      } else {
        throw new Error(data.error || "Failed to send email");
      }
    } catch (err: any) {
      toast("Email failed: " + err.message, "error");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <FileText size={14} /> Wholesale Turnover & Processed Reports
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Orders Processed & Monthly Reports
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Audit confirmed wholesale orders, volume production, dual price channel turnover, and dispatch monthly performance sheets to Gmail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSendMonthlyEmail}
            disabled={sendingEmail}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {sendingEmail ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Generating & Sending Email...</span>
              </>
            ) : (
              <>
                <Mail size={15} />
                <span>📧 Email Monthly Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {lastEmailSentAt && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Last monthly report successfully dispatched to registered email at {lastEmailSentAt} IST.
          </span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Processed Revenue */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Processed Turnover (₹)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-gray-900">
            {formatCurrency(summary?.totalRevenue || 0)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Total sales value incl. 5% GST across processed orders
          </p>
        </div>

        {/* Processed Orders Count */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Processed Orders
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-gray-900">
            {summary?.totalOrders || 0}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Excludes cancelled bookings
          </p>
        </div>

        {/* Total Wholesale Volume */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Volume (Sets & Pcs)
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-gray-900">
            {summary?.totalSets || 0} <span className="text-sm font-semibold text-gray-500">sets</span>
          </div>
          <p className="text-[11px] text-purple-700 font-semibold mt-1 font-mono">
            = {summary?.totalPcs || 0} pieces manufactured
          </p>
        </div>

        {/* Channel Mix Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Channel Mix
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Store size={16} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">Retailers</span>
              <span className="text-lg font-bold text-gray-900 font-mono">
                {summary?.retailerOrdersCount || 0}
              </span>
              <span className="text-[10px] text-gray-400 block font-mono">
                {formatCurrency(summary?.retailerRevenue || 0)}
              </span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex-1">
              <span className="text-[10px] uppercase font-bold text-purple-600 block">Wholesalers</span>
              <span className="text-lg font-bold text-gray-900 font-mono">
                {summary?.wholesalerOrdersCount || 0}
              </span>
              <span className="text-[10px] text-gray-400 block font-mono">
                {formatCurrency(summary?.wholesalerRevenue || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <Calendar size={14} className="text-gray-400" />
            <span className="font-semibold text-gray-600">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-gray-800 outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={String(idx + 1)}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <span className="font-semibold text-gray-600">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-gray-800 outline-none cursor-pointer"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
            <Filter size={14} className="text-gray-400" />
            <span className="font-semibold text-gray-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-gray-800 outline-none cursor-pointer"
            >
              <option value="all">All Processed (Active)</option>
              {ORDER_STATUSES.filter((s) => s !== "Cancelled").map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="Cancelled">Cancelled Only</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search order #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
            <span>Processed Wholesale Orders List</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-mono text-[11px]">
              {filteredOrders.length} records
            </span>
          </div>

          <button
            onClick={fetchReports}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer Shop</th>
                <th className="py-3 px-4">Channel / Type</th>
                <th className="py-3 px-4 text-center">Credit Days</th>
                <th className="py-3 px-4 text-center">Sets (Pcs)</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-orange-500" />
                    Loading processed orders report...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    No processed orders found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isWholesaler = ord.businessType === "WHOLESALER";
                  const statusColor = STATUS_COLORS[ord.status as keyof typeof STATUS_COLORS] || "bg-gray-100 text-gray-700";

                  return (
                    <tr key={ord.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        <Link
                          href={`/employee/orders/${ord.id}`}
                          className="hover:text-orange-600 transition-colors flex items-center gap-1"
                        >
                          <span>{ord.orderNumber}</span>
                          <ExternalLink size={11} className="text-gray-400" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap font-medium">
                        {formatDate(ord.date || ord.taxInvoiceDate || ord.orderDate || ord.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{ord.customer.shopName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {ord.customer.gstPanNo} {ord.customer.city ? `• ${ord.customer.city}` : ""}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isWholesaler ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            WHOLESALER
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            RETAILER
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold ${
                            ord.creditDays === 45
                              ? "bg-amber-50 text-amber-800 border border-amber-300"
                              : ord.creditDays > 0
                              ? "bg-gray-50 text-gray-700 border border-gray-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {ord.creditDays > 0 ? `${ord.creditDays}d` : "Advance"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="font-bold text-gray-900">{ord.totalSets}</span>
                        <span className="text-[11px] text-gray-500 block">({ord.totalPcs} pcs)</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900">
                        {formatCurrency(ord.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/employee/orders/${ord.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </Link>
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
  );
}
