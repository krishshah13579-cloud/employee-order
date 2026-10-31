"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  RotateCcw,
  Plus,
  Search,
  Eye,
  Trash2,
  Calendar,
  Building,
  Check,
  X,
  FileText,
  Printer,
  Receipt,
  ArrowRight,
  AlertCircle,
  Package,
  Lock,
  Tag,
  Percent,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface SalesReturnItem {
  productId?: number;
  productName: string;
  color?: string;
  sizeRatio?: string;
  sets: number;
  pcsPerSet: number;
  totalPcs: number;
  unitPrice: number;
  amount: number;
  reason?: string;
  isSinglePiece?: boolean;
}

interface SalesReturnRecord {
  id: number;
  returnNumber: string;
  customerId: number;
  customerName: string;
  orderId?: number | null;
  orderNumber?: string | null;
  returnDate: string | Date;
  totalAmount: number;
  totalPcs: number;
  totalSets: number;
  items: string; // JSON
  reason?: string | null;
  notes?: string | null;
  customer?: {
    shopName: string;
    city?: string | null;
    phoneNumber?: string | null;
    gstPanNo?: string | null;
    businessType?: string | null;
    specialDiscount?: number | null;
  };
}

interface ReturnBillItem {
  productId: number;
  productName: string;
  color: string;
  sizeRatio: string;
  pcsPerSet: number;
  sets: number;
  totalPcs: number;
  unitPrice: number;
  amount: number;
}

interface ReturnBill {
  id: number;
  orderNumber: string;
  taxInvoiceNumber?: string | null;
  displayBillNo: string;
  invoiceDate: string | Date;
  orderDate: string | Date;
  status: string;
  category: "WITH_GST" | "WITHOUT_GST" | "SPL_DISC_WITH_GST" | "SPL_DISC_WITHOUT_GST";
  isWithGst: boolean;
  isWithoutGst: boolean;
  hasSpecialDiscount: boolean;
  specialDiscount: number;
  customer: {
    id: number;
    shopName: string;
    gstPanNo: string;
    businessType: string;
    isWholesaler: boolean;
    city: string;
    phoneNumber?: string;
  };
  items: ReturnBillItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  totalSets: number;
  totalPcs: number;
}

