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

  // Normal Login State
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");

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

  // Handle Step 1: Submit Username & Password -> Dispatches Email OTP
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setLoginError("Please enter your administrator email and password.");
      toast("Email and password are required.", "error");
      return;
    }

    setLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (res.ok && data.requires2FA) {
        setMaskedEmail(data.email || username.trim());
        if (data.fallbackCode) {
          setFallbackCode(data.fallbackCode);
        }
        toast(data.message || `6-digit 2FA login code emailed to ${data.email || "your registered email"}!`, "success");
        setStep(2);
      } else {
        const errMsg = data.error || "Authentication failed. Check your password.";
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

  // Handle Resend Email OTP
  const handleResendOtp = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.fallbackCode) {
          setFallbackCode(data.fallbackCode);
        }
        toast(data.message || "A fresh 6-digit OTP code has been emailed to you!", "success");
      } else {
        toast(data.error || "Failed to resend OTP", "error");
      }
    } catch (err: any) {
      toast("Error resending code: " + err.message, "error");
    } finally {
      setResending(false);
    }
  };

  // Handle Step 2: Submit 2FA OTP Code
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          code: twoFactorCode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast("2FA Verified! Welcome to IQ TROUSERS Admin.", "success");
        router.push("/admin");
      } else {
        toast(data.error || "Invalid OTP code. Please check your email.", "error");
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
        <span className="text-xs font-bold text-slate-400">Connecting to secure portal...</span>
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
            <span>Email 2FA OTP</span>
          </div>
        </div>

        {/* STEP 1: Username & Password */}
        {step === 1 && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Administrator Email / Username
                </label>
                <span className="text-[10px] bg-slate-800 text-orange-400 font-semibold px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1">
                  <Lock size={10} /> Secure Login
                </span>
              </div>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-orange-400" />
                <input
                  type="email"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setLoginError("");
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 outline-none transition"
                  placeholder="Enter administrator email"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Enter your registered administrator email address to log in.
              </p>
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
                  placeholder="Enter your password"
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

            {/* Error Message */}
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-red-400" />
                <span>{loginError}</span>
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
                  <span>Sending 2FA OTP to Email...</span>
                </>
              ) : (
                <>
                  <span>Send 2FA Code & Continue</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: 2FA Authentication via Email OTP */}
        {step === 2 && (
          <form onSubmit={handle2FASubmit} className="space-y-5">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-2 border border-orange-500/40">
                <Mail size={20} />
              </div>
              <h3 className="text-sm font-bold text-white">2FA Security Code Sent</h3>
              <p className="text-xs text-slate-300 mt-1">
                We have emailed a 6-digit security code to:
              </p>
              <div className="inline-block mt-1 font-mono text-xs font-bold text-orange-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                {maskedEmail || username}
              </div>

              {fallbackCode && (
                <div className="mt-3 pt-3 border-t border-orange-500/20">
                  <div className="text-[11px] text-amber-300 font-semibold mb-1">
                    Direct Access 2FA Code (Backup):
                  </div>
                  <div className="inline-block font-mono text-xl font-black text-amber-400 bg-slate-950 px-4 py-1.5 rounded-xl border border-amber-500/40 tracking-widest select-all">
                    {fallbackCode}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    (Render Free tier blocks outbound SMTP ports. You can enter this code directly.)
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 text-center">
                Enter 6-Digit Email OTP
              </label>
              <div className="relative max-w-[220px] mx-auto">
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full py-3 bg-slate-800 border-2 border-orange-500/60 rounded-xl text-2xl font-bold tracking-widest text-center text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none font-mono"
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
                    <span>Verifying OTP Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    <span>Verify OTP & Enter Admin</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-orange-400 hover:text-orange-300 font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                  <span>{resending ? "Sending..." : "Resend Email OTP"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setTwoFactorCode("");
                  }}
                  className="text-slate-400 hover:text-white transition"
                >
                  ← Back to Password
                </button>
              </div>
            </div>
          </form>
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
