"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Printer,
  Search,
  Building,
  Phone,
  FileText,
  Calendar,
  IndianRupee,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Share2,
  Copy,
  ChevronDown,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate, numberToIndianWords } from "@/lib/utils";
import { openWhatsAppDirectly } from "@/lib/whatsapp-client";
import { useToast } from "@/components/ui/Toast";

interface CustomerOption {
  id: number;
  shopName: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  city?: string | null;
  state?: string | null;
  gstPanNo?: string | null;
}

interface PendingBill {
  id: string;
  billNo: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  totalSets: number;
  totalPcs: number;
  status: "PAID" | "PARTIALLY_PAID" | "UNPAID";
}

interface LedgerTx {
  id: string;
  date: string;
  type: "INVOICE" | "PAYMENT" | "RETURN";
  docNo: string;
  particulars: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerData {
  customer: {
    id: number;
    shopName: string;
    contactPerson?: string | null;
    gstPanNo?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    creditDays: number;
    businessType?: string | null;
  };
  company: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    phone: string;
    email: string;
    gstNo: string;
    panNo: string;
  };
  bank: {
    name: string;
    branch: string;
    accountNumber: string;
    ifscCode: string;
    beneficiary: string;
  };
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalReturns: number;
    totalCredits: number;
    netOutstanding: number;
    unallocatedCredit: number;
    totalBillsCount: number;
    pendingBillsCount: number;
    totalPendingAmount: number;
  };
  pendingBills: PendingBill[];
  ledgerTransactions: LedgerTx[];
  reportDate: string;
}

function LedgerContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    initialCustomerId ? parseInt(initialCustomerId, 10) : null
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);

  // Active view format: "format1" = Due & Pending Bills Letter | "format2" = Complete Chronological Statement
  const [activeFormat, setActiveFormat] = useState<"format1" | "format2">("format1");

  // Fetch all customers for selector
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomers(data);
          // If no customer was selected yet, select the first one if available
          if (!selectedCustomerId && data.length > 0) {
            setSelectedCustomerId(data[0].id);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load customers:", err);
      });
  }, []);

  // Fetch ledger whenever selected customer changes
  useEffect(() => {
    if (!selectedCustomerId) return;
    setLoading(true);
    fetch(`/api/admin/ledger/${selectedCustomerId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load customer ledger");
        }
        return res.json();
      })
      .then((data) => {
        setLedgerData(data);
      })
      .catch((err) => {
        console.error(err);
        toast(err.message || "Could not load customer ledger", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.shopName.toLowerCase().includes(q) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.phoneNumber && c.phoneNumber.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const selectedCustomerInfo = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || ledgerData?.customer;
  }, [customers, selectedCustomerId, ledgerData]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!ledgerData) return;
    const cust = ledgerData.customer;
    const phone = cust.phoneNumber ? cust.phoneNumber.replace(/[^0-9]/g, "") : "";

    let message = "";
    if (activeFormat === "format1") {
      message = `*OUTSTANDING PAYMENT REMINDER*\n`;
      message += `*${ledgerData.company.name}*\n\n`;
      message += `To: *${cust.shopName}*\n`;
      if (cust.city) message += `City: ${cust.city}\n`;
      message += `Date: ${formatDate(new Date())}\n\n`;
      message += `_Note: The bills that are partly paid (amount left after deducting received payments) and unpaid bills are listed below:_\n\n`;

      if (ledgerData.pendingBills.length === 0) {
        message += `✅ *All previous bills are fully settled! No pending payment.*\n\n`;
      } else {
        ledgerData.pendingBills.forEach((b, idx) => {
          message += `${idx + 1}) *Bill #${b.billNo}* (Dt: ${formatDate(b.billDate)})\n`;
          message += `   Due Dt: ${formatDate(b.dueDate)}\n`;
          if (b.status === "PARTIALLY_PAID") {
            message += `   Bill Amt: ${formatCurrency(b.totalAmount)} | Paid: ${formatCurrency(b.paidAmount)}\n`;
            message += `   *Pending Left: ${formatCurrency(b.pendingAmount)}*\n\n`;
          } else {
            message += `   *Pending Amt: ${formatCurrency(b.pendingAmount)}*\n\n`;
          }
        });

        message += `*TOTAL PENDING DUE: ${formatCurrency(ledgerData.summary.totalPendingAmount)}*\n`;
        message += `(${numberToIndianWords(ledgerData.summary.totalPendingAmount)})\n\n`;
      }

      message += `*Bank Remittance Details:*\n`;
      message += `Bank: ${ledgerData.bank.name}\n`;
      message += `A/C No: ${ledgerData.bank.accountNumber}\n`;
      message += `IFSC: ${ledgerData.bank.ifscCode}\n`;
      message += `Branch: ${ledgerData.bank.branch}\n`;
      message += `Beneficiary: ${ledgerData.bank.beneficiary}\n\n`;
      message += `Kindly clear the pending balance at your earliest convenience. Thank you!`;
    } else {
      message = `*STATEMENT OF ACCOUNT (LEDGER)*\n`;
      message += `*${ledgerData.company.name}*\n\n`;
      message += `To: *${cust.shopName}*\n`;
      if (cust.city) message += `City: ${cust.city}\n`;
      message += `Date: ${formatDate(new Date())}\n\n`;
      message += `*Financial Summary:*\n`;
      message += `• Total Billed: ${formatCurrency(ledgerData.summary.totalBilled)}\n`;
      message += `• Total Paid/Credits: ${formatCurrency(ledgerData.summary.totalCredits)}\n`;
      message += `• *Net Outstanding Balance: ${formatCurrency(ledgerData.summary.netOutstanding)}*\n\n`;
      message += `*Bank Remittance Details:*\n`;
      message += `Bank: ${ledgerData.bank.name} | A/C: ${ledgerData.bank.accountNumber} | IFSC: ${ledgerData.bank.ifscCode}\n\n`;
      message += `For detailed statement or queries, please contact ${ledgerData.company.phone}.`;
    }

    if (phone && phone.length >= 10) {
      openWhatsAppDirectly({
        whatsappUrl: `https://web.whatsapp.com/send?phone=91${phone.slice(-10)}&text=${encodeURIComponent(message)}`,
        nativeUrl: `whatsapp://send?phone=91${phone.slice(-10)}&text=${encodeURIComponent(message)}`,
      });
    } else {
      openWhatsAppDirectly({
        whatsappUrl: `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`,
        nativeUrl: `whatsapp://send?text=${encodeURIComponent(message)}`,
      });
    }
  };

  const handleCopyText = () => {
    if (!ledgerData) return;
    const cust = ledgerData.customer;
    let text = `OUTSTANDING STATEMENT - ${ledgerData.company.name}\n`;
    text += `Customer: ${cust.shopName} (${cust.city || ""})\n`;
    text += `Date: ${formatDate(new Date())}\n`;
    text += `Total Outstanding Due: ${formatCurrency(ledgerData.summary.totalPendingAmount)}\n\n`;
    ledgerData.pendingBills.forEach((b, idx) => {
      text += `${idx + 1}. Bill #${b.billNo} | Dt: ${formatDate(b.billDate)} | Due: ${formatDate(b.dueDate)} | Amount Left: ${formatCurrency(b.pendingAmount)}\n`;
    });
    text += `\nBank: ${ledgerData.bank.name} | A/C: ${ledgerData.bank.accountNumber} | IFSC: ${ledgerData.bank.ifscCode}\n`;

    navigator.clipboard.writeText(text);
    toast("Statement copied to clipboard!", "success");
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─────────────────────────────────────────────────────────
          SCREEN ONLY: Control Bar & Customer Selector
          ───────────────────────────────────────────────────────── */}
      <div className="print:hidden space-y-4">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Receipt className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-black text-zinc-900 tracking-tight">
                Print Customer Ledger
              </h1>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Generate pixel-perfect A4 printable statements & reminders with bank details
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!ledgerData || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-black text-amber-400 font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Print document or save as A4 PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 PDF</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!ledgerData || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Send direct reminder on WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              disabled={!ledgerData || loading}
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Copy statement text"
            >
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* Customer Selector & Format Toggle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Customer Dropdown (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 relative">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Select Customer Shop / Retailer
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-300 hover:border-zinc-500 bg-zinc-50/50 text-left cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Building className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">
                      {selectedCustomerInfo?.shopName || "Choose a customer..."}
                    </p>
                    {selectedCustomerInfo && (
                      <p className="text-[11px] text-zinc-500 truncate">
                        {selectedCustomerInfo.city || "City N/A"} •{" "}
                        {selectedCustomerInfo.phoneNumber || "No Phone"}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 ml-2" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden max-h-80 flex flex-col">
                  <div className="p-2 border-b border-gray-100 bg-zinc-50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search shop name, city, phone..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-zinc-900 bg-white"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-4 text-center text-xs text-zinc-400">
                        No matching customers found
                      </p>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setIsDropdownOpen(false);
                            setCustomerSearch("");
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs hover:bg-zinc-50 flex items-center justify-between cursor-pointer transition-colors ${
                            selectedCustomerId === c.id
                              ? "bg-amber-500/10 font-bold text-zinc-950"
                              : "text-zinc-700"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="block font-bold text-zinc-900 truncate">
                              {c.shopName}
                            </span>
                            <span className="block text-[11px] text-zinc-500 truncate">
                              {c.city || "N/A"} • {c.phoneNumber || "No Phone"}
                              {c.gstPanNo ? ` • GST/PAN: ${c.gstPanNo}` : ""}
                            </span>
                          </div>
                          {selectedCustomerId === c.id && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Format Switcher (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 shadow-xs p-4 flex flex-col justify-between">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Ledger Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFormat("format1")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left flex flex-col justify-center cursor-pointer border ${
                    activeFormat === "format1"
                      ? "bg-zinc-950 text-white border-zinc-950 shadow-xs"
                      : "bg-zinc-50 text-zinc-700 border-gray-200 hover:bg-zinc-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Format 1 (Reminder)
                  </span>
                  <span className="text-[10px] font-normal opacity-80 mt-0.5 truncate">
                    Due & Partly Paid Bills Only
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFormat("format2")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left flex flex-col justify-center cursor-pointer border ${
                    activeFormat === "format2"
                      ? "bg-zinc-950 text-white border-zinc-950 shadow-xs"
                      : "bg-zinc-50 text-zinc-700 border-gray-200 hover:bg-zinc-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Format 2 (Full Ledger)
                  </span>
                  <span className="text-[10px] font-normal opacity-80 mt-0.5 truncate">
                    All Bills & Payments
                  </span>
                </button>
              </div>
            </div>

            {ledgerData && (
              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">
                  {activeFormat === "format1"
                    ? `${ledgerData.pendingBills.length} Pending Bills`
                    : `${ledgerData.ledgerTransactions.length} Total Entries`}
                </span>
                <span className="font-bold text-zinc-900">
                  Net Due:{" "}
                  <span className="text-rose-600 font-black">
                    {formatCurrency(ledgerData.summary.totalPendingAmount)}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          DOCUMENT PREVIEW & PRINT CANVAS (A4 PAPER SPEC)
          ═════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-zinc-800">
            Calculating customer ledger & pending balances...
          </p>
          <p className="text-xs text-zinc-400">
            Applying FIFO payment deductions & verifying invoice records
          </p>
        </div>
      ) : !ledgerData ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-zinc-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
          <p className="text-sm font-semibold text-zinc-600">
            Select a customer above to view and print their ledger
          </p>
        </div>
      ) : (
        <div className="flex justify-center print:block print:w-full print:m-0 print:p-0">
          {/* A4 Sheet Container */}
          <div
            className="printable-ledger-container bg-white w-full max-w-[210mm] shadow-lg print:shadow-none print:border-none border border-gray-300/80 rounded-xl print:rounded-none p-6 sm:p-10 font-sans text-black relative"
            style={{ minHeight: "297mm" }}
          >
            {/* ═════════════════════════════════════════════════════
                LETTERHEAD HEADER (KRISH CLOTHING CO.)
                ═════════════════════════════════════════════════════ */}
            <div className="text-center pb-4 border-b-2 border-black">
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider uppercase text-black font-serif">
                {ledgerData.company.name}
              </h1>
              <p className="text-[11px] text-zinc-700 font-medium leading-relaxed mt-1 max-w-xl mx-auto">
                {ledgerData.company.addressLine1}
                <br />
                {ledgerData.company.addressLine2}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-zinc-900 mt-1.5 pt-1.5 border-t border-zinc-200">
                <span>Phone: {ledgerData.company.phone}</span>
                {ledgerData.company.email && <span>Email: {ledgerData.company.email}</span>}
                {ledgerData.company.gstNo && <span>GSTIN: {ledgerData.company.gstNo}</span>}
                {ledgerData.company.panNo && <span>PAN: {ledgerData.company.panNo}</span>}
              </div>
            </div>

            {/* Document Title Ribbon */}
            <div className="my-3 py-1.5 bg-zinc-900 text-white print:bg-black text-center rounded-sm">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest">
                {activeFormat === "format1"
                  ? "STATEMENT OF PENDING & PARTLY PAID BILLS"
                  : "STATEMENT OF ACCOUNT / CUSTOMER LEDGER"}
              </h2>
            </div>

            {/* Customer & Issue Info Box */}
            <div className="grid grid-cols-2 gap-4 text-xs py-2 border-b border-zinc-300">
              {/* Left: Customer Info */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  M/s / Bill To:
                </span>
                <p className="text-sm font-black text-black">
                  {ledgerData.customer.shopName}
                </p>
                {ledgerData.customer.contactPerson && (
                  <p className="text-zinc-700 font-medium">
                    Attn: {ledgerData.customer.contactPerson}
                  </p>
                )}
                {ledgerData.customer.address && (
                  <p className="text-zinc-600">{ledgerData.customer.address}</p>
                )}
                <p className="text-zinc-700">
                  {ledgerData.customer.city || ""}
                  {ledgerData.customer.state ? `, ${ledgerData.customer.state}` : ""}
                </p>
                <div className="pt-0.5 space-y-0.5 text-[11px]">
                  {ledgerData.customer.phoneNumber && (
                    <p className="font-semibold text-zinc-800">
                      Mobile: {ledgerData.customer.phoneNumber}
                    </p>
                  )}
                  {ledgerData.customer.gstPanNo && (
                    <p className="font-semibold text-zinc-800">
                      GST / PAN: {ledgerData.customer.gstPanNo}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Statement Metadata */}
              <div className="text-right space-y-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Statement Date
                  </span>
                  <p className="font-bold text-black text-xs">
                    {formatDate(ledgerData.reportDate)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Credit Terms
                  </span>
                  <p className="font-bold text-black text-xs">
                    {ledgerData.customer.creditDays || 45} Days
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                    Total Pending Balance
                  </span>
                  <p className="text-base font-black text-rose-700">
                    {formatCurrency(ledgerData.summary.totalPendingAmount)}
                  </p>
                </div>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════
                FORMAT 1: DUE & PENDING BILLS ONLY
                (Exact Requirement: Only Show invoices that are partly
                paid & invoices that are not paid, with remainder left)
                ═════════════════════════════════════════════════════ */}
            {activeFormat === "format1" && (
              <div className="mt-3 space-y-3">
                {/* Formal Notice Box (Exact text requested by user) */}
                <div className="p-2.5 bg-amber-50 print:bg-zinc-50 border border-amber-300 print:border-zinc-400 rounded text-xs text-zinc-900 leading-relaxed">
                  <p className="font-bold text-zinc-950 mb-0.5">
                    Dear Sir / Madam,
                  </p>
                  <p>
                    Please note that the bills that are partly paid{" "}
                    <span className="font-semibold">
                      (Amount left after Deducting the amount received)
                    </span>{" "}
                    and not paid bills are shown below. Kindly arrange for the remittance of the pending balance at your earliest convenience.
                  </p>
                </div>

                {/* Pending Bills Table */}
                {ledgerData.pendingBills.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-emerald-300 rounded bg-emerald-50/50 my-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-emerald-900">
                      All Bills are Fully Paid!
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      There are no unpaid or partly paid bills for this customer at this time.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse border border-black">
                      <thead>
                        <tr className="bg-zinc-100 print:bg-zinc-200 border-b border-black font-bold text-black">
                          <th className="p-2 border-r border-black w-10 text-center">#</th>
                          <th className="p-2 border-r border-black">Bill Date</th>
                          <th className="p-2 border-r border-black">Bill / Invoice No.</th>
                          <th className="p-2 border-r border-black">Due Date</th>
                          <th className="p-2 border-r border-black text-right">Bill Total (₹)</th>
                          <th className="p-2 border-r border-black text-right">Amount Received (₹)</th>
                          <th className="p-2 text-right bg-zinc-200 print:bg-zinc-300 font-black">
                            Amount Left (₹)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.pendingBills.map((bill, idx) => {
                          const isPartly = bill.status === "PARTIALLY_PAID";
                          return (
                            <tr
                              key={bill.id}
                              className="border-b border-zinc-300 hover:bg-zinc-50"
                            >
                              <td className="p-2 border-r border-zinc-300 text-center font-medium">
                                {idx + 1}
                              </td>
                              <td className="p-2 border-r border-zinc-300 font-medium">
                                {formatDate(bill.billDate)}
                              </td>
                              <td className="p-2 border-r border-zinc-300 font-bold text-black">
                                Bill #{bill.billNo}
                              </td>
                              <td className="p-2 border-r border-zinc-300 font-medium">
                                {formatDate(bill.dueDate)}
                              </td>
                              <td className="p-2 border-r border-zinc-300 text-right text-zinc-700 font-medium">
                                {bill.totalAmount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="p-2 border-r border-zinc-300 text-right font-medium text-emerald-700">
                                {isPartly ? (
                                  `-${bill.paidAmount.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                ) : (
                                  <span className="text-zinc-400">0.00</span>
                                )}
                              </td>
                              <td className="p-2 text-right font-black text-black bg-zinc-50 print:bg-zinc-100">
                                {bill.pendingAmount.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Total Row */}
                        <tr className="bg-zinc-100 print:bg-zinc-200 border-t-2 border-black font-black text-black">
                          <td
                            colSpan={6}
                            className="p-2.5 border-r border-black text-right uppercase tracking-wider text-[11px]"
                          >
                            Total Pending Amount Due:
                          </td>
                          <td className="p-2.5 text-right text-sm font-black bg-zinc-200 print:bg-zinc-300">
                            {formatCurrency(ledgerData.summary.totalPendingAmount)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Amount in Words */}
                <div className="p-2 bg-zinc-50 border border-zinc-300 rounded text-xs flex items-center justify-between">
                  <span className="text-zinc-500 font-semibold uppercase text-[10px]">
                    Total in Words:
                  </span>
                  <span className="font-bold text-black">
                    {numberToIndianWords(ledgerData.summary.totalPendingAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════
                FORMAT 2: COMPLETE CHRONOLOGICAL STATEMENT
                (All Invoices, Payments, and Returns with running balance)
                ═════════════════════════════════════════════════════ */}
            {activeFormat === "format2" && (
              <div className="mt-3 space-y-3">
                {/* Financial Summary Strip */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs border border-black p-2 bg-zinc-50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Total Billed
                    </span>
                    <span className="font-bold text-black">
                      {formatCurrency(ledgerData.summary.totalBilled)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Payments Received
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(ledgerData.summary.totalPaid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Sales Returns
                    </span>
                    <span className="font-bold text-purple-700">
                      {formatCurrency(ledgerData.summary.totalReturns)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Net Balance Due
                    </span>
                    <span className="font-black text-rose-700">
                      {formatCurrency(ledgerData.summary.netOutstanding)}
                    </span>
                  </div>
                </div>

                {/* Ledger Transactions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-zinc-100 print:bg-zinc-200 border-b border-black font-bold text-black">
                        <th className="p-2 border-r border-black w-24">Date</th>
                        <th className="p-2 border-r border-black w-28">Doc / Ref No.</th>
                        <th className="p-2 border-r border-black">Particulars</th>
                        <th className="p-2 border-r border-black text-right w-24">Debit (₹)</th>
                        <th className="p-2 border-r border-black text-right w-24">Credit (₹)</th>
                        <th className="p-2 text-right w-28 bg-zinc-200 print:bg-zinc-300 font-black">
                          Balance (₹)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData.ledgerTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-zinc-400">
                            No ledger transactions recorded
                          </td>
                        </tr>
                      ) : (
                        ledgerData.ledgerTransactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className="border-b border-zinc-300 hover:bg-zinc-50"
                          >
                            <td className="p-2 border-r border-zinc-300 font-medium">
                              {formatDate(tx.date)}
                            </td>
                            <td className="p-2 border-r border-zinc-300 font-bold text-black">
                              {tx.docNo}
                            </td>
                            <td className="p-2 border-r border-zinc-300 text-zinc-700">
                              {tx.particulars}
                            </td>
                            <td className="p-2 border-r border-zinc-300 text-right font-semibold text-black">
                              {tx.debit > 0
                                ? tx.debit.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "—"}
                            </td>
                            <td className="p-2 border-r border-zinc-300 text-right font-semibold text-emerald-700">
                              {tx.credit > 0
                                ? tx.credit.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : "—"}
                            </td>
                            <td className="p-2 text-right font-black text-black bg-zinc-50 print:bg-zinc-100">
                              {tx.balance.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total Closing Balance Row */}
                      <tr className="bg-zinc-100 print:bg-zinc-200 border-t-2 border-black font-black text-black">
                        <td
                          colSpan={3}
                          className="p-2.5 border-r border-black text-right uppercase tracking-wider text-[11px]"
                        >
                          Closing Outstanding Balance:
                        </td>
                        <td className="p-2.5 border-r border-black text-right">
                          {formatCurrency(ledgerData.summary.totalBilled)}
                        </td>
                        <td className="p-2.5 border-r border-black text-right text-emerald-700">
                          {formatCurrency(ledgerData.summary.totalCredits)}
                        </td>
                        <td className="p-2.5 text-right text-sm font-black bg-zinc-200 print:bg-zinc-300">
                          {formatCurrency(ledgerData.summary.netOutstanding)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Words */}
                <div className="p-2 bg-zinc-50 border border-zinc-300 rounded text-xs flex items-center justify-between">
                  <span className="text-zinc-500 font-semibold uppercase text-[10px]">
                    Closing Balance in Words:
                  </span>
                  <span className="font-bold text-black">
                    {numberToIndianWords(ledgerData.summary.netOutstanding)}
                  </span>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════
                BANK REMITTANCE & PAYMENT DETAILS (ICICI BANK)
                ═════════════════════════════════════════════════════ */}
            <div className="mt-4 pt-3 border-t-2 border-black grid grid-cols-2 gap-4 text-xs">
              {/* Left: Bank Details */}
              <div className="border border-black p-2.5 rounded bg-zinc-50 print:bg-white space-y-1">
                <p className="font-bold text-black uppercase tracking-wider text-[10px] border-b border-zinc-300 pb-1">
                  Bank Remittance / NEFT / RTGS Details:
                </p>
                <div className="grid grid-cols-3 gap-1 text-[11px] pt-0.5">
                  <span className="text-zinc-600">Bank Name:</span>
                  <span className="col-span-2 font-bold text-black">
                    {ledgerData.bank.name}
                  </span>

                  <span className="text-zinc-600">Account No:</span>
                  <span className="col-span-2 font-black text-black tracking-wider">
                    {ledgerData.bank.accountNumber}
                  </span>

                  <span className="text-zinc-600">IFSC Code:</span>
                  <span className="col-span-2 font-bold text-black font-mono">
                    {ledgerData.bank.ifscCode}
                  </span>

                  <span className="text-zinc-600">Branch:</span>
                  <span className="col-span-2 text-zinc-800">
                    {ledgerData.bank.branch}
                  </span>

                  <span className="text-zinc-600">Beneficiary:</span>
                  <span className="col-span-2 font-bold text-black">
                    {ledgerData.bank.beneficiary}
                  </span>
                </div>
              </div>

              {/* Right: Signatory & Stamp */}
              <div className="border border-black p-2.5 rounded flex flex-col justify-between text-right bg-zinc-50 print:bg-white">
                <div>
                  <p className="font-bold text-black text-xs">
                    For, {ledgerData.company.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Authorized Signatory
                  </p>
                </div>
                <div className="pt-8">
                  <div className="border-t border-zinc-400 inline-block min-w-[140px] text-center pt-1">
                    <span className="text-[10px] font-semibold text-zinc-600 uppercase">
                      Authorised Signature
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note & Footer */}
            <div className="mt-3 pt-2 border-t border-zinc-300 text-[9px] text-zinc-500 text-center flex items-center justify-between">
              <span>This is a computer generated account statement. E.&.O.E.</span>
              <span>Generated on {formatDate(new Date())}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPrintLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-100/70 p-8 flex items-center justify-center">
          <div className="text-center space-y-2">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-zinc-700">Loading Customer Ledger...</p>
          </div>
        </div>
      }
    >
      <LedgerContent />
    </Suspense>
  );
}
