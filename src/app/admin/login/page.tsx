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
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Setup state
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");

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

  // Handle Step 1: Submit Username & Password
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        toast(data.error || "Authentication failed. Check username and password.", "error");
      }
    } catch (err: any) {
      toast("Error logging in: " + err.message, "error");
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
                    placeholder="e.g. Master Administrator"
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
                    placeholder="admin@iqtrousers.com"
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
                    placeholder="e.g. 123456"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Admin Username / Email
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none transition"
                      placeholder="Enter admin email or username"
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
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none transition font-mono"
                      placeholder="Enter password"
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
                    Enter the 6-digit security PIN configured for <strong>{username}</strong>.
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
                      placeholder="••••••"
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
    </div>
  );
}
