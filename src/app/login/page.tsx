"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useEmployee } from "@/components/providers/EmployeeProvider";

export default function EmployeeLoginPage() {
  const router = useRouter();
  const { employee, loading: sessionLoading, login } = useEmployee();

  const [name, setName] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [showPin, setShowPin] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNightLogoutNotice, setIsNightLogoutNotice] = useState<boolean>(false);
  const [isInactivityNotice, setIsInactivityNotice] = useState<boolean>(false);

  // Mandatory First-Login Permanent PIN Setup state
  const [mustSetPermanentPin, setMustSetPermanentPin] = useState<boolean>(false);
  const [authenticatedEmpName, setAuthenticatedEmpName] = useState<string>("");
  const [newPermanentPin, setNewPermanentPin] = useState<string>("");
  const [confirmPermanentPin, setConfirmPermanentPin] = useState<string>("");
  const [showPermanentPin, setShowPermanentPin] = useState<boolean>(false);
  const [savingPermanentPin, setSavingPermanentPin] = useState<boolean>(false);
  const [permanentPinError, setPermanentPinError] = useState<string | null>(null);

  // Check URL params for logout reasons (night logout or 30-min inactivity)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "night_logout") {
        setIsNightLogoutNotice(true);
      } else if (params.get("reason") === "inactivity") {
        setIsInactivityNotice(true);
      }
    }
  }, []);

  // If already authenticated as employee (and not Super Admin), check if permanent PIN setup is pending
  useEffect(() => {
    if (!sessionLoading && employee && employee.id !== 0) {
      if (employee.mustChangePin) {
        setMustSetPermanentPin(true);
        setAuthenticatedEmpName(employee.name);
      } else {
        router.replace("/");
      }
    }
  }, [employee, sessionLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please enter your registered Employee Name.");
      return;
    }
    if (!pin.trim()) {
      setErrorMsg("Please enter your security PIN.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await login(name.trim(), pin.trim());
      if (res.success) {
        if (res.employee?.mustChangePin) {
          setMustSetPermanentPin(true);
          setAuthenticatedEmpName(res.employee.name);
        } else {
          window.location.href = "/";
        }
      } else {
        setErrorMsg(res.error || "Invalid name or PIN entered.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPermanentPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPermanentPinError(null);

    const cleanPin = newPermanentPin.trim();
    const cleanConfirm = confirmPermanentPin.trim();

    if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setPermanentPinError("Permanent PIN must be exactly 4 digits (e.g. 1234).");
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setPermanentPinError("PINs do not match. Please verify and confirm.");
      return;
    }

    try {
      setSavingPermanentPin(true);
      const res = await fetch("/api/employee/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: cleanPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set permanent PIN.");
      }
      // Successfully saved permanent PIN! Redirect to dashboard
      window.location.href = "/";
    } catch (err: any) {
      setPermanentPinError(err.message || "Failed to set permanent PIN.");
    } finally {
      setSavingPermanentPin(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
        <span className="text-xs font-bold text-slate-400">Verifying session...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Card Top */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <img
              src="/iq-trousers-logo-transparent.png"
              alt="IQ Trousers"
              width={48}
              height={56}
              className="h-14 w-auto object-contain transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/iq-logo.jpg";
              }}
            />
            <div className="flex flex-col text-left">
              <span className="text-2xl font-black tracking-tight text-white font-sans uppercase leading-none">
                IQ Trousers
              </span>
              <span className="text-[11px] text-orange-500 font-bold uppercase tracking-wider mt-1">
                Krish Clothing Co.
              </span>
            </div>
          </Link>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={12} />
              <span>Employee Portal Access</span>
            </span>
          </div>
        </div>

        {/* Login or Permanent PIN Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {mustSetPermanentPin ? (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Lock size={12} />
                  <span>Mandatory Security Setup</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Set Your Permanent 4-Digit PIN
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Welcome, <strong className="text-white">{authenticatedEmpName}</strong>! You signed in with a temporary PIN. Please choose your secret 4-digit personal PIN to secure your account.
                </p>
              </div>

              {permanentPinError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{permanentPinError}</span>
                </div>
              )}

              <form onSubmit={handleSetPermanentPin} className="space-y-4">
                {/* New 4-digit PIN */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    New 4-Digit PIN <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type={showPermanentPin ? "text" : "password"}
                      required
                      autoFocus
                      maxLength={4}
                      pattern="[0-9]{4}"
                      placeholder="e.g. 5821"
                      value={newPermanentPin}
                      onChange={(e) => setNewPermanentPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs font-mono font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPermanentPin(!showPermanentPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                      title={showPermanentPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showPermanentPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1">Must be exactly 4 numeric digits</span>
                </div>

                {/* Confirm New 4-digit PIN */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Confirm 4-Digit PIN <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type={showPermanentPin ? "text" : "password"}
                      required
                      maxLength={4}
                      pattern="[0-9]{4}"
                      placeholder="Re-enter 4-digit PIN"
                      value={confirmPermanentPin}
                      onChange={(e) => setConfirmPermanentPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                      className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs font-mono font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPermanentPin || newPermanentPin.length !== 4 || confirmPermanentPin.length !== 4}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  {savingPermanentPin ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>Saving Permanent PIN...</span>
                    </>
                  ) : (
                    <>
                      <span>Activate Account & Continue</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Sign In to Order System
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your registered employee name and PIN to access the wholesale order dashboard.
                </p>
                {employee?.id === 0 && (
                  <div className="mt-3 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs text-blue-300">
                    <span>Logged in as Super Admin in Admin Panel.</span>
                    <Link href="/" className="font-bold underline text-blue-400 hover:text-white">
                      Continue as Admin →
                    </Link>
                  </div>
                )}
              </div>

              {isNightLogoutNotice && (
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in">
                  <span className="text-base leading-none">🌙</span>
                  <div>
                    <strong className="block text-amber-200 font-bold mb-0.5">
                      Standard Daily Logout (After 9:00 PM IST)
                    </strong>
                    <span>
                      The employee wholesale portal automatically closes everyday after 9:00 PM IST for general sales staff. Team Leaders (T.L.) have unrestricted 24*7 access.
                    </span>
                  </div>
                </div>
              )}

              {isInactivityNotice && (
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in">
                  <span className="text-base leading-none">⏱️</span>
                  <div>
                    <strong className="block text-amber-200 font-bold mb-0.5">
                      Session Expired (30 Mins Inactivity)
                    </strong>
                    <span>
                      For your account security, you were automatically logged out after 30 minutes of inactivity. Please enter your PIN to continue.
                    </span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Employee Name */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Employee Name <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Enter your registered employee name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>

                {/* Employee PIN */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Security PIN <span className="text-orange-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type={showPin ? "text" : "password"}
                      required
                      maxLength={8}
                      placeholder="Enter security PIN"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs font-mono font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                      title={showPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as Sales Employee</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
