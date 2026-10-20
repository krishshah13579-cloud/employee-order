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
  Plus,
  Trash2,
  Clock,
  Tag,
} from "lucide-react";
import { UserHeader } from "@/components/user/UserHeader";
import { useToast } from "@/components/ui/Toast";
import { compressImageFile } from "@/lib/imageCompression";
import { scanVisitingCard, type ExtractedCardData } from "@/lib/visitingCardOcr";
import { useEmployee } from "@/components/providers/EmployeeProvider";
import { isEmployeeTeamLeader } from "@/lib/time";

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
  const { employee } = useEmployee();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const isTL = isEmployeeTeamLeader(employee);
  const canSetSpecialDiscount = isAdmin || isTL;

  // File input refs for mobile camera and gallery upload
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [shopName, setShopName] = useState("");
  const [gstPanNo, setGstPanNo] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [additionalContacts, setAdditionalContacts] = useState<
    { name: string; phone: string; designation: string }[]
  >([]);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Gujarat");
  const [transportName, setTransportName] = useState("");
  const [visitingCardUrl, setVisitingCardUrl] = useState("");
  const [businessType, setBusinessType] = useState<
    "RETAILER" | "WHOLESALER" | "WHOLESALER WITHOUT GST" | "RETAILER WITH SPECIAL DISCOUNT"
  >("RETAILER");
  const [specialDiscount, setSpecialDiscount] = useState<number | "">(50);
  const [creditDays, setCreditDays] = useState<number | "">(0);

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
        setShopName(extracted.shopName.toUpperCase());
        filled.shopName = true;
      }
      if (extracted.gstPanNo) {
        setGstPanNo(extracted.gstPanNo.toUpperCase());
        filled.gstPanNo = true;
      }
      if (extracted.phoneNumber) {
        setPhoneNumber(extracted.phoneNumber);
        filled.phoneNumber = true;
      }
      if (extracted.contactPerson) {
        setContactPerson(extracted.contactPerson.toUpperCase());
        filled.contactPerson = true;
      }
      if (extracted.address) {
        setAddress(extracted.address.toUpperCase());
        filled.address = true;
      }
      if (extracted.city) {
        setCity(extracted.city.toUpperCase());
        filled.city = true;
      }
      if (extracted.state) {
        setState(extracted.state);
        filled.state = true;
      }
      if (extracted.transportName) {
        setTransportName(extracted.transportName.toUpperCase());
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
        setShopName(extracted.shopName.toUpperCase());
        filled.shopName = true;
      }
      if (extracted.gstPanNo) {
        setGstPanNo(extracted.gstPanNo.toUpperCase());
        filled.gstPanNo = true;
      }
      if (extracted.phoneNumber) {
        setPhoneNumber(extracted.phoneNumber);
        filled.phoneNumber = true;
      }
      if (extracted.contactPerson) {
        setContactPerson(extracted.contactPerson.toUpperCase());
        filled.contactPerson = true;
      }
      if (extracted.address) {
        setAddress(extracted.address.toUpperCase());
        filled.address = true;
      }
      if (extracted.city) {
        setCity(extracted.city.toUpperCase());
        filled.city = true;
      }
      if (extracted.state) {
        setState(extracted.state);
        filled.state = true;
      }
      if (extracted.transportName) {
        setTransportName(extracted.transportName.toUpperCase());
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
    const isWholesaleNoGst = businessType === "WHOLESALER WITHOUT GST";

    if (!isWholesaleNoGst && (!gstPanNo.trim() || gstPanNo.trim().toUpperCase() === "N/A")) {
      toast("Mandatory: Please enter valid GST No. or PAN No.", "error");
      return;
    }
    if (!phoneNumber.trim()) {
      toast("Mandatory: Please enter Phone / Mobile Number", "error");
      return;
    }
    if (!businessType) {
      toast("Mandatory: Please select Type of Business", "error");
      return;
    }
    if (!address.trim()) {
      toast("Mandatory: Please enter Shop / Delivery Address", "error");
      return;
    }
    if (!city.trim()) {
      toast("Mandatory: Please enter City", "error");
      return;
    }
    if (!state.trim()) {
      toast("Mandatory: Please select State", "error");
      return;
    }

    setSavingCustomer(true);

    try {
      const allContacts = [
        ...(contactPerson.trim()
          ? [{ name: contactPerson.trim().toUpperCase(), phone: phoneNumber.trim(), designation: "PRIMARY CONTACT" }]
          : []),
        ...additionalContacts
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim().toUpperCase(),
            phone: c.phone.trim(),
            designation: c.designation.trim().toUpperCase() || "STAFF",
          })),
      ];

      const finalGst = isWholesaleNoGst && (!gstPanNo.trim() || gstPanNo.trim().toUpperCase() === "N/A")
        ? "URP"
        : gstPanNo.trim().toUpperCase();

      const payload = {
        shopName: shopName.trim().toUpperCase(),
        gstPanNo: finalGst,
        businessType: businessType,
        specialDiscount: businessType === "RETAILER WITH SPECIAL DISCOUNT" ? (Number(specialDiscount) || 0) : 0,
        creditDays: Number(creditDays) || 0,
        phoneNumber: phoneNumber.trim(),
        contactPerson: contactPerson.trim().toUpperCase() || undefined,
        contactPersons: allContacts.length > 0 ? allContacts : undefined,
        address: (address.trim() || "DIRECT DELIVERY").toUpperCase(),
        city: (city.trim() || "").toUpperCase() || undefined,
        state: (state.trim() || "").toUpperCase() || undefined,
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
                      <div className="p-3 bg-white max-h-64 overflow-y-auto space-y-3 border-t border-slate-200">
                        <div className="text-[10px] text-slate-500 font-semibold">
                          Detected card lines (tap buttons to quickly assign to form):
                        </div>
                        <div className="space-y-1.5">
                          {rawOcrText
                            .split(/\r?\n/)
                            .map((l) => l.trim())
                            .filter((l) => l.length > 1)
                            .map((line, idx) => (
                              <div
                                key={idx}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-orange-50/50 hover:border-orange-200 transition"
                              >
                                <span className="font-mono text-[11px] text-slate-800 break-all font-semibold">
                                  {line}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShopName(line.toUpperCase());
                                      setAutoFilledFields((prev) => ({ ...prev, shopName: true }));
                                      toast(`Set "${line.toUpperCase()}" as Firm Name`, "success");
                                    }}
                                    className="px-2 py-0.5 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-600 rounded text-[10px] font-bold cursor-pointer transition"
                                  >
                                    Firm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setContactPerson(line.toUpperCase());
                                      setAutoFilledFields((prev) => ({ ...prev, contactPerson: true }));
                                      toast(`Set "${line.toUpperCase()}" as Contact Person`, "success");
                                    }}
                                    className="px-2 py-0.5 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-600 rounded text-[10px] font-bold cursor-pointer transition"
                                  >
                                    Person
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddress((prev) => (prev ? `${prev}, ${line.toUpperCase()}` : line.toUpperCase()));
                                      setAutoFilledFields((prev) => ({ ...prev, address: true }));
                                      toast(`Added to Address`, "success");
                                    }}
                                    className="px-2 py-0.5 bg-white border border-slate-300 hover:border-orange-500 hover:text-orange-600 rounded text-[10px] font-bold cursor-pointer transition"
                                  >
                                    +Addr
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
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

                {/* Mandatory Business Type: Retailer, Wholesaler, or Retailer with Special Discount (T.L. / Admin only) */}
                <div className="space-y-2 p-4 bg-slate-50/90 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span>Type of Business</span>
                      <span className="text-red-500 font-bold">* (Mandatory)</span>
                    </label>
                  </div>

                  <div className={`grid grid-cols-1 ${isAdmin ? "sm:grid-cols-4" : isTL ? "sm:grid-cols-3" : "sm:grid-cols-1"} gap-3`}>
                    {/* Retailer: Available to all */}
                    <button
                      type="button"
                      onClick={() => setBusinessType("RETAILER")}
                      className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                        businessType === "RETAILER"
                          ? "border-blue-600 bg-blue-50/90 text-blue-950 shadow-xs ring-1 ring-blue-500"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-black text-sm text-blue-900">Retailer</div>
                      {businessType === "RETAILER" && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                      )}
                    </button>

                    {/* Wholesale: ONLY available to Team Leader (T.L.) or Admin */}
                    {(isTL || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => setBusinessType("WHOLESALER")}
                        className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                          businessType === "WHOLESALER"
                            ? "border-purple-600 bg-purple-50/90 text-purple-950 shadow-xs ring-1 ring-purple-500"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="font-black text-sm text-purple-900">Wholesale</div>
                          <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                            {isTL ? "Team Leader (T.L.)" : "Admin Authorized"}
                          </div>
                        </div>
                        {businessType === "WHOLESALER" && (
                          <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                        )}
                      </button>
                    )}

                    {/* Retailer with Special Discount: ONLY shown to Team Leader (T.L.) or Admin */}
                    {canSetSpecialDiscount && (
                      <button
                        type="button"
                        onClick={() => setBusinessType("RETAILER WITH SPECIAL DISCOUNT")}
                        className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                          businessType === "RETAILER WITH SPECIAL DISCOUNT"
                            ? "border-emerald-600 bg-emerald-50/90 text-emerald-950 shadow-xs ring-1 ring-emerald-500"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="font-black text-sm text-emerald-950">Retailer (Spl Disc)</div>
                          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                            {isTL ? "Team Leader (T.L.)" : "Admin Only"}
                          </div>
                        </div>
                        {businessType === "RETAILER WITH SPECIAL DISCOUNT" && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    )}

                    {/* Wholesale Without GST: ONLY available to Admin */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setBusinessType("WHOLESALER WITHOUT GST")}
                        className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                          businessType === "WHOLESALER WITHOUT GST"
                            ? "border-fuchsia-600 bg-fuchsia-50/90 text-fuchsia-950 shadow-xs ring-1 ring-fuchsia-500"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="font-black text-sm text-fuchsia-950">Wholesale (No GST)</div>
                          <div className="text-[10px] font-bold text-fuchsia-700 uppercase tracking-wider">
                            Admin Only • No GST Needed
                          </div>
                        </div>
                        {businessType === "WHOLESALER WITHOUT GST" && (
                          <CheckCircle2 className="w-5 h-5 text-fuchsia-600 shrink-0" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Special Discount Box for Retailer (Special Discount) */}
                  {businessType === "RETAILER WITH SPECIAL DISCOUNT" && (
                    <div className="mt-3 p-4 bg-emerald-50/80 rounded-2xl border-2 border-emerald-300 shadow-xs space-y-2 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <label className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                          <Tag size={15} className="text-emerald-700" />
                          <span>What special discount would you like to give? *</span>
                        </label>
                        <span className="text-[11px] font-bold text-emerald-700">
                          Formula: (MRP / 2) - Special Discount
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                        <div className="relative w-full sm:w-56">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800 font-black text-sm">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={specialDiscount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSpecialDiscount(val === "" ? "" : Math.max(0, parseFloat(val) || 0));
                            }}
                            placeholder="e.g. 50"
                            className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-emerald-400 rounded-xl text-emerald-950 font-black text-base font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>
                        <p className="text-xs text-emerald-800 font-medium">
                          Enter the discount per PC (e.g. Special Discount 50 will deduct ₹50 per piece from MRP/2).
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ═══════════════════════════════════════════
                    CREDIT DAYS TAB (ENTERED MANUALLY)
                    ═══════════════════════════════════════════ */}
                <div className="space-y-2 p-4 bg-orange-50/50 rounded-2xl border border-orange-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Clock size={15} className="text-orange-600" />
                      <span>Credit Days (Enter Manually)</span>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                    <div className="relative w-full sm:w-52">
                      <input
                        type="number"
                        min={0}
                        max={180}
                        step={1}
                        value={creditDays === "" ? "" : creditDays}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                          setCreditDays(isNaN(val as number) ? "" : val);
                        }}
                        placeholder="e.g. 45"
                        className="w-full px-4 py-2.5 bg-white border-2 border-orange-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs pr-14"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                        Days
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white text-orange-950 border border-orange-200 shadow-xs font-mono">
                        {creditDays ? `✓ ${creditDays} Days Credit Limit Granted` : "✓ Advance Payment (0 Days Credit)"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-500">
                    Credit terms will be auto-applied on all order forms for this customer.
                  </p>
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
                    onChange={(e) => setShopName(e.target.value.toUpperCase())}
                    placeholder="e.g. SHREE RAM CLOTH STORE / V-MART"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-xs uppercase placeholder:normal-case"
                  />
                </div>

                {/* Field 2 & 3: GST/PAN No and Phone Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <CreditCard size={14} className="text-slate-500" />
                        <span>GST / PAN No.</span>
                        {businessType !== "WHOLESALER WITHOUT GST" && (
                          <span className="text-red-500">*</span>
                        )}
                        {businessType === "WHOLESALER WITHOUT GST" && (
                          <span className="text-[10px] text-fuchsia-700 font-bold">(Optional)</span>
                        )}
                      </label>
                      {autoFilledFields.gstPanNo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          <Check size={10} /> Auto-filled
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required={businessType !== "WHOLESALER WITHOUT GST"}
                      value={gstPanNo}
                      onChange={(e) => setGstPanNo(e.target.value.toUpperCase())}
                      placeholder={businessType === "WHOLESALER WITHOUT GST" ? "Optional (No GST needed)" : "e.g. 24ABCDE1234F1Z5 or PAN"}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition uppercase shadow-xs placeholder:normal-case"
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

                {/* Field 4: Contact Persons with Add Another Contact Person Button */}
                <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <User size={14} className="text-slate-500" />
                      <span>Contact Persons</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalContacts((prev) => [
                          ...prev,
                          { name: "", phone: "", designation: "" },
                        ])
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-orange-50 text-orange-600 border border-slate-300 hover:border-orange-400 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Another Contact Person</span>
                    </button>
                  </div>

                  {/* Primary Contact Person */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Primary Contact / Proprietor
                    </span>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value.toUpperCase())}
                      placeholder="e.g. Rajesh Kumar (Proprietor)"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs uppercase placeholder:normal-case"
                    />
                  </div>

                  {/* Additional Contact Persons */}
                  {additionalContacts.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      {additionalContacts.map((contact, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                              Contact Person #{idx + 2}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAdditionalContacts((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                              title="Remove contact person"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={contact.name}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setAdditionalContacts((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], name: val };
                                  return copy;
                                });
                              }}
                              placeholder="Full Name *"
                              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 uppercase placeholder:normal-case"
                            />
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAdditionalContacts((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], phone: val };
                                  return copy;
                                });
                              }}
                              placeholder="Mobile Number"
                              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <input
                              type="text"
                              value={contact.designation}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setAdditionalContacts((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], designation: val };
                                  return copy;
                                });
                              }}
                              placeholder="Designation (e.g. Manager)"
                              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 uppercase placeholder:normal-case"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    onChange={(e) => setAddress(e.target.value.toUpperCase())}
                    placeholder="e.g. Shop No. 42, New Textile Market, Ring Road"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs uppercase placeholder:normal-case"
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
                      onChange={(e) => setCity(e.target.value.toUpperCase())}
                      placeholder="e.g. Surat / Mumbai"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs uppercase placeholder:normal-case"
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
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs uppercase"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st.toUpperCase()}
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
                    onChange={(e) => setTransportName(e.target.value.toUpperCase())}
                    placeholder="e.g. V-Trans, Navata Road Transport, Shree Ram Transport"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition shadow-xs uppercase placeholder:normal-case"
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
