"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Send,
  Power,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Calendar,
  Clock,
  Bell,
  Users,
  Check,
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
  const [qrKey, setQrKey] = useState(Date.now());

  // Weekly Reminder Settings State
  const [settings, setSettings] = useState({
    weeklyReminderEnabled: true,
    weeklyReminderDay: "Saturday",
    weeklyReminderTime: "10:00",
    autoOrderStatusMessage: true,
    lastDispatchedDate: null as string | null,
    lastDispatchedCount: 0,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [dispatchingWeeklyNow, setDispatchingWeeklyNow] = useState(false);

  const fetchStatus = async () => {
    // 1. Direct browser fetch to local gateway on port 5050 (works seamlessly even when browsing via Vercel)
    try {
      const localStatusRes = await fetch("http://localhost:5050/api/status", {
        signal: AbortSignal.timeout(2000),
      }).catch(() => null);

      if (localStatusRes && localStatusRes.ok) {
        const localStatus = await localStatusRes.json();
        let qrDataUrl = null;

        if (!localStatus.connected) {
          const qrRes = await fetch("http://localhost:5050/api/qr", {
            signal: AbortSignal.timeout(2000),
          }).catch(() => null);
          if (qrRes && qrRes.ok) {
            const qrJson = await qrRes.json();
            qrDataUrl = qrJson.qr;
          }
        }

        setGateway({
          online: true,
          status: localStatus.status || (localStatus.connected ? "CONNECTED" : "NEED_SCAN"),
          connected: Boolean(localStatus.connected),
          phone: localStatus.phone || (localStatus.connected ? "8128756632" : null),
          name: localStatus.name || "Krish Clothing Co.",
          qr: qrDataUrl,
        });
        setLoading(false);
        return;
      }
    } catch {}

    // 2. Fallback to server route /api/admin/whatsapp
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
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchStatus();
    fetchSettings();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/whatsapp/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      toast(`✅ Weekly reminder schedule set to Every ${settings.weeklyReminderDay} at ${settings.weeklyReminderTime}!`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerWeeklyRemindersNow = async () => {
    if (!confirm(`Are you sure you want to send weekly payment reminders to ALL customers with outstanding balances now?`)) {
      return;
    }
    setDispatchingWeeklyNow(true);
    try {
      // Try local gateway cron endpoint first
      let triggered = false;
      try {
        const localRes = await fetch("http://localhost:5050/api/cron/payment-reminders", {
          method: "POST",
          signal: AbortSignal.timeout(10000),
        }).catch(() => null);
        if (localRes && localRes.ok) {
          const localData = await localRes.json();
          toast(`✅ Weekly payment reminders sent directly to ${localData.count || 0} customers via WhatsApp (8128756632)!`, "success");
          triggered = true;
        }
      } catch {}

      if (!triggered) {
        const res = await fetch("/api/admin/outstanding/whatsapp-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoDispatch: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to dispatch weekly reminders");
        toast(`✅ Weekly payment reminders dispatched to ${data.count || 0} customers with outstanding balances!`, "success");
      }
      fetchSettings();
    } catch (err: any) {
      toast(err.message || "Could not dispatch weekly reminders", "error");
    } finally {
      setDispatchingWeeklyNow(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast("Please enter a recipient phone number", "error");
      return;
    }
    setSendingTest(true);

    // Try direct local dispatch first
    try {
      const directRes = await fetch("http://localhost:5050/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testPhone, message: testMessage }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);

      if (directRes && directRes.ok) {
        toast(`✅ Test message sent directly to ${testPhone} from 8128756632!`, "success");
        setSendingTest(false);
        return;
      }
    } catch {}

    // Fallback to proxy
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
      await fetch("http://localhost:5050/api/disconnect", {
        method: "POST",
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);
    } catch {}

    try {
      await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
    } catch {}

    toast("Session disconnected. Loading fresh QR code...", "info");
    setQrKey(Date.now());
    setTimeout(fetchStatus, 1500);
    setDisconnecting(false);
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <a
            href="http://localhost:5050/qr"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            title="Open Dedicated Local QR Tab"
          >
            <ExternalLink size={14} />
            <span>Direct QR Link</span>
          </a>

          <button
            type="button"
            onClick={fetchStatus}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              gateway.connected
                ? "bg-emerald-100 text-emerald-600"
                : "bg-amber-100 text-amber-600"
            }`}
          >
            {gateway.connected ? <CheckCircle2 size={24} /> : <QrCode size={24} />}
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Gateway Connection
            </span>
            <span className="text-base font-black text-slate-900">
              {gateway.connected ? "Connected & Active" : "Scan QR Code Below"}
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
              {gateway.phone ? `+${gateway.phone}` : "8128756632"}
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
              {gateway.connected ? "Direct Native PDF Dispatch" : "Awaiting QR Scan"}
            </span>
          </div>
        </div>
      </div>

      {/* WEEKLY PAYMENT REMINDER AUTOMATION SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Automated Weekly Payment Reminder
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                  Every {settings.weeklyReminderDay}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically delivers statement of account, unpaid bill summaries &amp; bank RTGS details directly from WhatsApp (8128756632) to all clients with outstanding balance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleTriggerWeeklyRemindersNow}
              disabled={dispatchingWeeklyNow}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              title="Immediately dispatch weekly reminders to all customers with pending balance"
            >
              <Bell size={13} className={dispatchingWeeklyNow ? "animate-bounce" : ""} />
              <span>{dispatchingWeeklyNow ? "Dispatching to All Clients..." : "Send Reminders to All Customers Now"}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-500" />
              <span>Select Day of Every Week</span>
            </label>
            <select
              value={settings.weeklyReminderDay}
              onChange={(e) => setSettings({ ...settings, weeklyReminderDay: e.target.value as any })}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white font-bold text-slate-800"
            >
              <option value="Monday">Every Monday</option>
              <option value="Tuesday">Every Tuesday</option>
              <option value="Wednesday">Every Wednesday</option>
              <option value="Thursday">Every Thursday</option>
              <option value="Friday">Every Friday</option>
              <option value="Saturday">Every Saturday (Recommended)</option>
              <option value="Sunday">Every Sunday</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500" />
              <span>Dispatch Time</span>
            </label>
            <input
              type="time"
              value={settings.weeklyReminderTime}
              onChange={(e) => setSettings({ ...settings, weeklyReminderTime: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono font-bold"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={14} />
              <span>{savingSettings ? "Saving..." : "Save Schedule"}</span>
            </button>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 select-none transition">
              <input
                type="checkbox"
                checked={settings.weeklyReminderEnabled}
                onChange={(e) => setSettings({ ...settings, weeklyReminderEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <span>Active</span>
            </label>
          </div>
        </form>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-800">Current Schedule Status: </span>
            {settings.weeklyReminderEnabled ? (
              <span className="text-emerald-700 font-bold">
                🟢 Active — Automatically dispatches every {settings.weeklyReminderDay} at {settings.weeklyReminderTime} IST
              </span>
            ) : (
              <span className="text-rose-600 font-bold">🔴 Paused</span>
            )}
          </div>
          {settings.lastDispatchedDate && (
            <div className="text-slate-500 font-medium">
              Last run on: <span className="font-mono text-slate-800 font-bold">{settings.lastDispatchedDate}</span> ({settings.lastDispatchedCount || 0} customers notified)
            </div>
          )}
        </div>
      </div>

      {/* Main Body */}
      {gateway.connected ? (
        /* CONNECTED DASHBOARD */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>WhatsApp Business Linked Successfully</span>
              </h2>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                🟢 Live
              </span>
            </div>

            <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950 leading-relaxed">
              <p className="font-bold text-sm text-emerald-900">
                🎉 Your WhatsApp account (+{gateway.phone || "918128756632"}) is connected!
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-emerald-800 pt-1">
                <li>Order Forms will automatically dispatch in background with the actual PDF document attached.</li>
                <li>Tax Invoices will dispatch with updated quantities when marked ready.</li>
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
      ) : (
        /* DIRECT QR CODE SECTION (SHOWN ALWAYS WHEN NOT CONNECTED) */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 shadow-xs max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider border border-amber-200">
            <QrCode size={14} />
            <span>Scan to Connect WhatsApp Business (8128756632)</span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Scan WhatsApp QR Code
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
              Scan this QR code with WhatsApp Business on phone <span className="font-bold text-slate-800">8128756632</span>. The system will connect immediately.
            </p>
          </div>

          {/* QR Display: Uses Data URL or direct embedded localhost frame */}
          <div className="inline-block p-4 sm:p-5 bg-white border-2 border-slate-200 rounded-3xl shadow-lg relative">
            {gateway.qr ? (
              <img
                src={gateway.qr}
                alt="Scan WhatsApp QR Code"
                className="w-72 h-72 mx-auto rounded-xl"
              />
            ) : (
              <div className="w-72 h-72 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-4">
                <iframe
                  src="http://localhost:5050/qr"
                  className="w-full h-full border-0 rounded-lg"
                  title="Local QR Code"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="http://localhost:5050/qr"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <ExternalLink size={15} />
              <span>Open QR in Dedicated Window (http://localhost:5050/qr)</span>
            </a>
          </div>

          <div className="text-left bg-slate-50/80 border border-slate-200 rounded-2xl p-5 sm:p-6 text-xs text-slate-700 space-y-2.5 max-w-md mx-auto">
            <h3 className="font-bold text-slate-900 text-sm">3 Quick Steps:</h3>
            <ol className="list-decimal pl-4 space-y-2 leading-relaxed">
              <li>Open <strong>WhatsApp Business</strong> on your phone (<strong>8128756632</strong>).</li>
              <li>Tap <strong>Settings / ⋮ Three Dots</strong> &gt; <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a Device</strong> and point your camera at the QR code above.</li>
            </ol>
            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200">
              Note: This screen auto-refreshes every 3 seconds and will automatically switch to Connected once scanned.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
