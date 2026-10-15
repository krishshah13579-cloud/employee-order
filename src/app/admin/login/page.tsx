"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";
import {
  Lock,
  Mail,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  Building2,
  Sparkles,
  Loader2,
  CheckCircle,
  RefreshCw,
  X,
  AlertTriangle,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Setup state
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [registeredUsernames, setRegisteredUsernames] = useState<string[]>([]);

  // Setup Form State
  const [setupFullName, setSetupFullName] = useState("");
  const [setupUsername, setSetupUsername] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupShowPassword, setSetupShowPassword] = useState(false);
  const [setup2FAPin, setSetup2FAPin] = useState("");
  const [setupCompanyName, setSetupCompanyName] = useState("IQ TROUSERS");
  const [setupLoading, setSetupLoading] = useState(false);

  // Normal Login State
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("krishshah13579@gmail.com");
  const [password, setPassword] = useState("Krish@2000");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loginError, setLoginError] = useState("");

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [newResetUser, setNewResetUser] = useState("krishshah13579@gmail.com");
  const [newResetPass, setNewResetPass] = useState("Krish@2000");
  const [newResetPin, setNewResetPin] = useState("135790");

  // Check if admin account exists in database
  useEffect(() => {
    async function checkSetupStatus() {
      try {
        setCheckingSetup(true);
        const res = await fetch("/api/auth/setup");
        const data = await res.json();
        if (data.needsSetup) {
          setNeedsSetup(true);
        } else {
          setNeedsSetup(false);
          if (data.registeredUsernames && data.registeredUsernames.length > 0) {
            setRegisteredUsernames(data.registeredUsernames);
            // Default username if input empty
            setUsername(data.registeredUsernames[0]);
          }
        }
      } catch (err) {
        console.error("Failed to check setup status:", err);
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetupStatus();
  }, []);

  // Handle Initial Master Admin Setup
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupLoading(true);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: setupFullName,
          username: setupUsername,
          password: setupPassword,
          twoFactorSecret: setup2FAPin,
          companyName: setupCompanyName,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast("Master Administrator account created in database!", "success");
        router.push("/admin");
      } else {
        toast(data.error || "Setup failed. Please check inputs.", "error");
      }
    } catch (err: any) {
      toast("Error initializing setup: " + err.message, "error");
    } finally {
      setSetupLoading(false);
    }
  };

  // 1-Click Quick Reset to Default Master Credentials
  const handleQuickResetToDefault = async () => {
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "krishshah13579@gmail.com",
          password: "Krish@2000",
          twoFactorSecret: "135790",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast("Admin credentials successfully set in database!", "success");
        setUsername("krishshah13579@gmail.com");
        setPassword("Krish@2000");
        setTwoFactorCode("135790");
        setRegisteredUsernames(["krishshah13579@gmail.com"]);
        setLoginError("");
        setShowResetModal(false);
      } else {
        toast(data.error || "Failed to reset credentials", "error");
      }
    } catch (err: any) {
      toast("Reset error: " + err.message, "error");
    } finally {
      setResetLoading(false);
    }
  };

  // Custom Reset Handler
  const handleCustomReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newResetUser,
          password: newResetPass,
          twoFactorSecret: newResetPin,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast("New credentials saved to database!", "success");
        setUsername(newResetUser);
        setPassword(newResetPass);
        setTwoFactorCode(newResetPin);
        setRegisteredUsernames([newResetUser]);
        setLoginError("");
        setShowResetModal(false);
      } else {
        toast(data.error || "Failed to update credentials", "error");
      }
    } catch (err: any) {
      toast("Error updating credentials: " + err.message, "error");
    } finally {
      setResetLoading(false);
    }
  };

  // Handle Step 1: Submit Username & Password
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.requires2FA) {
        toast("Credentials verified! Please enter your 6-digit 2FA code.", "success");
        setStep(2);
      } else {
        const errMsg = data.error || "Authentication failed. Check username and password.";
        setLoginError(errMsg);
        toast(errMsg, "error");
      }
    } catch (err: any) {
      const msg = "Error logging in: " + err.message;
      setLoginError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 2: Submit 2FA Code
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          code: twoFactorCode,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast("2FA Verified! Welcome to Admin Panel", "success");
        router.push("/admin");
      } else {
        toast(data.error || "Invalid 2FA code. Please check and try again.", "error");
      }
    } catch (err: any) {
      toast("Error verifying 2FA: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-3" />
        <span className="text-xs font-bold text-slate-400">Connecting to database...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-slate-800/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-2">
            <img
              src="/iq-trousers-logo-transparent.png"
              alt="IQ Trousers Logo"
              width={64}
              height={70}
              className="h-16 w-auto object-contain drop-shadow"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/images/iq-logo.jpg";
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            IQ Trousers
          </h1>
          <p className="text-xs text-orange-500 font-bold uppercase tracking-wider mt-0.5">
            Admin Management Portal
          </p>
        </div>

        {/* ══════════════════════════════════════════════════
            INITIAL ADMIN SETUP (If database has no admin)
            ══════════════════════════════════════════════════ */}
        {needsSetup ? (
          <div className="space-y-5">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-2 border border-orange-500/40">
                <Sparkles size={20} />
              </div>
              <h3 className="text-sm font-black text-white">First-Time System Setup</h3>
              <p className="text-xs text-slate-300 mt-1">
                No administrator account exists in the database. Create your master admin credentials to initialize the system.
              </p>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Admin Full Name <span className="text-orange-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={setupFullName}
                    onChange={(e) => setSetupFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="e.g. Krish Shah"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Email / Username <span className="text-orange-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={setupUsername}
                    onChange={(e) => setSetupUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="krishshah13579@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Password <span className="text-orange-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type={setupShowPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setSetupShowPassword(!setupShowPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {setupShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  6-Digit 2FA Security PIN <span className="text-orange-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={setup2FAPin}
                    onChange={(e) => setSetup2FAPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none font-mono tracking-widest"
                    placeholder="e.g. 135790"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  You will enter this 2FA PIN each time you log in to verify your identity.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Company / Firm Name
                </label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={setupCompanyName}
                    onChange={(e) => setSetupCompanyName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="IQ TROUSERS"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full mt-3 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {setupLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Initializing Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Create Master Admin & Initialize</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════
              STANDARD ADMIN LOGIN (When admin exists)
              ══════════════════════════════════════════════════ */
          <>
            {/* Step Indicators */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <div
                className={`flex items-center space-x-1.5 text-xs font-bold ${
                  step === 1 ? "text-orange-400" : "text-slate-400"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step === 1
                      ? "bg-orange-500/20 border border-orange-500/40 text-orange-400"
                      : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                  }`}
                >
                  {step === 2 ? "✓" : "1"}
                </span>
                <span>Credentials</span>
              </div>
              <div className="w-8 h-px bg-slate-800" />
              <div
                className={`flex items-center space-x-1.5 text-xs font-bold ${
                  step === 2 ? "text-orange-400" : "text-slate-500"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step === 2
                      ? "bg-orange-500/20 border border-orange-500/40 text-orange-400"
                      : "bg-slate-800 border border-slate-700 text-slate-500"
                  }`}
                >
                  2
                </span>
                <span>2FA Security</span>
              </div>
            </div>

            {/* STEP 1: Username & Password */}
            {step === 1 && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Admin Username / Email
                    </label>
                    {registeredUsernames.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        DB: <strong className="text-orange-400">{registeredUsernames[0]}</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setLoginError("");
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none transition"
                      placeholder="krishshah13579@gmail.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setLoginError("");
                      }}
                      className="w-full pl-10 pr-11 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none transition font-mono"
                      placeholder="Krish@2000"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Box with Direct Reset Prompt */}
                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-red-400">
                      <AlertTriangle size={14} />
                      <span>{loginError}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Database credentials may have been changed or not yet synchronized.
                    </p>
                    <button
                      type="button"
                      onClick={handleQuickResetToDefault}
                      disabled={resetLoading}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[11px]"
                    >
                      {resetLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                      <span>Restore Default Master Credentials in Database</span>
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to 2FA</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                {/* Quick actions: Fill Default & Reset Modal Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername("krishshah13579@gmail.com");
                      setPassword("Krish@2000");
                      setLoginError("");
                    }}
                    className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold underline underline-offset-2 transition"
                  >
                    Auto-fill default
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="text-[11px] text-slate-400 hover:text-white font-semibold transition flex items-center gap-1"
                  >
                    <RefreshCw size={11} />
                    <span>Reset / Change Password</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: 2FA Authentication */}
            {step === 2 && (
              <form onSubmit={handle2FASubmit} className="space-y-5">
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-2 border border-orange-500/40">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-white">Two-Factor Authentication</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Enter the 6-digit security PIN for <strong>{username}</strong> (Default: <strong className="text-orange-400 font-mono">135790</strong>).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                    6-Digit 2FA Security PIN
                  </label>
                  <div className="relative max-w-[240px] mx-auto">
                    <KeyRound size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="135790"
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border-2 border-orange-500/60 rounded-xl text-xl font-bold tracking-widest text-center text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={loading || twoFactorCode.length < 4}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Verifying Security PIN...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        <span>Verify & Enter Dashboard</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setTwoFactorCode("");
                    }}
                    className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white transition text-center"
                  >
                    ← Back to Login Credentials
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <div className="mt-8 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Protected & Encrypted • IQ Trousers Garment Order System
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RESET / RECOVER CREDENTIALS MODAL
          ══════════════════════════════════════════════════ */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <RefreshCw size={16} />
              </div>
              <h2 className="text-base font-black text-white">Reset Admin Credentials</h2>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Need to restore access? You can 1-click reset to the default master credentials or configure new credentials directly in the database.
            </p>

            {/* 1-Click Default Reset */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-4">
              <span className="text-[11px] font-bold text-orange-400 block mb-1 uppercase tracking-wider">
                ⚡ 1-Click Master Reset
              </span>
              <p className="text-xs text-slate-300 mb-3">
                Sets Username to <code className="text-orange-300 bg-slate-900 px-1 py-0.5 rounded">krishshah13579@gmail.com</code>, Password to <code className="text-orange-300 bg-slate-900 px-1 py-0.5 rounded">Krish@2000</code>, and 2FA PIN to <code className="text-orange-300 bg-slate-900 px-1 py-0.5 rounded">135790</code>.
              </p>
              <button
                type="button"
                onClick={handleQuickResetToDefault}
                disabled={resetLoading}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {resetLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                <span>Reset to Default Master Credentials</span>
              </button>
            </div>

            {/* Custom Credentials Form */}
            <form onSubmit={handleCustomReset} className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                Or Set Custom Credentials:
              </span>

              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1">
                  Username / Email
                </label>
                <input
                  type="text"
                  required
                  value={newResetUser}
                  onChange={(e) => setNewResetUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1">
                  New Password
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={newResetPass}
                  onChange={(e) => setNewResetPass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1">
                  6-Digit 2FA PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={newResetPin}
                  onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-orange-500 font-mono tracking-widest"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-1/2 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {resetLoading && <Loader2 size={13} className="animate-spin" />}
                  <span>Save in Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
