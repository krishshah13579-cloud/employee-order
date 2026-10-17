"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  MapPin,
  Landmark,
  CreditCard,
  FileText,
  Save,
  CheckCircle,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  AlertTriangle,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { AdminProfileData } from "@/lib/types";

export default function AdminProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Security Locking State (Locked by default)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);

  // 2FA Modal State
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  const [formData, setFormData] = useState<AdminProfileData>({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    gstNo: "",
    panNo: "",
    address: "",
    bankName: "",
    accountNo: "",
    ifscCode: "",
    notes: "",
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/profile");
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
        if (data.email) {
          setMaskedEmail(data.email);
        }
      }
    } catch (err: any) {
      toast("Failed to load admin profile: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isUnlocked) {
      toast("Admin details are locked. Please authenticate with 2FA email to edit.", "error");
      return;
    }
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Step 1: Request 2FA Email OTP to unlock
  const handleStartUnlock = async () => {
    setShowUnlockModal(true);
    setSendingOtp(true);
    setOtpCode("");

    try {
      const res = await fetch("/api/admin/profile/send-otp", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setMaskedEmail(data.email || data.fullEmail || "");
        toast("2FA Security code dispatched to your email!", "success");
      } else {
        toast(data.error || "Failed to dispatch 2FA email", "error");
      }
    } catch (err: any) {
      toast("Error initiating 2FA: " + err.message, "error");
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Verify 2FA OTP & Unlock Form
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      toast("Please enter the complete 2FA security code.", "error");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/admin/profile/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.unlockToken) {
        setUnlockToken(data.unlockToken);
        setIsUnlocked(true);
        setShowUnlockModal(false);
        setOtpCode("");
        toast("2FA Verified! Admin Details unlocked for editing.", "success");
      } else {
        toast(data.error || "Invalid 2FA code. Please verify and try again.", "error");
      }
    } catch (err: any) {
      toast("Verification error: " + err.message, "error");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Manual Re-Lock
  const handleReLock = () => {
    setIsUnlocked(false);
    setUnlockToken(null);
    toast("Admin details re-locked successfully.", "success");
  };

  // Step 3: Save Admin Profile (Protected by unlockToken)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isUnlocked || !unlockToken) {
      toast("Admin details are locked. 2FA Email authentication required.", "error");
      handleStartUnlock();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-unlock-token": unlockToken,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setFormData(updated);
        // Automatically re-lock upon saving for maximum security
        setIsUnlocked(false);
        setUnlockToken(null);
        toast("Admin profile and company details saved & re-locked successfully!", "success");
      } else {
        const err = await res.json();
        toast(err.error || "Failed to update profile", "error");
      }
    } catch (err: any) {
      toast("Error saving profile: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
            <ShieldCheck size={16} /> Admin Management
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin & Company Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            Master wholesale business registration, GSTIN, PAN, bank accounts, and company profile.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={fetchProfile}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-orange-600" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          SECURITY STATUS BANNER (LOCKED / UNLOCKED)
          ══════════════════════════════════════════════════ */}
      {!isUnlocked ? (
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                  Protected & Locked
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  2FA Protected
                </span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Admin Details are locked to prevent unauthorized tampering.
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                To edit company registration, GSTIN, address, or banking accounts, verify your identity with 2FA email authentication.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartUnlock}
            className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-orange-500/20 transition cursor-pointer"
          >
            <KeyRound size={15} />
            <span>Unlock to Edit Details (2FA)</span>
          </button>
        </div>
      ) : (
        <div className="bg-emerald-950/80 border border-emerald-800 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Unlock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  2FA Verified • Unlocked for Editing
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">
                You can now make changes to Admin & Company Details.
              </h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Click &apos;Save Admin Details&apos; below when done to commit your updates and automatically re-lock the record.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReLock}
            className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <Lock size={14} />
            <span>Lock Now</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <RefreshCw size={32} className="animate-spin text-orange-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading admin details...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Columns: Protected Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              {/* 1. Personal & Company Identity */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 size={18} className="text-orange-600" /> Business Identity & Owner Information
                  </h3>
                  {!isUnlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Lock size={11} /> Locked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Unlock size={11} /> Editable
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Company / Firm Name *
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      disabled={!isUnlocked}
                      value={formData.companyName}
                      onChange={handleChange}
                      required
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                        !isUnlocked
                          ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none font-medium"
                          : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      }`}
                      placeholder="IQ TROUSERS"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Admin / Owner Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      disabled={!isUnlocked}
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                        !isUnlocked
                          ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none font-medium"
                          : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      }`}
                      placeholder="Krish Shah"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Email Address (Receives 2FA OTP) *
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        disabled={!isUnlocked}
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                          !isUnlocked
                            ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none font-medium"
                            : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        }`}
                        placeholder="admin@iqtrousers.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Contact Number / Mobile *
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="text"
                        name="phone"
                        disabled={!isUnlocked}
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                          !isUnlocked
                            ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none font-medium"
                            : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        }`}
                        placeholder="+91 98250 13579"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Tax Identification */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <FileText size={18} className="text-orange-600" /> Tax & Legal Registrations
                  </h3>
                  {!isUnlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Lock size={11} /> Locked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Unlock size={11} /> Editable
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      GSTIN Number *
                    </label>
                    <input
                      type="text"
                      name="gstNo"
                      disabled={!isUnlocked}
                      value={formData.gstNo}
                      onChange={handleChange}
                      required
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase transition outline-none ${
                        !isUnlocked
                          ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none font-bold"
                          : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      }`}
                      placeholder="24AAACI1357Q1Z2"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      PAN Number *
                    </label>
                    <input
                      type="text"
                      name="panNo"
                      disabled={!isUnlocked}
                      value={formData.panNo}
                      onChange={handleChange}
                      required
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase transition outline-none ${
                        !isUnlocked
                          ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none font-bold"
                          : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      }`}
                      placeholder="AAACI1357Q"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={15} className="text-orange-600" /> Registered Business / Warehouse Address *
                  </span>
                  {!isUnlocked && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Lock size={11} /> Locked
                    </span>
                  )}
                </label>
                <textarea
                  name="address"
                  disabled={!isUnlocked}
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                    !isUnlocked
                      ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none"
                      : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  }`}
                  placeholder="Plot 501-504, Textile Tower, Ring Road, Surat, Gujarat - 395002"
                />
              </div>

              {/* 4. Bank Account Details */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-4">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Landmark size={18} className="text-orange-600" /> Commercial Bank Details (For Invoices)
                  </h3>
                  {!isUnlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      <Lock size={11} /> Locked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Unlock size={11} /> Editable
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      name="bankName"
                      disabled={!isUnlocked}
                      value={formData.bankName}
                      onChange={handleChange}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                        !isUnlocked
                          ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none"
                          : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      }`}
                      placeholder="HDFC Bank Ltd"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      Account Number
                    </label>
                    <div className="relative">
                      <CreditCard size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="text"
                        name="accountNo"
                        disabled={!isUnlocked}
                        value={formData.accountNo}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm font-mono transition outline-none ${
                          !isUnlocked
                            ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none"
                            : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        }`}
                        placeholder="50200098765432"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      name="ifscCode"
                      disabled={!isUnlocked}
                      value={formData.ifscCode}
                      onChange={handleChange}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase transition outline-none ${
                        !isUnlocked
                          ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none"
                          : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      }`}
                      placeholder="HDFC0001357"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Invoice Terms / Company Tagline
                </label>
                <textarea
                  name="notes"
                  disabled={!isUnlocked}
                  value={formData.notes || ""}
                  onChange={handleChange}
                  rows={2}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm transition outline-none ${
                    !isUnlocked
                      ? "bg-gray-100 text-gray-600 border border-gray-200 cursor-not-allowed select-none"
                      : "bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  }`}
                  placeholder="IQ TROUSERS — Premium Quality Mens & Boys Garment Manufacturers"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  {!isUnlocked ? (
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <Lock size={14} className="text-orange-500" />
                      Fields are read-only. Unlock with 2FA email to edit.
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Editing session active. Saving will automatically re-lock details.
                    </span>
                  )}
                </div>

                {!isUnlocked ? (
                  <button
                    type="button"
                    onClick={handleStartUnlock}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
                  >
                    <KeyRound size={15} className="text-orange-400" />
                    <span>Unlock to Edit Details (2FA)</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReLock}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                    >
                      Cancel & Lock
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-50 transition cursor-pointer"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>Save & Lock Admin Details</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Right 1 Column: Live Business Profile Preview */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧵</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Official Letterhead
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle size={10} /> Active
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-white mb-1">
                {formData.companyName || "IQ TROUSERS"}
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Proprietor: <span className="text-slate-200 font-semibold">{formData.fullName || "Krish Shah"}</span>
              </p>

              <div className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <span>{formData.address || "Surat, Gujarat"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-orange-400 shrink-0" />
                  <span>{formData.phone || "+91 98250 13579"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-orange-400 shrink-0" />
                  <span>{formData.email || "Not set"}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">GSTIN</span>
                  <span className="font-mono text-orange-300 font-bold text-xs">{formData.gstNo || "24AAACI1357Q1Z2"}</span>
                </div>
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">PAN</span>
                  <span className="font-mono text-orange-300 font-bold text-xs">{formData.panNo || "AAACI1357Q"}</span>
                </div>
              </div>

              {formData.bankName && (
                <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                  <span className="text-[10px] uppercase text-orange-400 font-bold block mb-1">
                    Bank Clearance Account
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bank:</span>
                    <span className="font-semibold text-white">{formData.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">A/C:</span>
                    <span className="font-mono text-white">{formData.accountNo || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">IFSC:</span>
                    <span className="font-mono text-white">{formData.ifscCode || "—"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          2FA EMAIL UNLOCK VERIFICATION MODAL
          ══════════════════════════════════════════════════ */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowUnlockModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">2FA Email Authentication</h2>
                <p className="text-[11px] text-orange-400 font-semibold uppercase tracking-wider">
                  Unlock Admin Details
                </p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-5 text-center">
              <p className="text-xs text-slate-300">
                We have generated a 6-digit 2FA security code for admin authorization:
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-slate-900 rounded-lg border border-slate-700 text-xs font-mono text-orange-400">
                <Mail size={13} />
                <span>{maskedEmail}</span>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                  Enter 6-Digit 2FA Security Code
                </label>
                <div className="relative max-w-[220px] mx-auto">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full py-3 bg-slate-800 border-2 border-orange-500/60 rounded-xl text-2xl font-bold tracking-widest text-center text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length < 4}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Verifying Security Code...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>Verify & Unlock For Editing</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={handleStartUnlock}
                    disabled={sendingOtp}
                    className="text-orange-400 hover:text-orange-300 font-semibold transition"
                  >
                    {sendingOtp ? "Resending Code..." : "Resend 2FA Email Code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUnlockModal(false)}
                    className="text-slate-400 hover:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
