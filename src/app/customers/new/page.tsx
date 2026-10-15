"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  CreditCard,
  Phone,
  User,
  MapPin,
  Truck,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { useToast } from "@/components/ui/Toast";
import { compressImageFile } from "@/lib/imageCompression";
import { scanVisitingCard, type ExtractedCardData } from "@/lib/visitingCardOcr";

const INDIAN_STATES = [
  "Gujarat",
  "Maharashtra",
  "Rajasthan",
  "Delhi",
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Punjab",
  "Haryana",
  "Karnataka",
  "Tamil Nadu",
  "West Bengal",
  "Andhra Pradesh",
  "Telangana",
  "Bihar",
  "Kerala",
  "Odisha",
  "Jharkhand",
  "Chhattisgarh",
  "Uttarakhand",
  "Himachal Pradesh",
  "Assam",
  "Goa",
];

function CustomerRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/orders/new";
  const { toast } = useToast();

  // File input refs for mobile camera and gallery upload
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [shopName, setShopName] = useState("");
  const [gstPanNo, setGstPanNo] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Gujarat");
  const [transportName, setTransportName] = useState("");
  const [visitingCardUrl, setVisitingCardUrl] = useState("");

  // Tracking which fields were auto-filled by OCR
  const [autoFilledFields, setAutoFilledFields] = useState<Record<string, boolean>>({});

  // OCR and Processing State
  const [processingImage, setProcessingImage] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Handle Image Selection (from Camera or Gallery)
  const handleImageFile = async (file: File) => {
    try {
      setProcessingImage(true);
      setOcrProgress(5);
      setOcrStatus("Compressing visiting card photo...");

      // Compress client-side to high-res optimized Data URL
      const dataUrl = await compressImageFile(file, 1600, 1600, 0.85);
      setVisitingCardUrl(dataUrl);

      setOcrProgress(15);
      setOcrStatus("Loading AI OCR reader...");

      // Run client-side OCR extraction
      const extracted: ExtractedCardData = await scanVisitingCard(
        dataUrl,
        (progress, status) => {
          setOcrProgress(progress);
          setOcrStatus(status);
        }
      );

      setRawOcrText(extracted.rawText);

      // Auto-fill form fields and flag auto-filled status
      const filled: Record<string, boolean> = {};

      if (extracted.shopName) {
        setShopName(extracted.shopName);
        filled.shopName = true;
      }
      if (extracted.gstPanNo) {
        setGstPanNo(extracted.gstPanNo);
        filled.gstPanNo = true;
      }
      if (extracted.phoneNumber) {
        setPhoneNumber(extracted.phoneNumber);
        filled.phoneNumber = true;
      }
      if (extracted.contactPerson) {
        setContactPerson(extracted.contactPerson);
        filled.contactPerson = true;
      }
      if (extracted.address) {
        setAddress(extracted.address);
        filled.address = true;
      }
      if (extracted.city) {
        setCity(extracted.city);
        filled.city = true;
      }
      if (extracted.state) {
        setState(extracted.state);
        filled.state = true;
      }
      if (extracted.transportName) {
        setTransportName(extracted.transportName);
        filled.transportName = true;
      }

      setAutoFilledFields(filled);

      const fieldCount = Object.keys(filled).length;
      if (fieldCount > 0) {
        toast(`✨ Card scanned! ${fieldCount} fields auto-filled. Please verify below.`, "success");
      } else {
        toast("Card attached! Please enter details or inspect scanned text.");
      }
    } catch (err: any) {
      console.error("Visiting card OCR error:", err);
      toast("Photo attached! You can fill the details manually.");
    } finally {
      setProcessingImage(false);
      setOcrProgress(100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
    if (e.target) e.target.value = "";
  };

  // Re-run OCR on current visiting card
  const handleRescan = async () => {
    if (!visitingCardUrl) return;
    try {
      setProcessingImage(true);
      setOcrProgress(10);
      setOcrStatus("Re-scanning visiting card...");

      const extracted = await scanVisitingCard(visitingCardUrl, (p, s) => {
        setOcrProgress(p);
        setOcrStatus(s);
      });

      setRawOcrText(extracted.rawText);
      const filled: Record<string, boolean> = {};

      if (extracted.shopName) {
        setShopName(extracted.shopName);
        filled.shopName = true;
      }
      if (extracted.gstPanNo) {
        setGstPanNo(extracted.gstPanNo);
        filled.gstPanNo = true;
      }
      if (extracted.phoneNumber) {
        setPhoneNumber(extracted.phoneNumber);
        filled.phoneNumber = true;
      }
      if (extracted.contactPerson) {
        setContactPerson(extracted.contactPerson);
        filled.contactPerson = true;
      }
      if (extracted.address) {
        setAddress(extracted.address);
        filled.address = true;
      }
      if (extracted.city) {
        setCity(extracted.city);
        filled.city = true;
      }
      if (extracted.state) {
        setState(extracted.state);
        filled.state = true;
      }
      if (extracted.transportName) {
        setTransportName(extracted.transportName);
        filled.transportName = true;
      }

      setAutoFilledFields(filled);
      toast("Re-scan completed! Form updated.", "success");
    } catch (err: any) {
      toast("Re-scan failed: " + err.message, "error");
    } finally {
      setProcessingImage(false);
    }
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopName.trim()) {
      toast("Mandatory: Please enter Firm Name / Shop Name", "error");
      return;
    }
    if (!phoneNumber.trim()) {
      toast("Mandatory: Please enter Phone / Mobile Number", "error");
      return;
    }

    setSavingCustomer(true);

    try {
      const payload = {
        shopName: shopName.trim(),
        gstPanNo: gstPanNo.trim() || "N/A",
        phoneNumber: phoneNumber.trim(),
        contactPerson: contactPerson.trim() || undefined,
        address: address.trim() || "Direct Delivery",
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        visitingCardUrl: visitingCardUrl.trim() || undefined,
      };

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to register customer");
      }

      const newCustomer = await res.json();
      toast(`Customer "${newCustomer.shopName}" registered successfully!`, "success");

      // Auto-select in order form via localStorage and query param
      if (typeof window !== "undefined") {
        localStorage.setItem("garmentpro_selected_customer_id", String(newCustomer.id));
      }

      // Return to order flow
      const redirectUrl = returnTo.includes("?")
        ? `${returnTo}&customerId=${newCustomer.id}`
        : `${returnTo}?customerId=${newCustomer.id}`;

      router.push(redirectUrl);
    } catch (err: any) {
      console.error("Save customer error:", err);
      toast(err.message || "Failed to save customer", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <UserHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={returnTo}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-orange-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition shadow-xs"
          >
            <ArrowLeft size={16} />
            <span>Return to Order Form</span>
          </Link>
          <div className="text-xs font-semibold text-slate-400">
            GarmentPro Customer Management
          </div>
        </div>

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider border border-orange-500/30">
                <Sparkles size={14} />
                <span>AI Visiting Card Scanner</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Register New Wholesale Customer
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Take a photo or upload the client’s visiting card. All details (Firm Name, GST/PAN, Phone, Address, City) are automatically detected and populated without manual error.
              </p>
            </div>
            <div className="hidden lg:flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/15 text-orange-400 shrink-0">
              <Users size={32} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ═══════════════════════════════════════════
                LEFT COLUMN: VISITING CARD PHOTO & SCANNER (5 Cols)
                ═══════════════════════════════════════════ */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={18} className="text-orange-600" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      Visiting Card Photo
                    </h2>
                  </div>
                  {visitingCardUrl && (
                    <button
                      type="button"
                      onClick={handleRescan}
                      disabled={processingImage}
                      className="text-[11px] font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={12} className={processingImage ? "animate-spin" : ""} />
                      <span>Re-scan</span>
                    </button>
                  )}
                </div>

                {/* Card Preview or Empty Placeholder */}
                {visitingCardUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-xs group">
                    <img
                      src={visitingCardUrl}
                      alt="Visiting Card Preview"
                      className="w-full max-h-72 object-contain bg-slate-900"
                    />
                    <div className="p-3 bg-slate-900/90 text-white flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span className="font-semibold text-[11px]">Visiting Card Attached</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVisitingCardUrl("");
                          setAutoFilledFields({});
                          setRawOcrText("");
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-6 sm:p-8 text-center transition">
                    <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                      <Camera size={26} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Capture or Upload Visiting Card
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Use your phone camera or select a card image from gallery to auto-fill customer details.
                    </p>
                  </div>
                )}

                {/* Processing Progress Bar */}
                {processingImage && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-orange-900">
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-orange-600" />
                        <span>{ocrStatus || "Reading visiting card..."}</span>
                      </div>
                      <span>{ocrProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-orange-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Hidden File Inputs for Camera and Gallery */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleInputChange}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*,image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={handleInputChange}
                  className="hidden"
                />

                {/* Action Buttons for Mobile Camera & Gallery */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={processingImage}
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-orange-600/20 transition cursor-pointer"
                  >
                    <Camera size={16} />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    disabled={processingImage}
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Upload size={16} />
                    <span>Upload Card</span>
                  </button>
                </div>

                {/* Raw OCR Inspection Drawer */}
                {rawOcrText && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="w-full p-2.5 bg-slate-100 hover:bg-slate-200 flex items-center justify-between text-slate-700 font-bold transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 text-[11px]">
                        {showRawText ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showRawText ? "Hide Detected Card Text" : "Inspect Detected Card Text"}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {rawOcrText.length} chars
                      </span>
                    </button>
                    {showRawText && (
                      <div className="p-3 bg-white max-h-48 overflow-y-auto font-mono text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed border-t border-slate-200">
                        {rawOcrText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════
                RIGHT COLUMN: VERIFIED CUSTOMER DETAILS (7 Cols)
                ═══════════════════════════════════════════ */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-orange-600" />
                    <h2 className="text-base font-black text-slate-900">
                      Wholesale Customer Details
                    </h2>
                  </div>
                  <span className="text-[11px] text-red-500 font-bold">
                    * Mandatory Fields
                  </span>
                </div>

                {/* Field 1: Firm Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span>Firm Name / Shop Name</span>
                      <span className="text-red-500">*</span>
                    </label>
                    {autoFilledFields.shopName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <Check size={10} /> Auto-filled from card
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. SHREE RAM CLOTH STORE / V-MART"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-xs"
                  />
                </div>

                {/* Field 2 & 3: GST/PAN No and Phone Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <CreditCard size={14} className="text-slate-500" />
                        <span>GST / PAN No.</span>
                        <span className="text-red-500">*</span>
                      </label>
                      {autoFilledFields.gstPanNo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Check size={10} /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={gstPanNo}
                      onChange={(e) => setGstPanNo(e.target.value.toUpperCase())}
                      placeholder="e.g. 24ABCDE1234F1Z5 or PAN"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition uppercase shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-500" />
                        <span>Phone / Mobile No.</span>
                        <span className="text-red-500">*</span>
                      </label>
                      {autoFilledFields.phoneNumber && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Check size={10} /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 9825123456"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs"
                    />
                  </div>
                </div>

                {/* Field 4: Contact Person */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <User size={14} className="text-slate-500" />
                      <span>Contact Person / Proprietor</span>
                    </label>
                    {autoFilledFields.contactPerson && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <Check size={10} /> Auto-filled
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Kumar (Proprietor)"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs"
                  />
                </div>

                {/* Field 5: Store Address */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-500" />
                      <span>Shop / Delivery Address</span>
                      <span className="text-red-500">*</span>
                    </label>
                    {autoFilledFields.address && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <Check size={10} /> Auto-filled
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Shop No. 42, New Textile Market, Ring Road"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs"
                  />
                </div>

                {/* Field 6 & 7: City & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                        City <span className="text-red-500">*</span>
                      </label>
                      {autoFilledFields.city && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Check size={10} /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Surat / Mumbai"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                        State <span className="text-red-500">*</span>
                      </label>
                      {autoFilledFields.state && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Check size={10} /> Auto-filled
                        </span>
                      )}
                    </div>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Field 8: Preferred Transport */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Truck size={14} className="text-slate-500" />
                      <span>Preferred Transport (Optional)</span>
                    </label>
                    {autoFilledFields.transportName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <Check size={10} /> Auto-filled
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={transportName}
                    onChange={(e) => setTransportName(e.target.value)}
                    placeholder="e.g. V-Trans, Navata Road Transport, Shree Ram Transport"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs"
                  />
                </div>

                {/* Submit Actions */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <Link
                    href={returnTo}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition text-center"
                  >
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={savingCustomer || processingImage}
                    className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {savingCustomer ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Customer...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Save & Select Customer for Order →</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function CustomerRegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CustomerRegistrationContent />
    </Suspense>
  );
}
