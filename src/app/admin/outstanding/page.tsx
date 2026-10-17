"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Receipt,
  Search,
  Plus,
  Eye,
  MessageCircle,
  IndianRupee,
  Calendar,
  Building,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  X,
  CreditCard,
  RotateCcw,
  Check,
  ChevronRight,
  Bell,
  ArrowLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { openWhatsAppDirectly, shareOrOpenWhatsAppWithPdf } from "@/lib/whatsapp-client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface AllocatedBill {
  id: number;
  orderNumber: string;
  taxInvoiceNumber?: string | null;
  displayDocNo: string;
  invoiceDate: string | Date;
  totalSets?: number;
  totalPcs?: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  billStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  status: string;
}

interface CustomerSummary {
  id: number;
  firmName: string;
  city: string;
  state: string;
  phoneNumber: string;
  gstPanNo: string;
  creditDays: number;
  totalBilled: number;
  totalPaid: number;
  totalReturns: number;
  totalCredits: number;
  netOutstanding: number;
  unallocatedCredit: number;
  billsCount: number;
  unpaidBillsCount: number;
  allocatedBills: AllocatedBill[];
}

interface PaymentRecord {
  id: number;
  amount: number;
  paymentDate: string | Date;
  paymentMode: string;
  referenceNo?: string | null;
  notes?: string | null;
}

interface ReturnRecord {
  id: number;
  returnNumber: string;
  totalAmount: number;
  returnDate: string | Date;
  reason?: string | null;
  notes?: string | null;
}

