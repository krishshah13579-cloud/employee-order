"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Power,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface GatewayStatus {
  online: boolean;
  status: "INITIALIZING" | "NEED_SCAN" | "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "OFFLINE";
  connected: boolean;
  phone?: string | null;
  name?: string | null;
  qr?: string | null;
  error?: string | null;
}

export default function AdminWhatsAppPage() {
  const { toast } = useToast();
  const [gateway, setGateway] = useState<GatewayStatus>({
    online: false,
    status: "OFFLINE",
    connected: false,
  });
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from Krish Clothing Co.! WhatsApp Gateway test successful. 🧵");
  const [sendingTest, setSendingTest] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/whatsapp");
      if (res.ok) {
        const data = await res.json();
        setGateway(data);
      }
    } catch (e) {
      setGateway((prev) => ({ ...prev, online: false, status: "OFFLINE" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast("Please enter a recipient phone number", "error");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          to: testPhone,
          message: testMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test message");
      toast(`✅ Test message sent successfully to ${testPhone}!`, "success");
    } catch (err: any) {
      toast(err.message || "Could not send test message", "error");
    } finally {
      setSendingTest(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this WhatsApp session? You will need to scan the QR code again.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (res.ok) {
        toast("WhatsApp session disconnected. Please scan the new QR code.", "info");
        fetchStatus();
      }
    } catch {
      toast("Failed to disconnect", "error");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200">
            <MessageCircle size={13} />
            <span>100% Free Self-Hosted Gateway</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            WhatsApp Dispatch Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Connects directly with your WhatsApp Business number (<span className="font-bold text-slate-800">8128756632</span>) to automatically dispatch Order Forms, Tax Invoices &amp; PDF files without any third-party fees.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Live Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              gateway.connected
                ? "bg-emerald-100 text-emerald-600"
                : gateway.status === "NEED_SCAN"
                ? "bg-amber-100 text-amber-600"
                : "bg-rose-100 text-rose-600"
            }`}
          >
            {gateway.connected ? (
              <CheckCircle2 size={24} />
            ) : gateway.status === "NEED_SCAN" ? (
              <QrCode size={24} />
            ) : (
              <Power size={24} />
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Gateway Connection
            </span>
            <span className="text-base font-black text-slate-900">
              {gateway.connected
                ? "Connected & Ready"
                : gateway.status === "NEED_SCAN"
                ? "Needs QR Scan"
                : gateway.online
                ? gateway.status
                : "Gateway Offline"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Smartphone size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Sender Phone
            </span>
            <span className="text-base font-black text-slate-900">
              {gateway.phone ? `+${gateway.phone}` : "8128756632 (Pending Link)"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Dispatch Mode
            </span>
            <span className="text-base font-black text-slate-900">
              {gateway.connected ? "Direct Native PDF Dispatch" : "Browser Deep Link Fallback"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Section */}
      {gateway.connected ? (
        /* CONNECTED STATE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>WhatsApp Business Linked Successfully</span>
              </h2>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Active
              </span>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-900 leading-relaxed">
              <p className="font-bold">
                🎉 Your WhatsApp account (+{gateway.phone || "8128756632"}) is linked and operating in the background.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-emerald-800">
                <li>Order Forms will be automatically dispatched with the actual PDF document attached.</li>
                <li>Tax Invoices (when marked ready with updated quantities) will dispatch automatically.</li>
                <li>Weekly outstanding payment reminders are delivered directly from your number.</li>
                <li>Zero monthly fees, zero per-message charges forever.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Power size={14} />
                <span>{disconnecting ? "Disconnecting..." : "Disconnect / Link Another Device"}</span>
              </button>
            </div>
          </div>

          {/* Test Dispatch Form */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Send size={18} className="text-orange-600" />
              <span>Send Test Message</span>
            </h2>
            <p className="text-xs text-slate-500">
              Test instant delivery to any WhatsApp mobile number to verify gateway connectivity.
            </p>

            <form onSubmit={handleSendTest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Recipient WhatsApp Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9825123456 or 919825123456"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Test Message Body
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest}
                className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={14} />
                <span>{sendingTest ? "Sending..." : "Send Test WhatsApp Message"}</span>
              </button>
            </form>
          </div>
        </div>
      ) : gateway.online && gateway.qr ? (
        /* QR SCAN STATE */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider border border-amber-200">
            <QrCode size={14} />
            <span>Scan to Connect WhatsApp Business</span>
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">
              Link WhatsApp Business (8128756632)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Point your phone camera at this QR code to connect your account for automated dispatch.
            </p>
          </div>

          <div className="inline-block p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-md">
            <img
              src={gateway.qr}
              alt="Scan WhatsApp QR Code"
              className="w-64 h-64 mx-auto rounded-lg"
            />
          </div>

          <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-700 space-y-2 max-w-md mx-auto">
            <h3 className="font-bold text-slate-900 mb-2">Instructions:</h3>
            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
              <li>Open <strong>WhatsApp Business</strong> on your phone (<strong>8128756632</strong>).</li>
              <li>Tap <strong>Settings / ⋮ Three Dots</strong> &gt; <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a Device</strong> and point your camera at this QR code.</li>
              <li>This page will automatically refresh once connected!</li>
            </ol>
          </div>
        </div>
      ) : (
        /* OFFLINE STATE */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <Power size={32} />
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">
              WhatsApp Gateway Service Offline
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              The background WhatsApp service is not currently running on port 5050.
            </p>
          </div>

          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono text-left max-w-md mx-auto space-y-2">
            <span className="text-slate-400 block text-[11px] font-sans font-bold">To start the gateway service, run:</span>
            <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg">
              <span className="text-emerald-400 font-bold">npm run whatsapp:gateway</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Once started, this page will instantly update and present the QR code for linking your phone.
          </p>
        </div>
      )}
    </div>
  );
}
