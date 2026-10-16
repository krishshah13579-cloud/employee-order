"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface SalesReturnItem {
  productName: string;
  color?: string;
  sizeRatio?: string;
  sets: number;
  pcsPerSet: number;
  totalPcs: number;
  unitPrice: number;
  amount: number;
  reason?: string;
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
  };
}

export default function AdminSalesReturnsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [returns, setReturns] = useState<SalesReturnRecord[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; shopName: string; city?: string; phoneNumber?: string }>>([]);

  // Modal: Create Return Invoice
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [returnOrderNumber, setReturnOrderNumber] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnGeneralReason, setReturnGeneralReason] = useState("Fabric Defect");
  const [returnNotes, setReturnNotes] = useState("");

  // Items in return form
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

  // Modal: View Return Invoice Details
  const [selectedReturn, setSelectedReturn] = useState<SalesReturnRecord | null>(null);

  // Load Sales Returns
  const loadReturns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/returns");
      if (!res.ok) throw new Error("Failed to load sales returns");
      const data = await res.json();
      setReturns(data);
    } catch (err: any) {
      toast(err.message || "Error loading sales returns", "error");
    } finally {
      setLoading(false);
    }
  };

  // Load Customers for dropdown
  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch {}
  };

  useEffect(() => {
    loadReturns();
    loadCustomers();
  }, []);

  // Recalculate row pcs and amount
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

  // Add Item Row
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

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (returnItems.length <= 1) return;
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  // Totals for the return form
  const formTotalSets = returnItems.reduce((s, it) => s + (parseInt(it.sets as any, 10) || 0), 0);
  const formTotalPcs = returnItems.reduce((s, it) => s + (parseInt(it.totalPcs as any, 10) || 0), 0);
  const formTotalAmount = returnItems.reduce((s, it) => s + (parseFloat(it.amount as any) || 0), 0);

  // Submit Create Return Invoice
  const handleCreateReturn = async (e: React.FormEvent) => {
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
      if (selectedReturn?.id === id) setSelectedReturn(null);
    } catch (err: any) {
      toast(err.message || "Failed to delete return invoice", "error");
    }
  };

  // Filtered returns
  const filteredReturns = returns.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.returnNumber.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      (r.orderNumber && r.orderNumber.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  const totalReturnAmountAll = returns.reduce((s, r) => s + r.totalAmount, 0);
  const totalReturnPcsAll = returns.reduce((s, r) => s + r.totalPcs, 0);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
            <RotateCcw size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Sales Return Invoices (Credit Notes)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter returned wholesale products. Credit amounts automatically deduct from customer outstanding balances.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/outstanding"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>Create Return Invoice</span>
          </button>
        </div>
      </div>

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
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold">Loading return invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No return invoices found. Click &quot;+ Create Return Invoice&quot; to enter returned products.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-purple-700 text-sm">
                      #{r.returnNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {formatDate(r.returnDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm uppercase">
                        {r.customerName}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase">
                        {r.customer?.city || "—"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {r.orderNumber ? `#${r.orderNumber}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                      {r.totalSets} Sets ({r.totalPcs} Pcs)
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
                        {r.reason || "Product Return"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-purple-700 text-sm whitespace-nowrap">
                      {formatCurrency(r.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedReturn(r)}
                          className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-black transition cursor-pointer shadow-2xs"
                          title="View Return Invoice"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReturn(r.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Return Invoice"
                        >
                          <Trash2 size={13} />
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

      {/* ═══════════════════════════════════════════
          CREATE RETURN INVOICE MODAL
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Sales Return Invoice (Credit Note)"
        size="xl"
      >
        <form onSubmit={handleCreateReturn} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Customer*
              </label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500 bg-white"
              >
                <option value="">-- Choose Retailer / Firm --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shopName.toUpperCase()} {c.city ? `(${c.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Return Date*
              </label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Original Order / Invoice # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. GO-261014-001"
                value={returnOrderNumber}
                onChange={(e) => setReturnOrderNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Returned Items Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Returned Products Breakdown
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <Plus size={13} />
                <span>Add Product</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Product Name*</th>
                    <th className="py-2 px-2">Color</th>
                    <th className="py-2 px-2 text-center w-16">Sets</th>
                    <th className="py-2 px-2 text-center w-16">Pcs/Set</th>
                    <th className="py-2 px-2 text-center w-16">Total Pcs</th>
                    <th className="py-2 px-2 text-right w-24">Rate/Pc (₹)</th>
                    <th className="py-2 px-3 text-right w-28">Amount (₹)</th>
                    <th className="py-2 px-1 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Denim Trouser / Formal"
                          value={item.productName}
                          onChange={(e) => handleUpdateItem(idx, "productName", e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="Color"
                          value={item.color}
                          onChange={(e) => handleUpdateItem(idx, "color", e.target.value)}
                          className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.sets}
                          onChange={(e) => handleUpdateItem(idx, "sets", e.target.value)}
                          className="w-16 px-1.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center font-bold"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.pcsPerSet}
                          onChange={(e) => handleUpdateItem(idx, "pcsPerSet", e.target.value)}
                          className="w-16 px-1.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center"
                        />
                      </td>

                      <td className="py-2 px-2 text-center font-bold font-mono text-purple-700">
                        {item.totalPcs}
                      </td>

                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(idx, "unitPrice", e.target.value)}
                          className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right font-mono font-bold"
                        />
                      </td>

                      <td className="py-2 px-3 text-right font-mono font-black text-purple-700">
                        {formatCurrency(item.amount)}
                      </td>

                      <td className="py-2 px-1 text-center">
                        {returnItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Totals */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
            <div className="text-xs text-purple-900 font-medium space-x-3">
              <span>Total Sets: <strong>{formTotalSets}</strong></span>
              <span>•</span>
              <span>Total Pieces: <strong>{formTotalPcs} PCS</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-950">Total Return Credit:</span>
              <span className="text-lg font-black font-mono text-purple-700">
                {formatCurrency(formTotalAmount)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Return
              </label>
              <select
                value={returnGeneralReason}
                onChange={(e) => setReturnGeneralReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500 bg-white"
              >
                <option value="Fabric Defect">Fabric Defect</option>
                <option value="Stitching / Tailoring Issue">Stitching / Tailoring Issue</option>
                <option value="Wrong Size Ratio Delivered">Wrong Size Ratio Delivered</option>
                <option value="Color Shade Mismatch">Color Shade Mismatch</option>
                <option value="Excess / Unsold Stock Return">Excess / Unsold Stock Return</option>
                <option value="Damaged in Transit">Damaged in Transit</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Additional Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Returned 1 bundle via cargo on 16/10"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingReturn}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={14} />
              <span>{savingReturn ? "Creating..." : "Save Return Invoice"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════
          VIEW RETURN INVOICE MODAL
          ═══════════════════════════════════════════ */}
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
                      items = JSON.parse(selectedReturn.items);
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
            <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="font-bold text-slate-700">Total Credit Deducted from Outstanding:</span>
              <span className="text-xl font-black font-mono text-purple-700">
                {formatCurrency(selectedReturn.totalAmount)}
              </span>
            </div>

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

            <div className="flex justify-end pt-2 border-t border-slate-100">
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
