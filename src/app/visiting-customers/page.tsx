"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Camera,
  Upload,
  MapPin,
  Building2,
  Phone,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Eye,
  Trash2,
  RefreshCw,
  Clock,
  ArrowRight,
  ExternalLink,
  Search,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { useToast } from "@/components/ui/Toast";
import { compressImageFile } from "@/lib/imageCompression";
import { scanVisitingCard } from "@/lib/visitingCardOcr";
import { Modal } from "@/components/ui/Modal";
import type { VisitedCustomerData } from "@/lib/types";

export default function VisitingCustomerPage() {
  const { employee } = useEmployee();
  const { toast } = useToast();

  // File input refs for mobile camera and gallery upload
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [visitingCardUrl, setVisitingCardUrl] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [shopName, setShopName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // UI state
  const [uploading, setUploading] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // My uploaded visited customers list
  const [myVisitedCustomers, setMyVisitedCustomers] = useState<VisitedCustomerData[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [searchHistory, setSearchHistory] = useState<string>("");

  // Load employee's submitted visited cards
  const loadMyVisitedCards = async () => {
    try {
      setLoadingList(true);
      const res = await fetch("/api/visited-customers");
      if (res.ok) {
        const data = await res.json();
        setMyVisitedCustomers(data.visitedCustomers || []);
      }
    } catch (err: any) {
      console.error("Failed to load visited customers:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadMyVisitedCards();
  }, []);

  // Handle direct file selection from mobile camera or gallery
  const handleFileProcess = async (file: File) => {
    try {
      setUploading(true);
      setOcrStatus("");

      // 1. Compress image to avoid large base64 or upload failure
      const compressedDataUrl = await compressImageFile(file, 1600, 1600, 0.85);
      setVisitingCardUrl(compressedDataUrl);
      toast("Visiting card photo attached!", "success");

      // 2. Try uploading file to backend /api/upload for permanent URL, or keep data URL as fallback
      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData?.url) {
            setVisitingCardUrl(uploadData.url);
          }
        }
      } catch {
        // Fallback to data URL already set
      }

      // 3. Optional automatic smart OCR extraction to help employee
      try {
        setScanning(true);
        setOcrStatus("Scanning visiting card details...");
        const extracted = await scanVisitingCard(compressedDataUrl);

        if (extracted) {
          if (!shopName && extracted.shopName) setShopName(extracted.shopName);
          if (!phone && extracted.phoneNumber) setPhone(extracted.phoneNumber);
          if (!contactPerson && extracted.contactPerson) setContactPerson(extracted.contactPerson);
          if (!city && extracted.city) {
            // Strictly CAPITAL ONLY
            setCity(extracted.city.trim().toUpperCase());
          }
          toast("Visiting card scanned! Review & confirm city in CAPITAL.", "info");
        }
      } catch (ocrErr) {
        // Silent catch for OCR: employee can manually enter details
      } finally {
        setScanning(false);
        setOcrStatus("");
      }
    } catch (err: any) {
      console.error("Error processing visiting card:", err);
      toast("Failed to process image: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!visitingCardUrl) {
      toast("Please upload or capture the customer's visiting card photo.", "error");
      return;
    }

    const cleanCity = city.trim().toUpperCase();
    if (!cleanCity) {
      toast("City name is mandatory and must be entered in CAPITAL ONLY.", "error");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        visitingCardUrl,
        city: cleanCity, // Strictly CAPITAL ONLY
        shopName: shopName.trim() || undefined,
        phone: phone.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/visited-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit visited customer");
      }

      toast("✅ Visiting customer saved successfully with city in CAPITAL!", "success");

      // Reset Form
      setVisitingCardUrl("");
      setCity("");
      setShopName("");
      setPhone("");
      setContactPerson("");
      setNotes("");

      // Refresh list
      loadMyVisitedCards();
    } catch (err: any) {
      toast("Error: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter history
  const filteredHistory = myVisitedCustomers.filter((item) => {
    if (!searchHistory.trim()) return true;
    const q = searchHistory.toLowerCase();
    return (
      item.city.toLowerCase().includes(q) ||
      (item.shopName && item.shopName.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page Top Title Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <MapPin size={22} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Visiting Customer
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Direct Visiting Card Upload &amp; City Tagging for Store Visits
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-100 px-3.5 py-2 rounded-2xl text-xs font-semibold text-slate-700 flex items-center gap-2">
              <User size={14} className="text-orange-500" />
              <span>
                Executive: <strong className="text-slate-900">{employee?.name || "Staff"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Main Upload Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-orange-50/50 via-white to-amber-50/30">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>Upload Customer Visiting Card &amp; City</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Snap a clear photo of the client&apos;s visiting card in the market and enter the city in capital letters.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            {/* Hidden native file inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileProcess(file);
                e.target.value = "";
              }}
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileProcess(file);
                e.target.value = "";
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT 6 COLS: DIRECT VISITING CARD UPLOAD */}
              <div className="lg:col-span-6 space-y-4">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Customer Visiting Card Photo <span className="text-red-500">*</span>
                </label>

                {visitingCardUrl ? (
                  /* Attached Card Preview */
                  <div className="relative group rounded-3xl overflow-hidden border-2 border-orange-400 bg-slate-950 shadow-md">
                    <img
                      src={visitingCardUrl}
                      alt="Customer Visiting Card"
                      className="w-full h-64 object-contain bg-slate-900"
                    />

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-4">
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(visitingCardUrl)}
                        className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg hover:bg-slate-100 transition"
                      >
                        <Eye size={14} />
                        <span>Preview HD</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg hover:bg-orange-500 transition"
                      >
                        <Camera size={14} />
                        <span>Retake</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisitingCardUrl("")}
                        className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg hover:bg-red-500 transition"
                        title="Remove Card"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 size={13} />
                        <span>Visiting Card Attached</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setVisitingCardUrl("")}
                        className="text-red-400 hover:text-red-300 font-bold underline"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Direct Upload Buttons Box */
                  <div className="border-2 border-dashed border-slate-300 rounded-3xl p-6 sm:p-8 text-center bg-slate-50/50 hover:bg-orange-50/30 transition-colors">
                    <div className="w-16 h-16 rounded-3xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                      {uploading ? (
                        <Loader2 size={28} className="animate-spin" />
                      ) : (
                        <Camera size={28} />
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-800">
                      Capture or Upload Visiting Card Directly
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Use your mobile camera to take an instant snap of the visiting card or select from your gallery.
                    </p>

                    {ocrStatus && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-orange-600">
                        <Loader2 size={14} className="animate-spin" />
                        <span>{ocrStatus}</span>
                      </div>
                    )}

                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:from-orange-500 hover:to-amber-500 transition cursor-pointer"
                      >
                        <Camera size={16} />
                        <span>Take Photo (Camera)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full sm:w-auto px-5 py-3 bg-white text-slate-800 border border-slate-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Upload size={16} className="text-slate-600" />
                        <span>Upload from Gallery</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT 6 COLS: MANDATORY CAPITAL CITY & OPTIONAL DETAILS */}
              <div className="lg:col-span-6 space-y-5">
                {/* 1. CITY NAME (MANDATORY IN CAPITAL ONLY) */}
                <div className="bg-amber-50/70 p-5 rounded-3xl border-2 border-amber-300">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                      <MapPin size={15} className="text-amber-700" />
                      <span>City Name (CAPITAL ONLY)</span>
                      <span className="text-red-600 font-bold">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                      MANDATORY
                    </span>
                  </div>

                  <input
                    type="text"
                    required
                    autoCapitalize="characters"
                    placeholder="E.G. SURAT, AHMEDABAD, MUMBAI, JAIPUR"
                    value={city}
                    onChange={(e) => setCity(e.target.value.toUpperCase())}
                    onInput={(e) => {
                      e.currentTarget.value = e.currentTarget.value.toUpperCase();
                    }}
                    style={{ textTransform: "uppercase" }}
                    className="w-full px-4 py-3.5 bg-white border-2 border-amber-400 rounded-2xl text-sm font-mono font-black text-slate-950 placeholder:text-slate-400 placeholder:font-normal uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-amber-200 transition"
                  />
                  <p className="text-[11px] font-semibold text-amber-900 mt-2 flex items-center gap-1">
                    <span>⚠️ Note: City input is strictly forced and recorded in CAPITAL ONLY.</span>
                  </p>
                </div>

                {/* 2. OPTIONAL QUICK FIELDS */}
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Shop Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400" />
                        <span>Shop / Firm Name (Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Navrang Fashion"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400" />
                        <span>Contact Number (Optional)</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 98250 12345"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Contact Person */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      <span>Contact Person Name (Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajeshbhai"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Visit Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <FileText size={13} className="text-slate-400" />
                      <span>Discussion / Visit Notes (Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Interested in Formal & Casual Trousers 30-38 set. Follow up next Monday."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    className="w-full py-4 px-6 bg-slate-950 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-orange-400" />
                        <span>Saving Visiting Customer...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        <span>Save Visiting Customer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* My Visited Customer Submissions History */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock size={18} className="text-orange-600" />
                <span>My Visited Customers ({myVisitedCustomers.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cards and field visits recorded by you. Also visible in the Admin Panel Visited Customer section.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search city, shop..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <button
                type="button"
                onClick={loadMyVisitedCards}
                disabled={loadingList}
                className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 transition"
                title="Refresh history"
              >
                <RefreshCw size={14} className={loadingList ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="p-6">
            {loadingList ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={24} className="animate-spin text-orange-500" />
                <span className="text-xs font-semibold">Loading your visited cards...</span>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No visited customer cards recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Upload your first visiting card and city above to start tracking field leads!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                  >
                    {/* Visiting Card Thumbnail */}
                    <div
                      className="relative h-44 bg-slate-900 cursor-pointer group overflow-hidden"
                      onClick={() => setLightboxUrl(item.visitingCardUrl)}
                      title="Click to view full visiting card"
                    >
                      <img
                        src={item.visitingCardUrl}
                        alt="Visiting Card"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                        <Eye size={16} />
                        <span>View Full Card</span>
                      </div>

                      {/* City Badge (Strictly UPPERCASE) */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2.5 py-1 bg-amber-400 text-amber-950 font-black text-[11px] rounded-lg shadow-sm border border-amber-500 tracking-wider uppercase font-mono">
                          {item.city}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-sm text-white font-bold text-[10px] rounded-full border border-white/20">
                          {item.status || "Visited"}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {item.shopName || "Walk-in Lead"}
                        </h4>

                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {item.contactPerson && (
                            <div className="flex items-center gap-1.5">
                              <User size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{item.contactPerson}</span>
                            </div>
                          )}

                          {item.phone && (
                            <div className="flex items-center gap-1.5 font-medium">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <a
                                href={`tel:${item.phone}`}
                                className="text-orange-600 hover:underline"
                              >
                                {item.phone}
                              </a>
                            </div>
                          )}

                          {item.notes && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 italic">
                              &ldquo;{item.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {new Date(item.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(item.visitingCardUrl)}
                          className="font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
                        >
                          <span>Card</span>
                          <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full HD Visiting Card Lightbox Modal */}
      {lightboxUrl && (
        <Modal
          isOpen={!!lightboxUrl}
          onClose={() => setLightboxUrl(null)}
          title="Visiting Card Preview"
          size="lg"
        >
          <div className="flex flex-col items-center p-2">
            <div className="w-full max-h-[75vh] flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden p-2">
              <img
                src={lightboxUrl}
                alt="Visiting Card HD Preview"
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="mt-4 flex items-center justify-between w-full px-2 text-xs text-slate-500">
              <span>Customer visiting card collected on field</span>
              <a
                href={lightboxUrl}
                download="visiting-card.jpg"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <span>Download Card</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
