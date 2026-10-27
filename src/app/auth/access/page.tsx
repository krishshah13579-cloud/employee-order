"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, AlertTriangle, Smartphone, ArrowRight, Loader2, Lock } from "lucide-react";

function DeviceAccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const keyParam = searchParams.get("key") || "";
  const masterKeyParam = searchParams.get("master_key") || "";

  const [inputKey, setInputKey] = useState(keyParam || masterKeyParam);
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Detect simple device name e.g. "iPhone", "Android", "Mac"
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      let detected = "Mobile Device";
      if (/iPhone/i.test(ua)) detected = "Apple iPhone";
      else if (/iPad/i.test(ua)) detected = "Apple iPad";
      else if (/Android/i.test(ua)) detected = "Android Device";
      else if (/Macintosh/i.test(ua)) detected = "Mac Computer";
      else if (/Windows/i.test(ua)) detected = "Windows PC";
      setDeviceName(detected);
    }
  }, []);

  // Auto-verify if key or master_key is present in URL
  useEffect(() => {
    if (keyParam || masterKeyParam) {
      handleVerify(keyParam, masterKeyParam);
    }
  }, [keyParam, masterKeyParam]);

  const handleVerify = async (keyToUse?: string, masterKeyToUse?: string) => {
    const k = (keyToUse !== undefined ? keyToUse : inputKey).trim();
    const mk = (masterKeyToUse !== undefined ? masterKeyToUse : "").trim();

    if (!k && !mk) {
      setStatus("error");
      setMessage("Please enter your authorization key or open the link sent to your WhatsApp.");
      return;
    }

    setLoading(true);
    setStatus("verifying");
    setMessage("Verifying device authorization with IQ TROUSERS security server...");

    try {
      const res = await fetch("/api/auth/device-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: k,
          masterKey: mk,
          deviceName: deviceName || "Authorized Device",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        setMessage(data.message || "Device successfully authorized!");
        setTimeout(() => {
          window.location.href = data.redirectUrl || "/login";
        }, 1200);
      } else {
        setStatus("error");
        setMessage(data.error || "Invalid or expired authorization link. Please contact Administrator.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage("Connection error while authorizing device. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top color bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 mb-4 shadow-lg shadow-orange-500/5">
            {status === "success" ? (
              <CheckCircle2 size={36} className="text-emerald-400 animate-bounce" />
            ) : status === "error" ? (
              <AlertTriangle size={36} className="text-red-400" />
            ) : loading ? (
              <Loader2 size={36} className="animate-spin text-orange-400" />
            ) : (
              <ShieldCheck size={36} />
            )}
          </div>
          <span className="text-xs font-bold tracking-widest uppercase px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full mb-2">
            IQ TROUSERS • Device Gate
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {status === "success"
              ? "Device Authorized!"
              : status === "error"
              ? "Authorization Failed"
              : "Employee Device Activation"}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {status === "success"
              ? "Your phone is now registered for 365 days."
              : "One-time terminal authorization for employee.iqtrousers.in"}
          </p>
        </div>

        {/* Status Messages */}
        {message && (
          <div
            className={`p-4 rounded-xl text-sm mb-6 border ${
              status === "success"
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                : status === "error"
                ? "bg-red-950/60 border-red-800/80 text-red-300"
                : "bg-orange-950/60 border-orange-800/80 text-orange-300"
            }`}
          >
            <p className="font-medium text-center">{message}</p>
          </div>
        )}

        {/* Success Redirect Banner */}
        {status === "success" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <Loader2 size={18} className="animate-spin" />
              <span>Redirecting to Employee Portal...</span>
            </div>
            <button
              onClick={() => (window.location.href = "/login")}
              className="mt-2 text-xs text-slate-400 hover:text-white underline"
            >
              Click here if not redirected automatically
            </button>
          </div>
        )}

        {/* Form when manual entry or retry is needed */}
        {status !== "success" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Device Nickname
              </label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                <Smartphone size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Rahul Samsung Galaxy"
                  className="bg-transparent border-none outline-none w-full text-white placeholder-slate-600 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Activation Key
              </label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                <Lock size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Paste single-use invite key or master key"
                  className="bg-transparent border-none outline-none w-full text-white placeholder-slate-600 text-sm font-mono"
                />
              </div>
            </div>

            <button
              onClick={() => handleVerify()}
              disabled={loading || !inputKey.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-orange-600/20 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Terminal...</span>
                </>
              ) : (
                <>
                  <span>Authorize This Device</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="text-center mt-4">
              <p className="text-[11px] text-slate-500">
                Need an authorization key? Ask your Administrator or Team Leader to send your one-time WhatsApp activation link.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeviceAccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      }
    >
      <DeviceAccessContent />
    </Suspense>
  );
}
