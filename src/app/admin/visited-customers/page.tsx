"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  MapPin,
  Search,
  Filter,
  Phone,
  User,
  Building2,
  Calendar,
  Eye,
  Trash2,
  Edit2,
  RefreshCw,
  ExternalLink,
  UserPlus,
  Loader2,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  AlertCircle,
} from "lucide-react";
import type { VisitedCustomerData } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface CityOption {
  name: string;
  count: number;
}

export default function AdminVisitedCustomersPage() {
  const { toast } = useToast();

  const [visitedCustomers, setVisitedCustomers] = useState<VisitedCustomerData[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [selectedExecutive, setSelectedExecutive] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Lightbox & Modals
  const [previewCardUrl, setPreviewCardUrl] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<VisitedCustomerData | null>(null);
  const [editCity, setEditCity] = useState<string>("");
  const [editShopName, setEditShopName] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("Visited");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Fetch Visited Customers
  const fetchVisitedCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCity && selectedCity !== "ALL") {
        params.append("city", selectedCity);
      }
      if (search.trim()) {
        params.append("search", search.trim());
      }

      const res = await fetch(`/api/visited-customers?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load visited customers");
      }

      const data = await res.json();
      setVisitedCustomers(data.visitedCustomers || []);
      if (Array.isArray(data.cities)) {
        setCities(data.cities);
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitedCustomers();
  }, [selectedCity]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVisitedCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Extract unique executives
  const uniqueExecutives = useMemo(() => {
    const execs = new Set<string>();
    visitedCustomers.forEach((item) => {
      if (item.employeeName) execs.add(item.employeeName);
    });
    return Array.from(execs).sort();
  }, [visitedCustomers]);

  // Client-side filtering for executive and status
  const filteredRecords = useMemo(() => {
    return visitedCustomers.filter((item) => {
      if (selectedExecutive !== "ALL" && item.employeeName !== selectedExecutive) {
        return false;
      }
      if (selectedStatus !== "ALL" && item.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [visitedCustomers, selectedExecutive, selectedStatus]);

  // Delete Handler
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this visited customer record?")) return;

    try {
      const res = await fetch(`/api/visited-customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Visited customer record deleted successfully", "success");
        fetchVisitedCustomers();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to delete record", "error");
      }
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    }
  };

  // Open Edit Modal
  const openEditModal = (item: VisitedCustomerData) => {
    setEditingItem(item);
    setEditCity(item.city || "");
    setEditShopName(item.shopName || "");
    setEditPhone(item.phone || "");
    setEditNotes(item.notes || "");
    setEditStatus(item.status || "Visited");
  };

  // Save Edit Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const cleanCity = editCity.trim().toUpperCase();
    if (!cleanCity) {
      toast("City name is mandatory and must be in CAPITAL ONLY.", "error");
      return;
    }

    try {
      setSavingEdit(true);
      const res = await fetch(`/api/visited-customers/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: cleanCity, // Enforced CAPITAL ONLY
          shopName: editShopName.trim() || null,
          phone: editPhone.trim() || null,
          notes: editNotes.trim() || null,
          status: editStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update record");
      }

      toast("Visited customer record updated successfully!", "success");
      setEditingItem(null);
      fetchVisitedCustomers();
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = visitedCustomers.length;
    const totalCities = cities.length;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = visitedCustomers.filter((item) =>
      item.createdAt.startsWith(today)
    ).length;
    const convertedCount = visitedCustomers.filter(
      (item) => item.status === "Converted"
    ).length;

    return { total, totalCities, todayCount, convertedCount };
  }, [visitedCustomers, cities]);

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <MapPin size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Visited Customers
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Field Visiting Cards &amp; Store Leads Collected by Sales Executives
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchVisitedCustomers}
            disabled={loading}
            className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 shadow-xs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-orange-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Stats Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Cards</span>
            <span className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <Eye size={16} />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {metrics.total}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Visiting cards uploaded</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-amber-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 uppercase tracking-wider">
            <span>Cities Covered</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <MapPin size={16} />
            </span>
          </div>
          <div className="text-3xl font-black text-amber-950 mt-2 font-mono">
            {metrics.totalCities}
          </div>
          <p className="text-[11px] text-amber-800/70 mt-1 font-medium">Unique cities visited</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-blue-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-blue-700 uppercase tracking-wider">
            <span>Today&apos;s Visits</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Clock size={16} />
            </span>
          </div>
          <div className="text-3xl font-black text-blue-950 mt-2 font-mono">
            {metrics.todayCount}
          </div>
          <p className="text-[11px] text-blue-800/70 mt-1 font-medium">Collected today</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-emerald-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <span>Converted</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-950 mt-2 font-mono">
            {metrics.convertedCount}
          </div>
          <p className="text-[11px] text-emerald-800/70 mt-1 font-medium">Active customers created</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          FILTER TOOLBAR: PROMINENT CITY FILTER DROPDOWN
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. PROMINENT CITY FILTER DROPDOWN */}
            <div className="flex items-center gap-2 bg-amber-50/80 border-2 border-amber-300 rounded-2xl px-3 py-1.5 shadow-xs">
              <MapPin size={16} className="text-amber-800 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-amber-900 tracking-wider">
                  Select City Filter:
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-transparent text-xs font-mono font-black text-slate-900 uppercase focus:outline-none cursor-pointer pr-4"
                >
                  <option value="ALL">ALL CITIES ({cities.reduce((acc, c) => acc + c.count, 0)})</option>
                  {cities.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. EXECUTIVE FILTER DROPDOWN */}
            {uniqueExecutives.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
                <User size={14} className="text-slate-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">
                    Executive:
                  </span>
                  <select
                    value={selectedExecutive}
                    onChange={(e) => setSelectedExecutive(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-3"
                  >
                    <option value="ALL">All Executives</option>
                    {uniqueExecutives.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 3. STATUS FILTER DROPDOWN */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
              <Filter size={14} className="text-slate-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">
                  Status:
                </span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-3"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Visited">Visited</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Converted">Converted</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. SEARCH INPUT */}
          <div className="relative w-full lg:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search shop, phone, city, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* City Filter Pills Bar */}
        {cities.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1 shrink-0">
              Quick Filter:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCity("ALL")}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition shrink-0 ${
                selectedCity === "ALL"
                  ? "bg-slate-950 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ALL ({cities.reduce((acc, c) => acc + c.count, 0)})
            </button>
            {cities.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedCity(c.name)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition shrink-0 uppercase ${
                  selectedCity === c.name
                    ? "bg-amber-400 text-amber-950 border border-amber-500 shadow-xs"
                    : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                {c.name} ({c.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Records Display */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-orange-600" />
            <h2 className="text-base font-black text-slate-900">
              Visited Customer Leads ({filteredRecords.length})
            </h2>
            {selectedCity !== "ALL" && (
              <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full text-xs font-mono font-black uppercase">
                City: {selectedCity}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Click on visiting card to inspect full resolution
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 size={28} className="animate-spin text-orange-500" />
            <span className="text-xs font-semibold">Loading visited customer records...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <MapPin size={40} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">No visited customer records found.</p>
            <p className="text-xs text-slate-400 mt-1">
              {selectedCity !== "ALL"
                ? `No records found for city "${selectedCity}". Try selecting All Cities.`
                : "Sales executives have not uploaded any visiting cards yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {filteredRecords.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Visiting Card Image Box */}
                  <div
                    className="relative h-48 bg-slate-950 cursor-pointer group overflow-hidden"
                    onClick={() => setPreviewCardUrl(item.visitingCardUrl)}
                    title="Click to view full visiting card"
                  >
                    <img
                      src={item.visitingCardUrl}
                      alt="Customer Visiting Card"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />

                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2">
                      <Eye size={18} />
                      <span>View Full Resolution</span>
                    </div>

                    {/* Prominent City Badge in CAPITAL */}
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 bg-amber-400 text-amber-950 font-black text-xs rounded-xl shadow-md border border-amber-500 tracking-wider uppercase font-mono">
                        {item.city}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs border ${
                          item.status === "Converted"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : item.status === "Follow Up"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-slate-900/80 backdrop-blur-sm text-white border-white/20"
                        }`}
                      >
                        {item.status || "Visited"}
                      </span>
                    </div>
                  </div>

                  {/* Card Details Body */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                        {item.shopName || "Walk-in Store / Lead"}
                      </h3>
                      {item.contactPerson && (
                        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mt-1">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span>{item.contactPerson}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      {item.phone && (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          <a
                            href={`tel:${item.phone}`}
                            className="text-orange-600 font-bold hover:underline"
                          >
                            {item.phone}
                          </a>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span>
                          Visited By: <strong className="text-slate-800">{item.employeeName || "Executive"}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Calendar size={12} className="shrink-0" />
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>

                      {item.notes && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 italic">
                          &ldquo;{item.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Convert to Customer button */}
                  <Link
                    href={`/admin/customers/new?shopName=${encodeURIComponent(
                      item.shopName || ""
                    )}&city=${encodeURIComponent(item.city)}&phone=${encodeURIComponent(
                      item.phone || ""
                    )}&visitingCardUrl=${encodeURIComponent(item.visitingCardUrl)}`}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    title="Convert to full Customer profile"
                  >
                    <UserPlus size={13} />
                    <span>Convert to Customer</span>
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition"
                      title="Edit Details"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Delete Record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full HD Visiting Card Lightbox Modal */}
      {previewCardUrl && (
        <Modal
          isOpen={!!previewCardUrl}
          onClose={() => setPreviewCardUrl(null)}
          title="Visiting Card Document"
          size="lg"
        >
          <div className="flex flex-col items-center p-2">
            <div className="w-full max-h-[75vh] flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden p-2">
              <img
                src={previewCardUrl}
                alt="Visiting Card HD Preview"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="mt-4 flex items-center justify-between w-full px-2 text-xs text-slate-500">
              <span>Customer visiting card collected during market visit</span>
              <a
                href={previewCardUrl}
                download="visiting-card.jpg"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Download size={13} />
                <span>Download Card</span>
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal with Mandatory CAPITAL City */}
      {editingItem && (
        <Modal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          title={`Edit Visited Customer #${editingItem.id}`}
        >
          <form onSubmit={handleSaveEdit} className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>City (CAPITAL ONLY) *</span>
                <span className="text-[10px] text-amber-700 font-bold uppercase">Uppercase Forced</span>
              </label>
              <input
                type="text"
                required
                value={editCity}
                onChange={(e) => setEditCity(e.target.value.toUpperCase())}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.toUpperCase();
                }}
                style={{ textTransform: "uppercase" }}
                className="w-full px-3 py-2 border-2 border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Shop / Firm Name
              </label>
              <input
                type="text"
                value={editShopName}
                onChange={(e) => setEditShopName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="Visited">Visited</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Converted">Converted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Visit Notes
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center gap-2"
              >
                {savingEdit && <Loader2 size={13} className="animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