export default function AdminSalesReturnsPage() {
  const { toast } = useToast();

  // Top Tabs: LIST vs WHOLE_BILL_RETURN
  const [topTab, setTopTab] = useState<"LIST" | "WHOLE_BILL">("LIST");

  // Sub Tabs for Whole Bill Return: 4 Categories
  const [billCategoryTab, setBillCategoryTab] = useState<
    "WITH_GST" | "WITHOUT_GST" | "SPL_DISC_WITH_GST" | "SPL_DISC_WITHOUT_GST" | "ALL"
  >("WITH_GST");

  const [loadingReturns, setLoadingReturns] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [billsSearchTerm, setBillsSearchTerm] = useState("");

  const [returns, setReturns] = useState<SalesReturnRecord[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; shopName: string; city?: string; phoneNumber?: string }>>([]);
  const [bills, setBills] = useState<ReturnBill[]>([]);
  const [billCounts, setBillCounts] = useState({
    WITH_GST: 0,
    WITHOUT_GST: 0,
    SPL_DISC_WITH_GST: 0,
    SPL_DISC_WITHOUT_GST: 0,
    ALL: 0,
  });

  // Modal 1: Ad-hoc / Manual Create Return
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [returnOrderNumber, setReturnOrderNumber] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnGeneralReason, setReturnGeneralReason] = useState("Fabric Defect");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnItems, setReturnItems] = useState<SalesReturnItem[]>([
    {
      productName: "",
      color: "Dark Grey",
      sizeRatio: "30 to 38",
      sets: 1,
      pcsPerSet: 5,
      totalPcs: 5,
      unitPrice: 490,
      amount: 2450,
      reason: "Fabric / Stitching Defect",
    },
  ]);

  // Modal 2: Whole Bill Return Confirmation
  const [wholeBillModalData, setWholeBillModalData] = useState<ReturnBill | null>(null);
  const [wholeBillReason, setWholeBillReason] = useState("Customer Whole Bill Return");
  const [wholeBillNotes, setWholeBillNotes] = useState("");

  // Modal 3: Single Piece & Partial Item Return
  const [partialBillModalData, setPartialBillModalData] = useState<ReturnBill | null>(null);
  const [partialItemSelections, setPartialItemSelections] = useState<
    Array<{
      itemIndex: number;
      selected: boolean;
      returnMode: "PCS" | "SETS";
      returnQty: number; // pcs or sets
      maxPcs: number;
      maxSets: number;
      pcsPerSet: number;
      totalReturnPcs: number;
      unitPrice: number;
      lineAmount: number;
      reason: string;
    }>
  >([]);
  const [partialGeneralReason, setPartialGeneralReason] = useState("Fabric / Quality Issue");
  const [partialNotes, setPartialNotes] = useState("");

  // Modal 4: View Return Invoice Details
  const [selectedReturn, setSelectedReturn] = useState<SalesReturnRecord | null>(null);

  // Load Sales Returns
  const loadReturns = async () => {
    try {
      setLoadingReturns(true);
      const res = await fetch("/api/admin/returns");
      if (!res.ok) throw new Error("Failed to load sales returns");
      const data = await res.json();
      setReturns(data);
    } catch (err: any) {
      toast(err.message || "Error loading sales returns", "error");
    } finally {
      setLoadingReturns(false);
    }
  };

  // Load Customers for manual dropdown
  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch {}
  };

  // Load Bills for Whole Bill & Partial Return
  const loadBills = async () => {
    try {
      setLoadingBills(true);
      const res = await fetch("/api/admin/returns/bills");
      if (!res.ok) throw new Error("Failed to load billed invoices");
      const data = await res.json();
      setBills(data.bills || []);
      if (data.counts) {
        setBillCounts(data.counts);
      }
    } catch (err: any) {
      toast(err.message || "Error loading return bills", "error");
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    loadReturns();
    loadCustomers();
    loadBills();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // WHOLE BILL RETURN HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleOpenWholeBillModal = (bill: ReturnBill) => {
    setWholeBillModalData(bill);
    setWholeBillReason("Full Bill Return");
    setWholeBillNotes("");
  };

  const handleConfirmWholeBillReturn = async () => {
    if (!wholeBillModalData) return;
    try {
      setSavingReturn(true);

      const itemsForPayload = wholeBillModalData.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        color: it.color,
        sizeRatio: it.sizeRatio,
        sets: it.sets,
        pcsPerSet: it.pcsPerSet,
        totalPcs: it.totalPcs,
        unitPrice: it.unitPrice,
        amount: it.amount,
        reason: wholeBillReason,
      }));

      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: wholeBillModalData.customer.id,
          orderId: wholeBillModalData.id,
          orderNumber: wholeBillModalData.displayBillNo || wholeBillModalData.orderNumber,
          returnDate: new Date().toISOString().split("T")[0],
          items: itemsForPayload,
          subtotal: wholeBillModalData.subtotal,
          gstRate: wholeBillModalData.gstRate,
          gstAmount: wholeBillModalData.gstAmount,
          totalAmount: wholeBillModalData.grandTotal,
          totalPcs: wholeBillModalData.totalPcs,
          totalSets: wholeBillModalData.totalSets,
          reason: wholeBillReason,
          notes: wholeBillNotes ? `Whole Bill Return - ${wholeBillNotes}` : "Whole Bill Return",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create whole bill return");

      toast(`✅ Whole Bill Return created successfully! Credit of ${formatCurrency(wholeBillModalData.grandTotal)} applied to ${wholeBillModalData.customer.shopName}.`, "success");
      setWholeBillModalData(null);
      loadReturns();
      loadBills();
      setTopTab("LIST");
    } catch (err: any) {
      toast(err.message || "Failed to execute whole bill return", "error");
    } finally {
      setSavingReturn(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PARTIAL & SINGLE-PIECE RETURN HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleOpenPartialReturnModal = (bill: ReturnBill) => {
    setPartialBillModalData(bill);
    setPartialGeneralReason("Partial Product / Single-Piece Return");
    setPartialNotes("");

    // Initialize item selections
    const initialSelections = bill.items.map((it, idx) => ({
      itemIndex: idx,
      selected: false,
      returnMode: "PCS" as const, // default to single pieces
      returnQty: 1, // default 1 pc
      maxPcs: it.totalPcs,
      maxSets: it.sets,
      pcsPerSet: it.pcsPerSet,
      totalReturnPcs: 1,
      unitPrice: it.unitPrice,
      lineAmount: Math.round(1 * it.unitPrice),
      reason: "Fabric / Defect Issue",
    }));
    setPartialItemSelections(initialSelections);
  };

  const handleToggleSelectItem = (idx: number) => {
    setPartialItemSelections((prev) =>
      prev.map((sel, i) => (i === idx ? { ...sel, selected: !sel.selected } : sel))
    );
  };

  const handleUpdatePartialQty = (
    idx: number,
    mode: "PCS" | "SETS",
    qty: number
  ) => {
    setPartialItemSelections((prev) =>
      prev.map((sel, i) => {
        if (i !== idx) return sel;
        const validQty = Math.max(1, qty);
        let totalPcs = 0;
        if (mode === "PCS") {
          totalPcs = Math.min(validQty, sel.maxPcs);
        } else {
          const sets = Math.min(validQty, sel.maxSets);
          totalPcs = sets * sel.pcsPerSet;
        }
        return {
          ...sel,
          returnMode: mode,
          returnQty: mode === "PCS" ? totalPcs : Math.min(validQty, sel.maxSets),
          totalReturnPcs: totalPcs,
          lineAmount: Math.round(totalPcs * sel.unitPrice),
        };
      })
    );
  };

  // Calculations for partial modal
  const partialSummary = useMemo(() => {
    if (!partialBillModalData) {
      return { totalPcs: 0, subtotal: 0, gstRate: 0, gstAmount: 0, grandTotal: 0, selectedCount: 0 };
    }
    const selectedRows = partialItemSelections.filter((s) => s.selected);
    const totalPcs = selectedRows.reduce((sum, s) => sum + s.totalReturnPcs, 0);
    const subtotal = selectedRows.reduce((sum, s) => sum + s.lineAmount, 0);
    const gstRate = partialBillModalData.isWithGst ? partialBillModalData.gstRate : 0;
    const gstAmount = gstRate > 0 ? Math.round(subtotal * (gstRate / 100)) : 0;
    const grandTotal = subtotal + gstAmount;

    return {
      totalPcs,
      subtotal,
      gstRate,
      gstAmount,
      grandTotal,
      selectedCount: selectedRows.length,
    };
  }, [partialBillModalData, partialItemSelections]);

  const handleConfirmPartialReturn = async () => {
    if (!partialBillModalData) return;
    const selectedRows = partialItemSelections.filter((s) => s.selected);
    if (selectedRows.length === 0) {
      toast("Please select at least 1 item or piece to return", "error");
      return;
    }
    if (partialSummary.grandTotal <= 0) {
      toast("Return credit amount must be greater than 0", "error");
      return;
    }

    try {
      setSavingReturn(true);

      const itemsForPayload: SalesReturnItem[] = selectedRows.map((s) => {
        const origItem = partialBillModalData.items[s.itemIndex];
        const setsCount = Math.floor(s.totalReturnPcs / (s.pcsPerSet || 5));
        return {
          productId: origItem.productId,
          productName: origItem.productName,
          color: origItem.color,
          sizeRatio: origItem.sizeRatio,
          sets: setsCount,
          pcsPerSet: s.pcsPerSet,
          totalPcs: s.totalReturnPcs,
          unitPrice: s.unitPrice,
          amount: s.lineAmount,
          reason: s.reason || partialGeneralReason,
          isSinglePiece: s.returnMode === "PCS",
        };
      });

      const totalSets = itemsForPayload.reduce((sum, it) => sum + it.sets, 0);

      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: partialBillModalData.customer.id,
          orderId: partialBillModalData.id,
          orderNumber: partialBillModalData.displayBillNo || partialBillModalData.orderNumber,
          returnDate: new Date().toISOString().split("T")[0],
          items: itemsForPayload,
          subtotal: partialSummary.subtotal,
          gstRate: partialSummary.gstRate,
          gstAmount: partialSummary.gstAmount,
          totalAmount: partialSummary.grandTotal,
          totalPcs: partialSummary.totalPcs,
          totalSets,
          reason: partialGeneralReason,
          notes: partialNotes ? `Partial Return - ${partialNotes}` : `Returned ${partialSummary.totalPcs} pcs from Bill #${partialBillModalData.displayBillNo}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create partial return");

      toast(`✅ Return credit of ${formatCurrency(partialSummary.grandTotal)} (${partialSummary.totalPcs} pcs) credited to ${partialBillModalData.customer.shopName}!`, "success");
      setPartialBillModalData(null);
      loadReturns();
      loadBills();
      setTopTab("LIST");
    } catch (err: any) {
      toast(err.message || "Failed to execute partial return", "error");
    } finally {
      setSavingReturn(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // AD-HOC MANUAL RETURN HANDLERS (Preserved)
  // ─────────────────────────────────────────────────────────────
  const handleUpdateItem = (index: number, field: keyof SalesReturnItem, val: any) => {
    const updated = [...returnItems];
    const row = { ...updated[index], [field]: val };

    if (field === "sets" || field === "pcsPerSet" || field === "unitPrice") {
      const sets = parseInt(row.sets as any, 10) || 0;
      const pcsPerSet = parseInt(row.pcsPerSet as any, 10) || 5;
      const unitPrice = parseFloat(row.unitPrice as any) || 0;
      row.totalPcs = sets * pcsPerSet;
      row.amount = Math.round(row.totalPcs * unitPrice);
    }

    updated[index] = row;
    setReturnItems(updated);
  };

  const handleAddItem = () => {
    setReturnItems([
      ...returnItems,
      {
        productName: "",
        color: "Navy Blue",
        sizeRatio: "30 to 38",
        sets: 1,
        pcsPerSet: 5,
        totalPcs: 5,
        unitPrice: 490,
        amount: 2450,
        reason: "Size Issue / Quality",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (returnItems.length <= 1) return;
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const formTotalSets = returnItems.reduce((s, it) => s + (parseInt(it.sets as any, 10) || 0), 0);
  const formTotalPcs = returnItems.reduce((s, it) => s + (parseInt(it.totalPcs as any, 10) || 0), 0);
  const formTotalAmount = returnItems.reduce((s, it) => s + (parseFloat(it.amount as any) || 0), 0);

  const handleCreateManualReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast("Please select a customer for the return invoice", "error");
      return;
    }

    if (returnItems.some((it) => !it.productName.trim())) {
      toast("Please enter product names for all returned items", "error");
      return;
    }

    if (formTotalAmount <= 0) {
      toast("Total return amount must be greater than 0", "error");
      return;
    }

    try {
      setSavingReturn(true);
      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          orderNumber: returnOrderNumber,
          returnDate,
          items: returnItems,
          subtotal: formTotalAmount,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: formTotalAmount,
          totalPcs: formTotalPcs,
          totalSets: formTotalSets,
          reason: returnGeneralReason,
          notes: returnNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create return invoice");

      toast("✅ Return invoice created! Credit automatically applied to customer ledger.", "success");
      setIsCreateModalOpen(false);
      loadReturns();
    } catch (err: any) {
      toast(err.message || "Failed to create return invoice", "error");
    } finally {
      setSavingReturn(false);
    }
  };

  // Delete Return Invoice
  const handleDeleteReturn = async (id: number) => {
    if (!confirm("Are you sure you want to delete this return invoice? Customer credit will be reversed.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/returns?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete return invoice");

      toast("Return invoice deleted", "success");
      loadReturns();
      loadBills();
      if (selectedReturn?.id === id) setSelectedReturn(null);
    } catch (err: any) {
      toast(err.message || "Failed to delete return invoice", "error");
    }
  };

  // Filtered Returns List
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.returnNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.orderNumber && r.orderNumber.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q))
      );
    });
  }, [returns, searchTerm]);

  // Filtered Bills for Whole Bill Tab
  const filteredBills = useMemo(() => {
    let list = bills;
    if (billCategoryTab !== "ALL") {
      list = list.filter((b) => b.category === billCategoryTab);
    }
    if (billsSearchTerm.trim()) {
      const q = billsSearchTerm.toLowerCase();
      list = list.filter(
        (b) =>
          b.displayBillNo.toLowerCase().includes(q) ||
          b.orderNumber.toLowerCase().includes(q) ||
          (b.taxInvoiceNumber && b.taxInvoiceNumber.toLowerCase().includes(q)) ||
          b.customer.shopName.toLowerCase().includes(q) ||
          b.customer.city.toLowerCase().includes(q) ||
          (b.customer.phoneNumber && b.customer.phoneNumber.includes(q))
      );
    }
    return list;
  }, [bills, billCategoryTab, billsSearchTerm]);

  const totalReturnAmountAll = returns.reduce((s, r) => s + r.totalAmount, 0);
  const totalReturnPcsAll = returns.reduce((s, r) => s + r.totalPcs, 0);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
            <RotateCcw size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Sales Returns &amp; Credit Notes
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Return whole bills or single pieces. Credits deduct directly from customer ledger balance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/employee/outstanding"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <Receipt size={14} className="text-orange-600" />
            <span>Outstanding Ledger</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setReturnItems([
                {
                  productName: "",
                  color: "Dark Grey",
                  sizeRatio: "30 to 38",
                  sets: 1,
                  pcsPerSet: 5,
                  totalPcs: 5,
                  unitPrice: 490,
                  amount: 2450,
                  reason: "Fabric / Stitching Defect",
                },
              ]);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>Manual Return</span>
          </button>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 w-fit">
        <button
          type="button"
          onClick={() => setTopTab("LIST")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            topTab === "LIST"
              ? "bg-white text-purple-700 shadow-xs border border-purple-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Receipt size={15} />
          <span>Return Invoices List</span>
          <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 text-[10px] rounded-full font-mono">
            {returns.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTopTab("WHOLE_BILL")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            topTab === "WHOLE_BILL"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Package size={15} />
          <span>Return Whole Bill / Invoice</span>
          <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
            topTab === "WHOLE_BILL" ? "bg-white text-purple-700 font-black" : "bg-slate-200 text-slate-700"
          }`}>
            {bills.length}
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: RETURN INVOICES LIST
          ═══════════════════════════════════════════════════════════ */}
      {topTab === "LIST" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-purple-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">
                  Total Returns Credited
                </span>
                <span className="text-2xl font-black text-purple-700 font-mono mt-1 block">
                  {formatCurrency(totalReturnAmountAll)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                  Deducted from customer accounts
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <RotateCcw size={24} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Total Returned Pieces
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {totalReturnPcsAll} PCS
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                  Physical inventory received back
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <FileText size={24} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Return Invoices Generated
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {returns.length} Invoices
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                  Credit note records on file
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Receipt size={24} />
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search return #, customer name, order #, reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-900">{filteredReturns.length}</strong> return invoices
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Return Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer Firm Name</th>
                    <th className="py-3 px-4">Order Ref</th>
                    <th className="py-3 px-4 text-center">Returned Qty</th>
                    <th className="py-3 px-4">Primary Reason</th>
                    <th className="py-3 px-4 text-right">Credit Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReturns ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                          <span>Loading sales return records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RotateCcw size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No Sales Return records found.</p>
                        <p className="text-[11px] mt-1 text-slate-400">
                          Use the &quot;Return Whole Bill / Invoice&quot; tab above to return an existing bill.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((r) => (
                      <tr key={r.id} className="hover:bg-purple-50/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            #{r.returnNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {formatDate(r.returnDate)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 uppercase">{r.customerName}</div>
                          <div className="text-[10px] text-slate-400">
                            {r.customer?.city || "—"} • {r.customer?.phoneNumber || "—"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {r.orderNumber ? (
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              #{r.orderNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-slate-800">
                            {r.totalPcs} PCS
                          </span>
                          {r.totalSets > 0 && (
                            <span className="text-[10px] text-slate-400 block">
                              ({r.totalSets} Sets)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-[150px]">
                          {r.reason || "General Return"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-purple-700 text-sm">
                          {formatCurrency(r.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedReturn(r)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                              title="View Invoice Details"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteReturn(r.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Return Invoice"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: RETURN WHOLE BILL / INVOICE (4 DEDICATED CATEGORIES)
          ═══════════════════════════════════════════════════════════ */}
      {topTab === "WHOLE_BILL" && (
        <div className="space-y-4">
          {/* 4 Separate Category Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Category 1: Customers With GST */}
              <button
                type="button"
                onClick={() => setBillCategoryTab("WITH_GST")}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billCategoryTab === "WITH_GST"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Customers With GST</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  billCategoryTab === "WITH_GST" ? "bg-white text-purple-700 font-black" : "bg-slate-200 text-slate-800"
                }`}>
                  {billCounts.WITH_GST}
                </span>
              </button>

              {/* Category 2: Customers (Without GST) */}
              <button
                type="button"
                onClick={() => setBillCategoryTab("WITHOUT_GST")}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billCategoryTab === "WITHOUT_GST"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>Customers (Without GST)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  billCategoryTab === "WITHOUT_GST" ? "bg-white text-purple-700 font-black" : "bg-slate-200 text-slate-800"
                }`}>
                  {billCounts.WITHOUT_GST}
                </span>
              </button>

              {/* Category 3: Special Discount (With GST) */}
              <button
                type="button"
                onClick={() => setBillCategoryTab("SPL_DISC_WITH_GST")}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billCategoryTab === "SPL_DISC_WITH_GST"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Tag size={13} />
                <span>Special Discount (With GST)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  billCategoryTab === "SPL_DISC_WITH_GST" ? "bg-white text-purple-700 font-black" : "bg-slate-200 text-slate-800"
                }`}>
                  {billCounts.SPL_DISC_WITH_GST}
                </span>
              </button>

              {/* Category 4: Special Discount (Without GST) */}
              <button
                type="button"
                onClick={() => setBillCategoryTab("SPL_DISC_WITHOUT_GST")}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billCategoryTab === "SPL_DISC_WITHOUT_GST"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <Tag size={13} />
                <span>Special Discount (Without GST)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  billCategoryTab === "SPL_DISC_WITHOUT_GST" ? "bg-white text-purple-700 font-black" : "bg-slate-200 text-slate-800"
                }`}>
                  {billCounts.SPL_DISC_WITHOUT_GST}
                </span>
              </button>

              {/* View All */}
              <button
                type="button"
                onClick={() => setBillCategoryTab("ALL")}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ml-auto ${
                  billCategoryTab === "ALL"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span>All Bills</span>
                <span className="text-[10px] font-mono">({billCounts.ALL})</span>
              </button>
            </div>
          </div>

          {/* Category Rule Information Banner */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-amber-400 shrink-0" />
              <div>
                {billCategoryTab === "WITH_GST" && (
                  <span>
                    <strong>Customers With GST:</strong> Retailer / Wholesaler Price locked. <strong>+5% GST is added</strong> into the return bill credit note.
                  </span>
                )}
                {billCategoryTab === "WITHOUT_GST" && (
                  <span>
                    <strong>Customers Without GST:</strong> Non-GST Price locked. <strong>No GST (0%)</strong> added into the return bill credit note.
                  </span>
                )}
                {billCategoryTab === "SPL_DISC_WITH_GST" && (
                  <span>
                    <strong>Special Discount (With GST):</strong> Retailer / Wholesaler Price minus Special Discount locked. <strong>+5% GST is added</strong> into the return bill credit note.
                  </span>
                )}
                {billCategoryTab === "SPL_DISC_WITHOUT_GST" && (
                  <span>
                    <strong>Special Discount (Without GST):</strong> Price minus Special Discount locked. <strong>No GST (0%)</strong> added into the return bill credit note.
                  </span>
                )}
                {billCategoryTab === "ALL" && (
                  <span>
                    <strong>All Bills View:</strong> Pricing is locked strictly per customer category. GST is calculated automatically based on invoice type.
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <span className="bg-white/10 px-2 py-0.5 rounded">1-Click Whole Bill Return</span>
              <span className="bg-white/10 px-2 py-0.5 rounded">Single-Piece (1 PC) Return</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Bill No., Invoice No., Customer Name, City..."
                value={billsSearchTerm}
                onChange={(e) => setBillsSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{filteredBills.length}</strong> available bills
            </div>
          </div>

          {/* Bills List Cards */}
          {loadingBills ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading customer bills...</span>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No bills found in this category.</p>
              <p className="text-[11px] mt-1 text-slate-400">
                Try selecting another customer category tab or clearing the search query.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBills.map((bill) => (
                <div
                  key={bill.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-purple-300 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Bill Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        Bill #{bill.displayBillNo}
                      </span>

                      {/* Category Badge */}
                      {bill.category === "WITH_GST" && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          GST Customer (+5% GST)
                        </span>
                      )}
                      {bill.category === "WITHOUT_GST" && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Without GST (0% GST)
                        </span>
                      )}
                      {bill.category === "SPL_DISC_WITH_GST" && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Spl Disc (With GST: +5%)
                        </span>
                      )}
                      {bill.category === "SPL_DISC_WITHOUT_GST" && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Spl Disc (Without GST)
                        </span>
                      )}

                      {/* Locked Price indicator */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <Lock size={10} />
                        <span>
                          {bill.customer.isWholesaler ? "Wholesaler Rate" : "Retailer Rate"} (Locked)
                          {bill.hasSpecialDiscount && bill.specialDiscount > 0 ? ` -₹${bill.specialDiscount}` : ""}
                        </span>
                      </span>

                      <span className="text-xs text-slate-400 font-medium">
                        {formatDate(bill.invoiceDate)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="font-black text-slate-900 text-sm uppercase">
                        {bill.customer.shopName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {bill.customer.city} • {bill.customer.gstPanNo || "UNREGISTERED"}
                      </div>
                    </div>

                    {/* Items pill list preview */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-600">
                      <span className="font-bold text-slate-700">
                        {bill.totalSets} Sets ({bill.totalPcs} Pcs):
                      </span>
                      {bill.items.slice(0, 4).map((it, idx) => (
                        <span key={idx} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium text-slate-700">
                          {it.productName} ({it.color}) • {it.totalPcs}p @ ₹{it.unitPrice}
                        </span>
                      ))}
                      {bill.items.length > 4 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          +{bill.items.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Amount & GST */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 border-slate-100 pt-3 lg:pt-0 shrink-0">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-right">
                        Invoice Total
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900 text-right">
                        {formatCurrency(bill.grandTotal)}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-medium text-right mt-0.5">
                      {bill.isWithGst ? (
                        <span className="text-blue-600 font-bold">
                          Subtotal: {formatCurrency(bill.subtotal)} + GST (5%): {formatCurrency(bill.gstAmount)}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-semibold">
                          Subtotal: {formatCurrency(bill.subtotal)} (No GST)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    {/* Return Whole Bill Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenWholeBillModal(bill)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      title="Return all items and pieces in this bill"
                    >
                      <RotateCcw size={14} />
                      <span>Return Whole Bill</span>
                    </button>

                    {/* Return Single Piece / Partial Items Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenPartialReturnModal(bill)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-300"
                      title="Return specific product, color or 1 piece"
                    >
                      <Package size={14} className="text-purple-600" />
                      <span>Return Single Piece / Items</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL 1: WHOLE BILL RETURN CONFIRMATION
          ═══════════════════════════════════════════════════════════ */}
      {wholeBillModalData && (
        <Modal
          isOpen={!!wholeBillModalData}
          onClose={() => setWholeBillModalData(null)}
          title={`Confirm Whole Bill Return: #${wholeBillModalData.displayBillNo}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Customer & Bill Meta */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                  Customer Firm:
                </span>
                <span className="font-black text-slate-900 text-base uppercase block">
                  {wholeBillModalData.customer.shopName}
                </span>
                <span className="text-slate-500 block">
                  {wholeBillModalData.customer.city} • {wholeBillModalData.customer.gstPanNo || "UNREGISTERED"}
                </span>
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-700">
                  <Lock size={10} />
                  <span>{wholeBillModalData.customer.businessType} Rate (Locked)</span>
                </span>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                  Original Invoice:
                </span>
                <span className="font-mono font-bold text-slate-900 block text-sm">
                  #{wholeBillModalData.displayBillNo}
                </span>
                <span className="text-slate-500 block">
                  Date: {formatDate(wholeBillModalData.invoiceDate)}
                </span>
                <span className="font-bold text-slate-700 block mt-1">
                  {wholeBillModalData.isWithGst ? "With 5% GST Included" : "Without GST (0%)"}
                </span>
              </div>
            </div>

            {/* Items Summary Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2.5">Product &amp; Color</th>
                    <th className="p-2.5 text-center">Ratio</th>
                    <th className="p-2.5 text-center">Sets</th>
                    <th className="p-2.5 text-center">PCS</th>
                    <th className="p-2.5 text-right">Locked Rate</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wholeBillModalData.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5">
                        <div className="font-bold text-slate-900">{it.productName}</div>
                        <div className="text-[10px] text-slate-500">Color: {it.color}</div>
                      </td>
                      <td className="p-2.5 text-center text-slate-600">{it.sizeRatio}</td>
                      <td className="p-2.5 text-center font-semibold">{it.sets}</td>
                      <td className="p-2.5 text-center font-bold text-purple-700">{it.totalPcs}</td>
                      <td className="p-2.5 text-right font-mono text-slate-700 font-semibold">
                        {formatCurrency(it.unitPrice)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-purple-700">
                        {formatCurrency(it.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Quantity Returned:</span>
                <span className="font-bold font-mono text-slate-900">
                  {wholeBillModalData.totalSets} Sets / {wholeBillModalData.totalPcs} PCS
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-bold font-mono text-slate-900">
                  {formatCurrency(wholeBillModalData.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  GST ({wholeBillModalData.isWithGst ? "5%" : "0% Non-GST"}):
                </span>
                <span className="font-bold font-mono text-slate-900">
                  {wholeBillModalData.isWithGst ? `+${formatCurrency(wholeBillModalData.gstAmount)}` : "₹0.00"}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-black text-slate-900">
                  Total Credit to Deduct from Outstanding:
                </span>
                <span className="text-xl font-black font-mono text-purple-700">
                  {formatCurrency(wholeBillModalData.grandTotal)}
                </span>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reason for Return
                </label>
                <select
                  value={wholeBillReason}
                  onChange={(e) => setWholeBillReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                >
                  <option value="Full Bill Return">Full Bill Return</option>
                  <option value="Fabric / Stitching Defect">Fabric / Stitching Defect</option>
                  <option value="Wrong Dispatch / Delivery Error">Wrong Dispatch / Delivery Error</option>
                  <option value="Quality Not Up To Standard">Quality Not Up To Standard</option>
                  <option value="Customer Cancellation">Customer Cancellation</option>
                  <option value="Payment Dispute / Order Reversed">Payment Dispute / Order Reversed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Returned via transport parcel #4812"
                  value={wholeBillNotes}
                  onChange={(e) => setWholeBillNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWholeBillModalData(null)}
                disabled={savingReturn}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWholeBillReturn}
                disabled={savingReturn}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingReturn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Return...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Confirm &amp; Return Whole Bill ({formatCurrency(wholeBillModalData.grandTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL 2: SINGLE-PIECE & PARTIAL ITEM RETURN
          ═══════════════════════════════════════════════════════════ */}
      {partialBillModalData && (
        <Modal
          isOpen={!!partialBillModalData}
          onClose={() => setPartialBillModalData(null)}
          title={`Return Particular Product / Single Piece: Bill #${partialBillModalData.displayBillNo}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div>
                <span className="font-black text-slate-900 uppercase">
                  {partialBillModalData.customer.shopName}
                </span>
                <span className="text-slate-500 ml-2">
                  ({partialBillModalData.customer.businessType} • Price Locked)
                </span>
              </div>
              <div className="font-mono text-purple-700 font-bold">
                Bill #{partialBillModalData.displayBillNo} • {partialBillModalData.isWithGst ? "+5% GST" : "0% GST (Non-GST)"}
              </div>
            </div>

            {/* Instruction */}
            <p className="text-xs text-slate-500">
              Select the checkbox for items to return. You can return down to a <strong>single piece (1 PC)</strong> or full sets. Per-piece rates are locked to the customer&apos;s invoice rate.
            </p>

            {/* Items selection table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2.5 w-10 text-center">Select</th>
                    <th className="p-2.5">Product &amp; Color</th>
                    <th className="p-2.5 text-center">Billed Qty</th>
                    <th className="p-2.5">Return Mode</th>
                    <th className="p-2.5 w-24">Return Qty</th>
                    <th className="p-2.5 text-right">Locked Rate</th>
                    <th className="p-2.5 text-right">Return Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partialItemSelections.map((sel, idx) => {
                    const item = partialBillModalData.items[sel.itemIndex];
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          sel.selected ? "bg-purple-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={sel.selected}
                            onChange={() => handleToggleSelectItem(idx)}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-500">
                            Color: <strong className="text-slate-700">{item.color}</strong> • {item.sizeRatio}
                          </div>
                        </td>
                        <td className="p-2.5 text-center text-slate-600">
                          {item.sets}s / {item.totalPcs}p
                        </td>
                        <td className="p-2.5">
                          <select
                            disabled={!sel.selected}
                            value={sel.returnMode}
                            onChange={(e) =>
                              handleUpdatePartialQty(idx, e.target.value as "PCS" | "SETS", 1)
                            }
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 disabled:opacity-40"
                          >
                            <option value="PCS">Single Pieces (PCS)</option>
                            <option value="SETS">Full Sets</option>
                          </select>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={sel.returnMode === "PCS" ? sel.maxPcs : sel.maxSets}
                              disabled={!sel.selected}
                              value={sel.returnQty}
                              onChange={(e) =>
                                handleUpdatePartialQty(
                                  idx,
                                  sel.returnMode,
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-purple-700 focus:outline-none focus:border-purple-500 disabled:opacity-40"
                            />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">
                              {sel.returnMode === "PCS" ? "PCS" : "SETS"}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                          {formatCurrency(sel.unitPrice)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-purple-700">
                          {sel.selected ? formatCurrency(sel.lineAmount) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Selected Items to Return:</span>
                <span className="font-bold text-slate-900">
                  {partialSummary.selectedCount} line(s) • {partialSummary.totalPcs} Total PCS
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-bold font-mono text-slate-900">
                  {formatCurrency(partialSummary.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  GST ({partialSummary.gstRate > 0 ? `${partialSummary.gstRate}%` : "0% Non-GST"}):
                </span>
                <span className="font-bold font-mono text-slate-900">
                  {partialSummary.gstRate > 0 ? `+${formatCurrency(partialSummary.gstAmount)}` : "₹0.00"}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-black text-slate-900">
                  Total Partial Credit to Deduct:
                </span>
                <span className="text-xl font-black font-mono text-purple-700">
                  {formatCurrency(partialSummary.grandTotal)}
                </span>
              </div>
            </div>

            {/* Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reason for Return
                </label>
                <select
                  value={partialGeneralReason}
                  onChange={(e) => setPartialGeneralReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                >
                  <option value="Fabric / Quality Issue">Fabric / Quality Issue</option>
                  <option value="Stitching / Measurement Defect">Stitching / Measurement Defect</option>
                  <option value="Wrong Color / Shade Difference">Wrong Color / Shade Difference</option>
                  <option value="Single Piece Damaged">Single Piece Damaged</option>
                  <option value="Size Alteration / Exchange">Size Alteration / Exchange</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notes / Remark (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 pc pocket stitching opened"
                  value={partialNotes}
                  onChange={(e) => setPartialNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPartialBillModalData(null)}
                disabled={savingReturn}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialReturn}
                disabled={savingReturn || partialSummary.grandTotal <= 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingReturn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Return...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Confirm Partial Return ({formatCurrency(partialSummary.grandTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL 3: AD-HOC MANUAL RETURN (PRESERVED)
          ═══════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Ad-Hoc Return Invoice"
        size="xl"
      >
        <form onSubmit={handleCreateManualReturn} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Customer Firm *
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shopName} {c.city ? `(${c.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Linked Order / Bill # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 02 or TI-2026-001"
                value={returnOrderNumber}
                onChange={(e) => setReturnOrderNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Return Date
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase">
                Returned Products &amp; Quantities
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Product Name</th>
                    <th className="p-2">Color</th>
                    <th className="p-2 w-16 text-center">Sets</th>
                    <th className="p-2 w-16 text-center">Pcs/Set</th>
                    <th className="p-2 w-16 text-center">Total Pcs</th>
                    <th className="p-2 w-20 text-right">Unit Rate</th>
                    <th className="p-2 w-24 text-right">Amount</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="e.g. IMP - 001"
                          value={item.productName}
                          onChange={(e) => handleUpdateItem(idx, "productName", e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="e.g. Dark Grey"
                          value={item.color}
                          onChange={(e) => handleUpdateItem(idx, "color", e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={item.sets}
                          onChange={(e) => handleUpdateItem(idx, "sets", e.target.value)}
                          className="w-14 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center font-bold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.pcsPerSet}
                          onChange={(e) => handleUpdateItem(idx, "pcsPerSet", e.target.value)}
                          className="w-14 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-center"
                        />
                      </td>
                      <td className="p-2 text-center font-bold text-purple-700 font-mono">
                        {item.totalPcs}
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(idx, "unitPrice", e.target.value)}
                          className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-purple-700">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="p-2 text-center">
                        {returnItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-between items-center p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs">
            <span className="font-bold text-slate-800">
              Total Credit: {formTotalSets} Sets ({formTotalPcs} PCS)
            </span>
            <span className="text-xl font-black font-mono text-purple-700">
              {formatCurrency(formTotalAmount)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Reason
              </label>
              <select
                value={returnGeneralReason}
                onChange={(e) => setReturnGeneralReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
              >
                <option value="Fabric Defect">Fabric Defect</option>
                <option value="Stitching / Measurement Defect">Stitching / Measurement Defect</option>
                <option value="Wrong Color / Shade Issue">Wrong Color / Shade Issue</option>
                <option value="Customer Return">Customer Return</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Notes
              </label>
              <input
                type="text"
                placeholder="Optional notes"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingReturn}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {savingReturn ? "Saving..." : "Create Return Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL 4: VIEW RETURN INVOICE DETAILS
          ═══════════════════════════════════════════════════════════ */}
      {selectedReturn && (
        <Modal
          isOpen={!!selectedReturn}
          onClose={() => setSelectedReturn(null)}
          title={`Return Invoice #${selectedReturn.returnNumber}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row justify-between gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                  Customer Firm:
                </span>
                <span className="font-black text-slate-900 text-sm uppercase block">
                  {selectedReturn.customerName}
                </span>
                <span className="text-slate-500 block">
                  {selectedReturn.customer?.city || "—"} • {selectedReturn.customer?.phoneNumber || "—"}
                </span>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
                  Return Invoice Meta:
                </span>
                <span className="font-mono font-bold text-slate-900 block">
                  Date: {formatDate(selectedReturn.returnDate)}
                </span>
                {selectedReturn.orderNumber && (
                  <span className="font-mono text-slate-500 block">
                    Ref Order: #{selectedReturn.orderNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Product &amp; Color</th>
                    <th className="p-2.5 text-center">Sets</th>
                    <th className="p-2.5 text-center">PCS</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    let items: SalesReturnItem[] = [];
                    try {
                      const parsed = JSON.parse(selectedReturn.items);
                      items = Array.isArray(parsed) ? parsed : (parsed?.items || []);
                    } catch {}
                    return items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{it.productName}</div>
                          {it.color && <div className="text-[10px] text-slate-500">Color: {it.color}</div>}
                        </td>
                        <td className="p-2.5 text-center font-semibold">{it.sets}</td>
                        <td className="p-2.5 text-center font-bold text-purple-700">{it.totalPcs}</td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-purple-700">
                          {formatCurrency(it.amount)}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            {(() => {
              let gstRate = 0;
              let gstAmount = 0;
              let subtotal = selectedReturn.totalAmount;
              try {
                const parsed = JSON.parse(selectedReturn.items);
                if (parsed && !Array.isArray(parsed)) {
                  gstRate = parsed.gstRate || 0;
                  gstAmount = parsed.gstAmount || 0;
                  subtotal = parsed.subtotal || selectedReturn.totalAmount;
                }
              } catch {}

              return (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  {gstRate > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-bold font-mono">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>GST ({gstRate}%):</span>
                        <span className="font-bold font-mono">+{formatCurrency(gstAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold text-slate-900">
                    <span>Total Credit Deducted from Outstanding:</span>
                    <span className="text-xl font-black font-mono text-purple-700">
                      {formatCurrency(selectedReturn.totalAmount)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {selectedReturn.reason && (
              <div className="text-xs text-slate-600">
                <strong>Reason:</strong> {selectedReturn.reason}
              </div>
            )}

            {selectedReturn.notes && (
              <div className="text-xs text-slate-500 italic">
                <strong>Notes:</strong> {selectedReturn.notes}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Credit Note</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