export default function AdminOutstandingPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalOutstandingAll: 0,
    totalBilledAll: 0,
    totalCollectedAll: 0,
    totalReturnsAll: 0,
    totalCustomersCount: 0,
    customersWithOutstandingCount: 0,
  });

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Selected Customer for Ledger Detail View
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [customerLedger, setCustomerLedger] = useState<{
    customer: any;
    summary: any;
    bills: AllocatedBill[];
    payments: PaymentRecord[];
    salesReturns: ReturnRecord[];
  } | null>(null);

  // Record Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<{ id: number; name: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("Bank Transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Super Admin Edit Payment Modal State
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{
    id: number;
    amount: string;
    paymentDate: string;
    paymentMode: string;
    referenceNo: string;
    notes: string;
  } | null>(null);
  const [savingEditPayment, setSavingEditPayment] = useState(false);

  // WhatsApp sending state
  const [sendingWhatsAppFor, setSendingWhatsAppFor] = useState<number | null>(null);

  // Load All Outstanding Data
  const loadOutstandingData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/outstanding");
      if (!res.ok) throw new Error("Failed to load outstanding data");
      const data = await res.json();
      setCustomers(data.customers || []);
      setSummaryStats(
        data.summary || {
          totalOutstandingAll: 0,
          totalBilledAll: 0,
          totalCollectedAll: 0,
          totalReturnsAll: 0,
          totalCustomersCount: 0,
          customersWithOutstandingCount: 0,
        }
      );
    } catch (err: any) {
      toast(err.message || "Error loading outstanding data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOutstandingData();
    // Check if current user is Super Admin
    fetch("/api/auth/check")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user?.isSuperAdmin) {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  // Open Datewise Bills Ledger Modal for Customer
  const handleOpenLedger = async (customerId: number) => {
    setSelectedCustomerId(customerId);
    try {
      setLedgerLoading(true);
      const res = await fetch(`/api/admin/outstanding/${customerId}`);
      if (!res.ok) throw new Error("Failed to load customer bills");
      const data = await res.json();
      setCustomerLedger(data);
    } catch (err: any) {
      toast(err.message || "Failed to load customer bill ledger", "error");
    } finally {
      setLedgerLoading(false);
    }
  };

  // Open Record Payment Modal
  const handleOpenPaymentModal = (c: { id: number; name: string }) => {
    setPaymentCustomer(c);
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMode("Bank Transfer");
    setPaymentRef("");
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast("Please enter a valid payment amount", "error");
      return;
    }

    try {
      setSavingPayment(true);
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: paymentCustomer.id,
          amount: amt,
          paymentDate,
          paymentMode,
          referenceNo: paymentRef,
          notes: paymentNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      toast("✅ Payment recorded successfully! Deducted via FIFO starting from oldest bill.", "success");
      setIsPaymentModalOpen(false);

      // Refresh data
      loadOutstandingData();
      if (selectedCustomerId === paymentCustomer.id) {
        handleOpenLedger(paymentCustomer.id);
      }
    } catch (err: any) {
      toast(err.message || "Failed to record payment", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  // Super Admin: Open Edit Payment Modal
  const handleOpenEditPayment = (p: PaymentRecord) => {
    let pDate = "";
    if (p.paymentDate) {
      try {
        pDate = new Date(p.paymentDate).toISOString().split("T")[0];
      } catch {
        pDate = new Date().toISOString().split("T")[0];
      }
    }
    setEditingPayment({
      id: p.id,
      amount: String(p.amount),
      paymentDate: pDate || new Date().toISOString().split("T")[0],
      paymentMode: p.paymentMode || "Bank Transfer",
      referenceNo: p.referenceNo || "",
      notes: p.notes || "",
    });
    setIsEditPaymentOpen(true);
  };

  // Super Admin: Submit Updated Payment
  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const amt = parseFloat(editingPayment.amount);
    if (isNaN(amt) || amt <= 0) {
      toast("Please enter a valid payment amount", "error");
      return;
    }

    try {
      setSavingEditPayment(true);
      const res = await fetch("/api/admin/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPayment.id,
          amount: amt,
          paymentDate: editingPayment.paymentDate,
          paymentMode: editingPayment.paymentMode,
          referenceNo: editingPayment.referenceNo,
          notes: editingPayment.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment");

      toast("✅ Payment record updated successfully! FIFO balance recalculated.", "success");
      setIsEditPaymentOpen(false);
      setEditingPayment(null);

      loadOutstandingData();
      if (selectedCustomerId) {
        handleOpenLedger(selectedCustomerId);
      }
    } catch (err: any) {
      toast(err.message || "Failed to update payment", "error");
    } finally {
      setSavingEditPayment(false);
    }
  };

  // Super Admin: Delete Payment
  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Are you sure you want to delete this payment record? This will adjust outstanding bills via FIFO.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/payments?id=${paymentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete payment");

      toast("Payment deleted successfully", "success");
      loadOutstandingData();
      if (selectedCustomerId) {
        handleOpenLedger(selectedCustomerId);
      }
    } catch (err: any) {
      toast(err.message || "Failed to delete payment", "error");
    }
  };

  // Send Weekly Payment Reminder on WhatsApp
  const handleSendWhatsAppReminder = async (customerId: number) => {
    try {
      setSendingWhatsAppFor(customerId);
      const res = await fetch(`/api/admin/outstanding/${customerId}/whatsapp`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send WhatsApp reminder");

      if (data.automated) {
        toast("✅ Weekly payment reminder sent directly to customer WhatsApp!", "success");
      } else if (data.whatsappUrl || data.nativeUrl) {
        await shareOrOpenWhatsAppWithPdf({
          whatsappUrl: data.whatsappUrl,
          nativeUrl: data.nativeUrl,
          text: data.message,
          onToast: toast,
        });
      }
    } catch (err: any) {
      toast(err.message || "Failed to send WhatsApp reminder", "error");
    } finally {
      setSendingWhatsAppFor(null);
    }
  };

  // Send Weekly Reminders to ALL customers with outstanding balance
  const [sendingToAll, setSendingToAll] = useState(false);
  const handleSendWeeklyRemindersToAll = async () => {
    if (summaryStats.customersWithOutstandingCount === 0) {
      toast("No customers currently have an outstanding balance.", "info");
      return;
    }

    if (
      !confirm(
        `Send weekly payment reminders to all ${summaryStats.customersWithOutstandingCount} pending customers (Total: ${formatCurrency(
          summaryStats.totalOutstandingAll
        )}) directly via WhatsApp (+918128756632)?`
      )
    ) {
      return;
    }

    setSendingToAll(true);
    try {
      let dispatchedCount = 0;
      let usedGateway = false;

      // 1. Try local gateway first
      try {
        const localRes = await fetch("http://localhost:5050/api/cron/payment-reminders", {
          method: "POST",
          signal: AbortSignal.timeout(10000),
        }).catch(() => null);

        if (localRes && localRes.ok) {
          const localData = await localRes.json();
          dispatchedCount = localData.count || 0;
          usedGateway = true;
        }
      } catch {}

      // 2. Fallback to API route
      if (!usedGateway) {
        const res = await fetch("/api/admin/outstanding/whatsapp-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoDispatch: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to dispatch reminders");
        dispatchedCount = data.count || 0;
      }

      toast(
        `✅ Weekly payment reminders dispatched to ${dispatchedCount} customers directly from WhatsApp (8128756632)!`,
        "success"
      );
      loadOutstandingData();
    } catch (err: any) {
      toast(err.message || "Could not dispatch reminders", "error");
    } finally {
      setSendingToAll(false);
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.firmName.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q) ||
        c.gstPanNo.toLowerCase().includes(q)
    );
  }, [customers, searchTerm]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
              <Receipt size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Customer Outstanding &amp; Ledger
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                FIFO payment allocation: Received payments and returns deduct automatically from the oldest bill first.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendWeeklyRemindersToAll}
            disabled={sendingToAll || summaryStats.customersWithOutstandingCount === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Immediately send weekly payment reminder to all customers with pending balance"
          >
            <Bell size={14} className={sendingToAll ? "animate-bounce" : ""} />
            <span>
              {sendingToAll
                ? "Sending Reminders..."
                : `Send Weekly Reminders (${summaryStats.customersWithOutstandingCount})`}
            </span>
          </button>

          <Link
            href="/admin/returns"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RotateCcw size={14} className="text-purple-600" />
            <span>Sales Returns Tab</span>
          </Link>

          <button
            type="button"
            onClick={loadOutstandingData}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-orange-600" : ""} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white rounded-2xl p-5 border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 block">
              Total Outstanding
            </span>
            <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">
              {formatCurrency(summaryStats.totalOutstandingAll)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              Across {summaryStats.customersWithOutstandingCount} pending customers
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <IndianRupee size={24} />
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
              Payments Collected
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              {formatCurrency(summaryStats.totalCollectedAll)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              Credited via FIFO starting oldest bill
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Total Sales Returns */}
        <div className="bg-white rounded-2xl p-5 border border-purple-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">
              Sales Returns
            </span>
            <span className="text-2xl font-black text-purple-700 font-mono mt-1 block">
              {formatCurrency(summaryStats.totalReturnsAll)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              Credited to customer balances
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <RotateCcw size={24} />
          </div>
        </div>

        {/* Total Wholesale Billed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Wholesale Billed
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {formatCurrency(summaryStats.totalBilledAll)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              From {summaryStats.totalCustomersCount} registered retailers
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <CreditCard size={24} />
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setSelectedCustomerId(null);
            setCustomerLedger(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            !selectedCustomerId
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Building size={14} />
          <span>All Customers ({customers.length})</span>
        </button>

        {selectedCustomerId && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-600 text-white shadow-sm">
            <Receipt size={14} />
            <span className="uppercase tracking-wide">
              {customerLedger?.customer?.shopName || "Customer Bills Ledger"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedCustomerId(null);
                setCustomerLedger(null);
              }}
              className="ml-1 p-0.5 hover:bg-orange-700 rounded transition cursor-pointer text-orange-200 hover:text-white"
              title="Close Ledger & Return to All Customers"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      {!selectedCustomerId && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search firm name, city, phone, GST..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredCustomers.length}</strong> customers
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Firm Name</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4 text-right">Total Billed</th>
                <th className="py-3 px-4 text-right">Paid / Credited</th>
                <th className="py-3 px-4 text-right">Outstanding Amount</th>
                <th className="py-3 px-4 text-center">Bills</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-7 h-7 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold">Loading outstanding balances &amp; FIFO ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No customers found matching &quot;{searchTerm}&quot;
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const hasOutstanding = c.netOutstanding > 0;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleOpenLedger(c.id)}
                    >
                      {/* Firm Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-sm uppercase">
                          {c.firmName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono uppercase">
                          {c.gstPanNo || "UNREGISTERED"}
                        </div>
                      </td>

                      {/* City */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 uppercase">
                        {c.city}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {c.phoneNumber || "—"}
                      </td>

                      {/* Total Billed */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(c.totalBilled)}
                      </td>

                      {/* Paid & Credited */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {formatCurrency(c.totalCredits)}
                      </td>

                      {/* Outstanding Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-black text-sm px-2.5 py-1 rounded-lg ${
                            hasOutstanding
                              ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                          }`}
                        >
                          {formatCurrency(c.netOutstanding)}
                        </span>
                      </td>

                      {/* Bills Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {c.billsCount} bills
                          {c.unpaidBillsCount > 0 && (
                            <span className="text-rose-600 font-black">({c.unpaidBillsCount} unpaid)</span>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()} // prevent double-trigger
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Datewise Bills */}
                          <button
                            type="button"
                            onClick={() => handleOpenLedger(c.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition cursor-pointer shadow-2xs"
                            title="View all bills datewise with FIFO breakdown"
                          >
                            <Eye size={13} />
                            <span className="hidden sm:inline">View Bills</span>
                          </button>

                          {/* Record Payment */}
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal({ id: c.id, name: c.firmName })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                            title="Record payment received from customer"
                          >
                            <Plus size={13} />
                            <span className="hidden sm:inline">Payment</span>
                          </button>

                          {/* WhatsApp Reminder */}
                          {hasOutstanding && (
                            <button
                              type="button"
                              disabled={sendingWhatsAppFor === c.id}
                              onClick={() => handleSendWhatsAppReminder(c.id)}
                              className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition cursor-pointer shadow-2xs"
                              title="Send weekly payment reminder on WhatsApp"
                            >
                              <MessageCircle size={14} className={sendingWhatsAppFor === c.id ? "animate-spin" : ""} />
                            </button>
                          )}
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

      {/* ═══════════════════════════════════════════
          CUSTOMER DATEWISE BILLS & FIFO LEDGER (IN-PAGE VIEW)
          ═══════════════════════════════════════════ */}
      {selectedCustomerId && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header Banner */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCustomerLedger(null);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700 shrink-0"
                title="Return to customer list"
              >
                <ArrowLeft size={16} />
                <span>All Customers</span>
              </button>

              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shrink-0">
                <Receipt size={20} />
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                  {customerLedger?.customer?.shopName || "Customer Bills Ledger"}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-0.5">
                  <span>{customerLedger?.customer?.city || "—"}</span>
                  <span>•</span>
                  <span>{customerLedger?.customer?.phoneNumber || "No phone"}</span>
                  <span>•</span>
                  <span className="text-orange-400 font-mono font-bold">
                    GST/PAN: {customerLedger?.customer?.gstPanNo || "UNREGISTERED"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {customerLedger && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenPaymentModal({
                        id: customerLedger.customer.id,
                        name: customerLedger.customer.shopName,
                      })
                    }
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus size={14} />
                    <span>Record Payment</span>
                  </button>

                  <button
                    type="button"
                    disabled={sendingWhatsAppFor === customerLedger.customer.id}
                    onClick={() => handleSendWhatsAppReminder(customerLedger.customer.id)}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MessageCircle size={14} />
                    <span>Send Reminder</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId(null);
                  setCustomerLedger(null);
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Close Ledger"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Ledger Body */}
          <div className="p-5 space-y-6">
            {ledgerLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Calculating datewise FIFO deductions...</p>
              </div>
            ) : customerLedger ? (
              <>
                {/* Financial KPI Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Billed
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono text-slate-900 mt-0.5 block">
                      {formatCurrency(customerLedger.summary.totalBilled)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                      Payments Received
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono text-emerald-700 mt-0.5 block">
                      {formatCurrency(customerLedger.summary.totalPaid)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                      Sales Returns Credited
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono text-purple-700 mt-0.5 block">
                      {formatCurrency(customerLedger.summary.totalReturns)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
                      Net Outstanding Due
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono text-rose-700 mt-0.5 block">
                      {formatCurrency(customerLedger.summary.netOutstanding)}
                    </span>
                  </div>
                </div>

                {/* 1. Datewise Bills Table (FIFO) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span>Datewise Bills (FIFO Settlement)</span>
                      <span className="text-xs text-slate-500 font-normal">
                        (Deducted starting from oldest bill)
                      </span>
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {customerLedger.bills.length} Total Bills
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Invoice Date</th>
                          <th className="py-2.5 px-3">Invoice / Order No</th>
                          <th className="py-2.5 px-3 text-center">Quantity</th>
                          <th className="py-2.5 px-3 text-right">Total Amount</th>
                          <th className="py-2.5 px-3 text-right">Paid (FIFO)</th>
                          <th className="py-2.5 px-3 text-right">Balance Due</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerLedger.bills.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500">
                              No bills found for this customer.
                            </td>
                          </tr>
                        ) : (
                          customerLedger.bills.map((bill, bIdx) => (
                            <tr key={bill.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-3 font-mono text-slate-400">{bIdx + 1}</td>
                              <td className="py-3 px-3 font-semibold text-slate-800">
                                {formatDate(bill.invoiceDate)}
                              </td>
                              <td className="py-3 px-3">
                                <Link
                                  href={`/orders/${bill.orderNumber}`}
                                  target="_blank"
                                  className="font-mono font-bold text-blue-600 hover:underline"
                                  title="View order / invoice details in new tab"
                                >
                                  #{bill.displayDocNo}
                                </Link>
                              </td>
                              <td className="py-3 px-3 text-center text-slate-600">
                                {bill.totalSets ? `${bill.totalSets}s / ${bill.totalPcs}p` : "—"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(bill.totalAmount)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                                {formatCurrency(bill.paidAmount)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-black text-rose-700">
                                {formatCurrency(bill.balanceAmount)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    bill.billStatus === "PAID"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : bill.billStatus === "PARTIALLY_PAID"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {bill.billStatus.replace("_", " ")}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Payments & Sales Returns History Side-by-Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                  {/* Payment History */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>Payments Received</span>
                        {isSuperAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded">
                            Super Admin (Editable)
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {customerLedger.payments.length} Records
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Mode</th>
                            <th className="py-2 px-3">Ref / UTR</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                            {isSuperAdmin && (
                              <th className="py-2 px-3 text-right">Action</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customerLedger.payments.length === 0 ? (
                            <tr>
                              <td colSpan={isSuperAdmin ? 5 : 4} className="py-4 text-center text-slate-400 text-xs">
                                No payment records logged yet.
                              </td>
                            </tr>
                          ) : (
                            customerLedger.payments.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/70">
                                <td className="py-2 px-3 text-slate-600 font-medium">
                                  {formatDate(p.paymentDate)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {p.paymentMode}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                                  {p.referenceNo || "—"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                  {formatCurrency(p.amount)}
                                </td>
                                {isSuperAdmin && (
                                  <td className="py-2 px-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditPayment(p)}
                                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition cursor-pointer"
                                        title="Edit Payment (Super Admin)"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePayment(p.id)}
                                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                        title="Delete Payment (Super Admin)"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sales Returns History */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <RotateCcw size={14} className="text-purple-600" />
                        <span>Sales Return Invoices (Credits)</span>
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {customerLedger.salesReturns.length} Records
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Return No</th>
                            <th className="py-2 px-3">Reason</th>
                            <th className="py-2 px-3 text-right">Credit (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customerLedger.salesReturns.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-slate-400 text-xs">
                                No product returns for this customer.
                              </td>
                            </tr>
                          ) : (
                            customerLedger.salesReturns.map((r) => (
                              <tr key={r.id}>
                                <td className="py-2 px-3 text-slate-600 font-medium">
                                  {formatDate(r.returnDate)}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-purple-700">
                                  #{r.returnNumber}
                                </td>
                                <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                                  {r.reason || "Product Return"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                                  {formatCurrency(r.totalAmount)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Bottom Navigation */}
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerLedger(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Customer List</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenPaymentModal({
                        id: customerLedger.customer.id,
                        name: customerLedger.customer.shopName,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Record Payment for {customerLedger.customer.shopName}</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          RECORD PAYMENT MODAL
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment — ${paymentCustomer?.name || ""}`}
        size="md"
      >
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Amount Received (₹)*
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 25000"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-orange-500"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              This amount will be deducted starting from the oldest bill first (FIFO).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Date*
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Mode*
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500 bg-white"
              >
                <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Adjustment">Credit Adjustment</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reference / UTR / Cheque Number
            </label>
            <input
              type="text"
              placeholder="e.g. UTR123456789 or Cheque #004512"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Received via ICICI account, cleared on same day"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPayment}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={14} />
              <span>{savingPayment ? "Recording..." : "Save Payment"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════
          SUPER ADMIN EDIT PAYMENT MODAL
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isEditPaymentOpen}
        onClose={() => {
          setIsEditPaymentOpen(false);
          setEditingPayment(null);
        }}
        title="Edit Payment Received (Super Admin)"
        size="md"
      >
        {editingPayment && (
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
              Updating this payment amount will automatically adjust the customer&apos;s bills and recalculate their outstanding dues starting from the oldest bill (FIFO).
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Amount Received (₹)*
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  value={editingPayment.amount}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, amount: e.target.value })
                  }
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Date*
                </label>
                <input
                  type="date"
                  required
                  value={editingPayment.paymentDate}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, paymentDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Mode*
                </label>
                <select
                  value={editingPayment.paymentMode}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, paymentMode: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500 bg-white"
                >
                  <option value="Bank Transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Adjustment">Credit Adjustment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reference / UTR / Cheque Number
              </label>
              <input
                type="text"
                placeholder="e.g. UTR123456789 or Cheque #004512"
                value={editingPayment.referenceNo}
                onChange={(e) =>
                  setEditingPayment({ ...editingPayment, referenceNo: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional notes regarding this payment record..."
                value={editingPayment.notes}
                onChange={(e) =>
                  setEditingPayment({ ...editingPayment, notes: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsEditPaymentOpen(false);
                  setEditingPayment(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditPayment}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check size={14} />
                <span>{savingEditPayment ? "Saving..." : "Update Payment"}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
