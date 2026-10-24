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

  // Check URL params for night logout reason
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "night_logout") {
        setIsNightLogoutNotice(true);
      }
    }
  }, []);

  // If already authenticated as employee (and not Super Admin), redirect to dashboard
  useEffect(() => {
    if (!sessionLoading && employee && employee.id !== 0) {
      router.replace("/");
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
        router.replace("/");
      } else {
        setErrorMsg(res.error || "Invalid name or PIN entered.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in.");
    } finally {
      setSubmitting(false);
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

        {/* Login Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
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
        </div>
      </div>
    </div>
  );
}
