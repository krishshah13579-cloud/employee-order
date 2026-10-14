"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilePlus,
  Users,
  Building,
  CreditCard,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  User,
  Printer,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  Search,
  X,
  Upload,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getColorHex } from "@/lib/colors";
import type { CustomerData, ColorSetEntry } from "@/lib/types";
import { useEmployee } from "@/components/providers/EmployeeProvider";

interface DraftOrderItem {
  productId: number;
  productName: string;
  category?: string;
  imageUrl?: string;
  colorSets: ColorSetEntry[];
  sizeRatio: string;
  sizesList?: string;
  pcsPerSet: number;
  totalSets: number;
  totalPcs: number;
  unitPrice: number;
  itemSubtotal: number;
  notes?: string;
}

interface ConfirmedOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerGstPan: string;
  grandTotal: number;
  totalPcs: number;
  totalSets: number;
  orderDate: string;
}

export default function OrderFormPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Employee Name
  const [placedBy, setPlacedBy] = useState<string>("");

  // Customers
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState<boolean>(false);

  // New Customer Modal
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [newShopName, setNewShopName] = useState<string>("");
  const [newGstPanNo, setNewGstPanNo] = useState<string>("");
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>("");
  const [newContactPerson, setNewContactPerson] = useState<string>("");
  const [newAddress, setNewAddress] = useState<string>("");
  const [newCity, setNewCity] = useState<string>("");
  const [newState, setNewState] = useState<string>("");
  const [newVisitingCardUrl, setNewVisitingCardUrl] = useState<string>("");
  const [uploadingCard, setUploadingCard] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingCustomer, setSavingCustomer] = useState<boolean>(false);

  // Order Items in Draft
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Confirmation state
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  // Authenticated employee
  const { employee } = useEmployee();

  // Load employee name from session or localStorage
  useEffect(() => {
    if (employee?.name) {
      setPlacedBy(employee.name);
      return;
    }
    try {
      const savedEmp = localStorage.getItem("garmentpro_employee_name");
      if (savedEmp) {
        setPlacedBy(savedEmp);
      }
    } catch {}
  }, [employee]);

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await fetch("/api/customers");
      if (res.ok) {
        const data: CustomerData[] = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Load active draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("garmentpro_order_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft) {
          if (draft.customerId) {
            setSelectedCustomerId(draft.customerId);
          }
          if (Array.isArray(draft.items)) {
            setItems(draft.items);
          }
          if (draft.notes) {
            setOrderNotes(draft.notes);
          }
          if (draft.placedBy && !placedBy) {
            setPlacedBy(draft.placedBy);
          }
        }
      }
    } catch (err) {
      console.error("Error reading order draft:", err);
    }
  }, []);

  // Sync draft back to localStorage whenever it changes
  const saveDraft = (
    updatedItems: DraftOrderItem[],
    customerId: number | null,
    notes: string,
    employee: string
  ) => {
    try {
      const cust = customers.find((c) => c.id === customerId);
      const draftObj = {
        customerId,
        customer: cust
          ? {
              id: cust.id,
              shopName: cust.shopName,
              gstPanNo: cust.gstPanNo,
              phoneNumber: cust.phoneNumber,
              contactPerson: cust.contactPerson,
              address: cust.address,
              city: cust.city,
              state: cust.state,
              visitingCardUrl: cust.visitingCardUrl,
            }
          : undefined,
        items: updatedItems,
        notes,
        placedBy: employee,
      };
      localStorage.setItem("garmentpro_order_draft", JSON.stringify(draftObj));
      window.dispatchEvent(new Event("garmentpro_draft_updated"));
    } catch (err) {
      console.error("Error saving draft to localStorage:", err);
    }
  };

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Filtered customer list for searchable dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const term = customerSearchQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.shopName.toLowerCase().includes(term) ||
        c.gstPanNo.toLowerCase().includes(term) ||
        c.phoneNumber.toLowerCase().includes(term) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(term))
    );
  }, [customers, customerSearchQuery]);

  // Handle customer selection
  const handleSelectCustomer = (c: CustomerData) => {
    setSelectedCustomerId(c.id);
    setCustomerDropdownOpen(false);
    setCustomerSearchQuery("");
    saveDraft(items, c.id, orderNotes, placedBy);
    toast(`Customer selected: ${c.shopName}`);
  };

  // Handle Remove Item
  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
    saveDraft(updated, selectedCustomerId, orderNotes, placedBy);
    toast("Item removed from order form");
  };

  // Handle Clear Entire Form / Draft
  const handleClearDraft = () => {
    if (confirm("Are you sure you want to clear this order form?")) {
      setItems([]);
      setSelectedCustomerId(null);
      setOrderNotes("");
      localStorage.removeItem("garmentpro_order_draft");
      window.dispatchEvent(new Event("garmentpro_draft_updated"));
      toast("Order form cleared");
    }
  };

  // Handle Visiting Card Photo Upload
  const handleVisitingCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCard(true);
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload visiting card");
      }

      const data = await res.json();
      setNewVisitingCardUrl(data.url);
      toast("Visiting card photo uploaded successfully!");
    } catch (err: any) {
      toast(err.message || "Failed to upload visiting card", "error");
    } finally {
      setUploadingCard(false);
    }
  };

  // Create New Customer inline
  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) {
      toast("Mandatory: Please enter Firm Name", "error");
      return;
    }
    if (!newGstPanNo.trim()) {
      toast("Mandatory: Please enter GST No. / PAN No.", "error");
      return;
    }
    if (!newPhoneNumber.trim()) {
      toast("Mandatory: Please enter Phone Number", "error");
      return;
    }
    if (!newAddress.trim()) {
      toast("Mandatory: Please enter Shop Address", "error");
      return;
    }
    if (!newCity.trim()) {
      toast("Mandatory: Please enter City", "error");
      return;
    }
    if (!newState.trim()) {
      toast("Mandatory: Please enter State", "error");
      return;
    }

    try {
      setSavingCustomer(true);
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmName: newShopName.trim(),
          shopName: newShopName.trim(),
          gstPanNo: newGstPanNo.trim().toUpperCase(),
          phoneNumber: newPhoneNumber.trim(),
          contactPerson: newContactPerson.trim() || undefined,
          address: newAddress.trim(),
          city: newCity.trim(),
          state: newState.trim(),
          visitingCardUrl: newVisitingCardUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create customer");
      }

      const created: CustomerData = await res.json();
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(created.id);
      setIsNewCustomerModalOpen(false);

      // Reset fields
      setNewShopName("");
      setNewGstPanNo("");
      setNewPhoneNumber("");
      setNewContactPerson("");
      setNewAddress("");
      setNewCity("");
      setNewState("");
      setNewVisitingCardUrl("");

      saveDraft(items, created.id, orderNotes, placedBy);
      toast(`Customer "${created.shopName}" added and selected!`);
    } catch (err: any) {
      toast(err.message || "Failed to create customer", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  // Mathematical Calculations (No GST, with Round Off)
  const totalSets = items.reduce((sum, it) => sum + (it.totalSets || 0), 0);
  const totalPcs = items.reduce((sum, it) => sum + (it.totalPcs || 0), 0);
  const subtotal = items.reduce((sum, it) => sum + (it.itemSubtotal || 0), 0);
  const roundOff = Math.round(subtotal) - subtotal;
  const grandTotal = Math.round(subtotal);
  const gstRate = 0;
  const gstAmount = 0;

  // Handle Order Submission
  const handleSubmitOrder = async () => {
    // 1. Mandatory Customer Selection Check
    if (!selectedCustomerId || !selectedCustomer) {
      toast("Mandatory: Please select a Customer / Shop Name with GST/PAN No.", "error");
      return;
    }

    // 2. Mandatory Items Check
    if (items.length === 0) {
      toast("Please add at least 1 product item to the order form", "error");
      return;
    }

    // 3. Mandatory Placed By Check
    const finalPlacedBy = (employee?.name || placedBy).trim();
    if (!finalPlacedBy) {
      toast("Mandatory: Please log in as an employee to place orders", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      localStorage.setItem("garmentpro_employee_name", finalPlacedBy);

      const payload = {
        customerId: selectedCustomerId,
        placedBy: finalPlacedBy,
        notes: orderNotes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          colorSets: it.colorSets,
          sizeRatio: it.sizeRatio,
          sizesList: it.sizesList,
          pcsPerSet: it.pcsPerSet,
          totalSets: it.totalSets,
          unitPrice: it.unitPrice,
          notes: it.notes,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to submit order (${res.status})`);
      }

      const result = await res.json();

      // Clear draft
      localStorage.removeItem("garmentpro_order_draft");
      window.dispatchEvent(new Event("garmentpro_draft_updated"));

      setConfirmedOrder({
        id: result.id,
        orderNumber: result.orderNumber,
        customerName: selectedCustomer.shopName,
        customerGstPan: selectedCustomer.gstPanNo,
        grandTotal: result.grandTotal || grandTotal,
        totalPcs: result.totalPcs || totalPcs,
        totalSets: result.totalSets || totalSets,
        orderDate: new Date().toISOString(),
      });

      toast(`Order #${result.orderNumber} placed successfully!`);
    } catch (err: any) {
      console.error("Order submission failed:", err);
      toast(err.message || "Failed to place order", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If order was confirmed, show Success Confirmation Screen
  if (confirmedOrder) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
        <UserHeader />
        <div className="max-w-2xl mx-auto px-4 pt-12 sm:pt-16">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
              <CheckCircle2 size={44} />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Order Booked Successfully
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                Wholesale Order Confirmed!
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-mono">
                Order #{confirmedOrder.orderNumber}
              </p>
            </div>

            {/* Order Brief Summary */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Shop Name:</span>
                <span className="font-bold text-slate-900">{confirmedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST / PAN No.:</span>
                <span className="font-mono font-bold text-slate-900">
                  {confirmedOrder.customerGstPan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Sets & Pieces:</span>
                <span className="font-bold text-slate-900">
                  {confirmedOrder.totalSets} Sets ({confirmedOrder.totalPcs} Pcs)
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-base">
                <span className="font-bold text-slate-900">Grand Total (Rounded):</span>
                <span className="font-black text-orange-600">
                  {formatCurrency(confirmedOrder.grandTotal)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                <span>Print Order Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setItems([]);
                  setSelectedCustomerId(null);
                  setOrderNotes("");
                }}
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <FilePlus size={16} />
                <span>+ Take Another Order</span>
              </button>

              <Link
                href={`/orders/${confirmedOrder.id}`}
                className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs border border-slate-300 transition flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                <span>Open in Order Page</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      <UserHeader />

      {/* Page Header */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link href="/" className="hover:text-white transition">
                Home
              </Link>
              <span>/</span>
              <span className="text-orange-400">Order Form</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Wholesale Order Form
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Select customer, add products with multiple colors, and review wholesale calculations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                <span>Clear Form</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ═══════════════════════════════════════════
            1. CUSTOMER SELECTION (MANDATORY)
            ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-orange-600" />
              <h2 className="text-base font-black text-slate-900">
                Customer Selection <span className="text-red-500 text-xs font-bold">(MANDATORY)</span>
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsNewCustomerModalOpen(true)}
              className="self-start sm:self-auto text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3.5 py-1.5 rounded-xl border border-orange-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:border-orange-300"
            >
              <Plus size={14} />
              <span>+ Add New Customer</span>
            </button>
          </div>

          {/* Searchable Customer Dropdown */}
          <div className="relative">
            <div
              onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
              className={`w-full p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                selectedCustomer
                  ? "bg-orange-50/40 border-orange-300 ring-1 ring-orange-400/30"
                  : "bg-white border-slate-300 hover:border-slate-400"
              }`}
            >
              {selectedCustomer ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                    {selectedCustomer.shopName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">
                      {selectedCustomer.shopName}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>
                        GST/PAN: <strong className="font-mono text-slate-900">{selectedCustomer.gstPanNo}</strong>
                      </span>
                      <span>•</span>
                      <span>Ph: {selectedCustomer.phoneNumber}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                  <Search size={16} className="text-slate-400" />
                  <span>Select existing customer or search by shop name, GST/PAN, phone...</span>
                </div>
              )}

              <ChevronDown
                size={18}
                className={`text-slate-400 transition-transform ${
                  customerDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </div>

            {/* Dropdown Menu */}
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-30 p-3 space-y-2 max-h-72 overflow-y-auto">
                {/* Search Input */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search customer by shop name or GST/PAN..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
                  />
                </div>

                {/* Customers list */}
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {loadingCustomers ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Loading customers...
                    </div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching customer found. Please verify the firm name, GST/PAN, or phone.
                    </div>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className={`p-2.5 rounded-xl cursor-pointer hover:bg-orange-50 transition flex items-center justify-between ${
                          selectedCustomerId === cust.id ? "bg-orange-50/70 font-bold" : ""
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {cust.shopName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            GST/PAN: {cust.gstPanNo} • Ph: {cust.phoneNumber}
                          </div>
                        </div>

                        {selectedCustomerId === cust.id && (
                          <span className="text-xs font-bold text-orange-600">✓ Selected</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer Metadata Card (when selected) */}
          {selectedCustomer && (
            <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-200/80 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 flex-1 w-full">
                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      FIRM NAME
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {selectedCustomer.shopName}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      GST NO. / PAN NO.
                    </span>
                    <span className="font-mono font-black text-orange-600 text-sm">
                      {selectedCustomer.gstPanNo}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      PHONE NUMBER
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedCustomer.phoneNumber}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      Contact PERSON NAME
                    </span>
                    <span className="font-semibold text-slate-800 text-xs">
                      {selectedCustomer.contactPerson || "—"}
                    </span>
                  </div>
                </div>

                {selectedCustomer.visitingCardUrl && (
                  <div className="shrink-0 flex flex-col items-center">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">
                      VISITING CARD
                    </span>
                    <a
                      href={selectedCustomer.visitingCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block w-16 h-12 rounded-lg overflow-hidden border border-orange-200 shadow-xs hover:ring-2 hover:ring-orange-500 transition"
                      title="Click to view visiting card full size"
                    >
                      <img
                        src={selectedCustomer.visitingCardUrl}
                        alt="Visiting Card"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                        View
                      </div>
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-orange-100">
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                    Shop Address
                  </span>
                  <span className="font-medium text-slate-800">
                    {selectedCustomer.address || "Address on File"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      CITY
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedCustomer.city || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider">
                      STATE
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedCustomer.state || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            2. ORDER FORM TABLE
            COLUMNS: Customer Name, GST/PAN No., Product Name, Colors, PCS, Price, Total Amount
            ═══════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          {/* Table Header toolbar */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Wholesale Product Items</span>
                <span className="text-xs font-bold text-slate-500">
                  ({items.length} {items.length === 1 ? "style" : "styles"} selected)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Formula: PCS = Total Sets × Pcs per Set (e.g. 5 sets × 5 pcs = 25 pcs).
              </p>
            </div>

            <Link
              href="/products?returnTo=/orders/new"
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus size={16} />
              <span>+ Add Product to Form</span>
            </Link>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">GST NO. / PAN NO.</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Colors & Sets</th>
                  <th className="py-3.5 px-4 text-center">PCS</th>
                  <th className="py-3.5 px-4 text-right">Price (₹/pc)</th>
                  <th className="py-3.5 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3">
                          <ShoppingBag size={28} />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">
                          No Products in Order Form Yet
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs">
                          Click &quot;+ Add Product to Form&quot; to browse products, open any product, and pick multiple colors and sets at once.
                        </p>
                        <Link
                          href="/products?returnTo=/orders/new"
                          className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          <span>+ Add Product Now</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const customerShop = selectedCustomer?.shopName || "Not Selected";
                    const customerGst = selectedCustomer?.gstPanNo || "—";

                    return (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Customer Name */}
                        <td className="py-4 px-4 font-bold text-slate-900 max-w-[150px] truncate">
                          {customerShop}
                        </td>

                        {/* 2. GST NO. / PAN NO. */}
                        <td className="py-4 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                          {customerGst}
                        </td>

                        {/* 3. Product Name */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            )}
                            <div>
                              <Link
                                href={`/products/${item.productId}?returnTo=/orders/new`}
                                className="font-black text-slate-900 hover:text-orange-600 transition"
                              >
                                {item.productName}
                              </Link>
                              <div className="text-[10px] text-slate-500">
                                Ratio: {item.sizeRatio} ({item.pcsPerSet || 5} pcs/set)
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 4. Colors */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.colorSets && item.colorSets.length > 0 ? (
                              item.colorSets.map((cs) => (
                                <span
                                  key={cs.color}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-800"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ backgroundColor: getColorHex(cs.color).hex }}
                                  />
                                  <span>{cs.color}:</span>
                                  <strong className="text-orange-600 font-bold">{cs.sets}s</strong>
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No colors</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">
                            Total Sets: {item.totalSets}
                          </span>
                        </td>

                        {/* 5. PCS */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-black text-slate-900 text-sm">
                            {item.totalPcs}
                          </span>
                          <span className="text-[10px] text-slate-500 block">Pcs</span>
                        </td>

                        {/* 6. Price */}
                        <td className="py-4 px-4 text-right font-medium text-slate-800">
                          {formatCurrency(item.unitPrice)}
                        </td>

                        {/* 7. Total Amount */}
                        <td className="py-4 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(item.itemSubtotal)}
                        </td>

                        {/* 8. Actions */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link
                              href={`/products/${item.productId}?returnTo=/orders/new`}
                              className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                              title="Edit colors and sets"
                            >
                              <Edit3 size={15} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Remove item"
                            >
                              <Trash2 size={15} />
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
        </section>

        {/* ═══════════════════════════════════════════
            3. ORDER DETAILS & SUMMARY (EMPLOYEE, NOTES, TOTALS, ROUNDED)
            ═══════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Employee credentials & Notes */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900">
              Employee & Order Details
            </h3>

            {/* Placed By (Locked to Logged-in Employee) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Booked By (Employee Name) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Lock size={10} />
                  <span>Logged In Staff (Locked)</span>
                </span>
              </div>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={employee?.name || placedBy || "Sales Representative"}
                  className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-bold cursor-not-allowed select-none"
                  title="Employee name is locked to the authenticated user."
                />
                <Lock size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Order Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Order Notes / Dispatch Instructions (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Any special packing instructions, transport details, delivery deadlines..."
                value={orderNotes}
                onChange={(e) => {
                  setOrderNotes(e.target.value);
                  saveDraft(items, selectedCustomerId, e.target.value, placedBy);
                }}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Right: Wholesale Grand Totals Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div>
              <h3 className="text-sm font-black text-slate-900 pb-3 border-b border-slate-100">
                Order Summary
              </h3>

              <div className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Ordered Sets:</span>
                  <span className="font-bold text-slate-900">{totalSets} Sets</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>Total Ordered Pieces (PCS):</span>
                  <span className="font-bold text-slate-900">{totalPcs} Pcs</span>
                </div>

                <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                  <span>Subtotal Amount:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                {Math.abs(roundOff) > 0.001 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round Off:</span>
                    <span className="font-bold font-mono">
                      {roundOff >= 0 ? `+${formatCurrency(roundOff)}` : `-${formatCurrency(Math.abs(roundOff))}`}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-3 border-t-2 border-slate-900 text-sm">
                  <span className="font-black text-slate-900 text-base">Grand Total (Rounded):</span>
                  <span className="font-black text-2xl text-orange-600">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              type="button"
              disabled={isSubmitting || items.length === 0 || !selectedCustomerId}
              onClick={handleSubmitOrder}
              className="w-full py-4 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base rounded-2xl shadow-xl shadow-orange-500/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
            >
              <FilePlus size={20} />
              <span>
                {isSubmitting
                  ? "Submitting Wholesale Order..."
                  : `Submit Order (${totalPcs} Pcs · ${formatCurrency(grandTotal)})`}
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* ═══════════════════════════════════════════
          NEW CUSTOMER MODAL
          ═══════════════════════════════════════════ */}
      <Modal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        title="Add New Customer"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsNewCustomerModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingCustomer || uploadingCard}
              onClick={handleCreateNewCustomer}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              {savingCustomer ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Customer...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Save Customer</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateNewCustomer} className="space-y-4 text-xs">
          {/* Top Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              All registered wholesale shop details and visiting card proofs are automatically verified and linked to order tax invoices.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. FIRM NAME */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                FIRM NAME <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Royal Fashion Retailers"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-semibold"
              />
            </div>

            {/* 2. GST NO. / PAN NO. */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                GST NO. / PAN NO. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 24AAAAA0000A1Z5 or AAACI1357Q"
                value={newGstPanNo}
                onChange={(e) => setNewGstPanNo(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl uppercase font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-bold text-orange-600"
              />
            </div>

            {/* 3. PHONE NUMBER */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                PHONE NUMBER <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 98250 13579"
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-semibold"
              />
            </div>

            {/* 4. Contact PERSON NAME */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                Contact PERSON NAME
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Bhai"
                value={newContactPerson}
                onChange={(e) => setNewContactPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-semibold"
              />
            </div>
          </div>

          {/* 5. Shop Address */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
              Shop Address <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Shop 12, Ground Floor, Textile Tower, Ring Road Market"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 6. CITY */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                CITY <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Surat"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-semibold"
              />
            </div>

            {/* 7. STATE */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 uppercase tracking-wider text-[11px]">
                STATE <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Gujarat"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-xs font-semibold"
              />
            </div>
          </div>

          {/* 8. VISITING CARD UPLOAD */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              VISITING CARD UPLOAD
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {newVisitingCardUrl ? (
                <div className="relative w-40 h-24 rounded-xl overflow-hidden border border-slate-300 bg-white shadow-xs shrink-0 group">
                  <img
                    src={newVisitingCardUrl}
                    alt="Visiting Card Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setNewVisitingCardUrl("")}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-lg shadow-sm hover:bg-red-700 transition"
                    title="Remove Photo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <div className="w-40 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white shrink-0">
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-semibold mt-1">No Card Photo</span>
                </div>
              )}

              <div className="flex-1 space-y-2 w-full">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleVisitingCardUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCard}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 shadow-xs transition cursor-pointer"
                >
                  {uploadingCard ? (
                    <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                  ) : (
                    <Upload className="w-4 h-4 text-orange-600" />
                  )}
                  <span>
                    {uploadingCard ? "Uploading..." : "Upload Visiting Card Photo"}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    OR URL:
                  </span>
                  <input
                    type="text"
                    value={newVisitingCardUrl}
                    onChange={(e) => setNewVisitingCardUrl(e.target.value)}
                    placeholder="https://example.com/card.jpg"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
