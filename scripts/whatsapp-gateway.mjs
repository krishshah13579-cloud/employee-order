/**
 * 100% Free Self-Hosted WhatsApp Multi-Device Gateway
 * Powered by @whiskeysockets/baileys
 *
 * Runs locally or on server to connect directly with WhatsApp Business (8128756632).
 * Enables automated background dispatch of messages and PDF document attachments
 * without any monthly subscription fees or third-party gateways.
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, "..", ".whatsapp-auth");
const PORT = process.env.WHATSAPP_GATEWAY_PORT || 5050;

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// Global Gateway State
let sock = null;
let currentQrCode = null;
let currentQrDataUrl = null;
let connectionState = "INITIALIZING"; // INITIALIZING | NEED_SCAN | CONNECTING | CONNECTED | DISCONNECTED
let connectedUser = null;
let lastError = null;

// Settings Configuration File
const SETTINGS_FILE = path.resolve(__dirname, "..", "prisma", "whatsapp-settings.json");

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch (e) {}
  return {
    weeklyReminderEnabled: true,
    weeklyReminderDay: "Saturday",
    weeklyReminderTime: "10:00",
    autoOrderStatusMessage: true,
    lastDispatchedDate: null,
    lastDispatchedCount: 0,
  };
}

function saveSettings(patch) {
  try {
    const cur = loadSettings();
    const updated = { ...cur, ...patch };
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (e) {
    console.error("Error saving WhatsApp settings:", e);
    return patch;
  }
}

// Clean logger
const logger = pino({ level: process.env.DEBUG ? "debug" : "silent" });

// Sanitize phone number to WhatsApp JID format
function formatJid(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 10) cleaned = "91" + cleaned;
  else if (cleaned.length === 11 && cleaned.startsWith("0")) cleaned = "91" + cleaned.slice(1);
  return `${cleaned}@s.whatsapp.net`;
}

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`🧵 WhatsApp Gateway starting with Baileys v${version.join(".")} (Latest: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger,
      browser: ["Krish Clothing Co.", "Chrome", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrCode = qr;
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        } catch (e) {
          console.error("QR Code generation error:", e);
        }
        connectionState = "NEED_SCAN";
        console.log("\n📲 [WHATSAPP GATEWAY] QR Code generated! Please scan with WhatsApp Business on 8128756632.");
        console.log(`🌐 Open QR viewer in browser: http://localhost:${PORT}/qr\n`);
      }

      if (connection === "connecting") {
        connectionState = "CONNECTING";
        console.log("⏳ Connecting to WhatsApp...");
      }

      if (connection === "open") {
        connectionState = "CONNECTED";
        currentQrCode = null;
        currentQrDataUrl = null;
        lastError = null;
        connectedUser = sock.user || null;

        const phoneDisplay = connectedUser?.id ? connectedUser.id.split(":")[0] : "8128756632";
        console.log(`\n🎉 [WHATSAPP GATEWAY CONNECTED] Successfully linked to WhatsApp Business: +${phoneDisplay}`);
        console.log("🚀 Automated background message & PDF invoice dispatch is now ACTIVE!\n");
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`⚠️ Connection closed (status: ${statusCode}). Reconnect: ${shouldReconnect}`);
        connectionState = "DISCONNECTED";

        if (statusCode === DisconnectReason.loggedOut) {
          console.log("🔒 Device logged out. Clearing auth credentials to generate a fresh QR code...");
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch {}
          connectedUser = null;
          setTimeout(connectToWhatsApp, 2000);
        } else {
          console.log("🔄 Reconnecting WhatsApp connection in 3 seconds...");
          setTimeout(connectToWhatsApp, 3000);
        }
      }
    });
  } catch (err) {
    console.error("Failed to initialize Baileys WhatsApp client:", err);
    connectionState = "DISCONNECTED";
    lastError = err.message;
    setTimeout(connectToWhatsApp, 4000);
  }
}

// Global safety crash-guards for 24/7/365 uninterrupted runtime
process.on("uncaughtException", (err) => {
  console.error("⚠️ [GATEWAY UNCAUGHT EXCEPTION - PREVENTED CRASH]:", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [GATEWAY UNHANDLED REJECTION - PREVENTED CRASH]:", reason?.message || reason);
});

// Automated Weekly Payment Reminders Job
async function triggerWeeklyRemindersJob() {
  if (connectionState !== "CONNECTED" || !sock) {
    console.log("⏳ [WEEKLY REMINDER] Skipped — WhatsApp gateway is not connected.");
    return { success: false, error: "WhatsApp gateway is not connected. Scan QR code first." };
  }

  console.log("\n🚀 [WEEKLY PAYMENT REMINDER] Initiating weekly payment reminder dispatch...");
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${appUrl}/api/admin/outstanding/whatsapp-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoDispatch: false }),
    }).catch(() => null);

    if (!res || !res.ok) {
      console.warn("Could not fetch outstanding reminders from application API at", appUrl);
      return { success: false, error: "Could not fetch customer account statements from application" };
    }

    const data = await res.json();
    const reminders = data.reminders || [];
    console.log(`📋 Found ${reminders.length} customers with outstanding balances.`);

    if (reminders.length === 0) {
      console.log("✅ Zero outstanding balances found. No reminders needed.");
      return { success: true, count: 0, message: "No customers with outstanding balance." };
    }

    let sent = 0;
    for (const rem of reminders) {
      if (!rem.phone || !rem.message) continue;
      const jid = formatJid(rem.phone);
      try {
        await sock.sendMessage(jid, { text: rem.message });
        sent++;
        console.log(`✅ [${sent}/${reminders.length}] Sent weekly statement to ${rem.customerName} (${jid})`);
        // Gentle 3-second delay to preserve WhatsApp Business safety
        await new Promise((r) => setTimeout(r, 3000));
      } catch (sendErr) {
        console.error(`Failed to dispatch reminder to ${rem.customerName}:`, sendErr.message);
      }
    }

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    saveSettings({
      lastDispatchedDate: todayStr,
      lastDispatchedCount: sent,
    });

    console.log(`🎉 [WEEKLY REMINDERS DISPATCHED] Successfully sent to ${sent} customers from +918128756632!\n`);
    return { success: true, count: sent };
  } catch (err) {
    console.error("Weekly reminder job error:", err);
    return { success: false, error: err.message };
  }
}

// Background Cron Scheduler (Runs every 3 minutes)
setInterval(async () => {
  if (connectionState !== "CONNECTED" || !sock) return;

  const settings = loadSettings();
  if (!settings.weeklyReminderEnabled) return;

  const now = new Date();
  const indianDateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "numeric",
    hour12: false,
  });
  const parts = indianDateFormatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);

  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const scheduledDay = settings.weeklyReminderDay || "Saturday";
  const scheduledHour = parseInt((settings.weeklyReminderTime || "10:00").split(":")[0], 10);

  if (
    weekday?.toLowerCase() === scheduledDay.toLowerCase() &&
    hour >= scheduledHour &&
    settings.lastDispatchedDate !== todayStr
  ) {
    console.log(`⏰ [CRON TRIGGER] Today is ${weekday} (Scheduled: ${scheduledDay} at ${scheduledHour}:00 IST). Dispatching weekly payment reminders...`);
    await triggerWeeklyRemindersJob();
  }
}, 3 * 60 * 1000);

// Start WhatsApp Client
connectToWhatsApp();

// HTTP Gateway Server
const server = http.createServer(async (req, res) => {
  // Enable CORS & Chrome Private Network Access (PNA)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 1. Status API
  if (req.method === "GET" && url.pathname === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: connectionState,
        connected: connectionState === "CONNECTED",
        phone: connectedUser?.id ? connectedUser.id.split(":")[0] : null,
        name: connectedUser?.name || "Krish Clothing Co.",
        lastError,
      })
    );
    return;
  }

  // 2. QR API
  if (req.method === "GET" && url.pathname === "/api/qr") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: connectionState,
        qr: currentQrDataUrl,
        rawQr: currentQrCode,
      })
    );
    return;
  }

  // 3. Web QR Display Page (HTML)
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/qr")) {
    const isConnected = connectionState === "CONNECTED";
    const userPhone = connectedUser?.id ? connectedUser.id.split(":")[0] : "8128756632";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Krish Clothing Co. • WhatsApp Gateway</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
    body { background:#0f172a; color:#f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
    .card { background:#1e293b; border:1px solid #334155; border-radius:24px; padding:36px; max-width:460px; width:100%; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.5); }
    .brand { display:inline-flex; align-items:center; gap:8px; padding:6px 14px; background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.3); border-radius:99px; color:#fb923c; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:16px; }
    h1 { font-size:22px; font-weight:900; margin-bottom:8px; }
    p.sub { font-size:13px; color:#94a3b8; margin-bottom:24px; }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:6px 16px; border-radius:99px; font-size:13px; font-weight:700; margin-bottom:24px; }
    .badge-connected { background:#065f46; color:#34d399; border:1px solid #059669; }
    .badge-scan { background:#78350f; color:#fcd34d; border:1px solid #d97706; }
    .badge-connecting { background:#1e3a8a; color:#93c5fd; border:1px solid #2563eb; }
    .qr-box { background:#ffffff; border-radius:20px; padding:16px; display:inline-block; margin-bottom:24px; box-shadow:0 10px 25px rgba(0,0,0,0.3); }
    .qr-box img { display:block; width:260px; height:260px; border-radius:8px; }
    .instructions { text-align:left; background:#0f172a; border:1px solid #334155; border-radius:16px; padding:18px; font-size:12px; color:#cbd5e1; line-height:1.6; margin-bottom:20px; }
    .instructions ol { padding-left:20px; }
    .instructions li { margin-bottom:6px; }
    .footer { font-size:11px; color:#64748b; }
    button { background:#ea580c; color:#fff; border:none; padding:10px 20px; border-radius:12px; font-weight:700; font-size:13px; cursor:pointer; transition:0.2s; }
    button:hover { background:#c2410c; }
  </style>
  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if ((data.connected && !${isConnected}) || (!data.connected && ${isConnected})) {
          location.reload();
        }
      } catch (e) {}
    }, 3000);
  </script>
</head>
<body>
  <div class="card">
    <div class="brand">🧵 Krish Clothing Co.</div>
    <h1>WhatsApp Dispatch Gateway</h1>
    <p class="sub">100% Free Self-Hosted Automated Messenger</p>

    ${
      isConnected
        ? `
        <div class="badge badge-connected">● CONNECTED (+${userPhone})</div>
        <div class="instructions" style="text-align:center;">
          <p style="font-size:14px; font-weight:700; color:#34d399; margin-bottom:8px;">✅ System Linked to WhatsApp Business</p>
          <p>Orders, Tax Invoices, and Reminders will dispatch automatically in background with PDF attachments.</p>
        </div>
        <form method="POST" action="/api/disconnect">
          <button type="submit" style="background:#dc2626;">Disconnect / Link Another Number</button>
        </form>
      `
        : `
        <div class="badge badge-scan">● ACTION REQUIRED: SCAN QR CODE</div>
        ${
          currentQrDataUrl
            ? `<div class="qr-box"><img src="${currentQrDataUrl}" alt="Scan QR Code" /></div>`
            : `<div style="padding:40px; color:#94a3b8;">Generating secure QR code...</div>`
        }
        <div class="instructions">
          <ol>
            <li>Open <strong>WhatsApp Business</strong> on phone (<strong>8128756632</strong>).</li>
            <li>Tap <strong>Settings / ⋮ Three Dots</strong> &gt; <strong>Linked Devices</strong>.</li>
            <li>Tap <strong>Link a Device</strong> and point your camera at this QR code.</li>
          </ol>
        </div>
        <p class="footer">QR Code updates automatically. Keep this tab open while scanning.</p>
      `
    }
  </div>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // 4. Send Message API
  if (req.method === "POST" && url.pathname === "/api/send") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        const { to, message } = data;

        if (!to || !message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'to' or 'message'" }));
          return;
        }

        if (connectionState !== "CONNECTED" || !sock) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "WhatsApp Gateway is not connected. Scan QR code first." }));
          return;
        }

        const jid = formatJid(to);
        const result = await sock.sendMessage(jid, { text: message });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, messageId: result?.key?.id, to: jid }));
      } catch (err) {
        console.error("Gateway send error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. Send Document (PDF) API
  if (req.method === "POST" && url.pathname === "/api/send-document") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        const { to, documentUrl, documentBase64, filename, caption } = data;

        if (!to || (!documentUrl && !documentBase64)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'to' or document payload" }));
          return;
        }

        if (connectionState !== "CONNECTED" || !sock) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "WhatsApp Gateway is not connected. Scan QR code first." }));
          return;
        }

        let docBuffer;
        if (documentBase64) {
          const cleanBase64 = documentBase64.replace(/^data:[^;]+;base64,/, "");
          docBuffer = Buffer.from(cleanBase64, "base64");
        } else if (documentUrl) {
          const resp = await fetch(documentUrl);
          if (!resp.ok) throw new Error(`Could not fetch PDF from URL: ${resp.statusText}`);
          docBuffer = Buffer.from(await resp.arrayBuffer());
        }

        const jid = formatJid(to);
        const safeFilename = (filename || "Invoice.pdf").replace(/[^\w.-]/g, "_");

        const result = await sock.sendMessage(jid, {
          document: docBuffer,
          mimetype: "application/pdf",
          fileName: safeFilename,
          caption: caption || "",
        });

        console.log(`✅ [GATEWAY] Dispatched PDF '${safeFilename}' directly to ${jid}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, messageId: result?.key?.id, filename: safeFilename, to: jid }));
      } catch (err) {
        console.error("Gateway document dispatch error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. Disconnect API
  if (req.method === "POST" && url.pathname === "/api/disconnect") {
    try {
      if (sock) {
        await sock.logout();
      }
    } catch {}
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    } catch {}
    connectedUser = null;
    connectionState = "DISCONNECTED";
    setTimeout(connectToWhatsApp, 1500);

    res.writeHead(302, { Location: "/qr" });
    res.end();
    return;
  }

  // 7. Settings API (GET / POST)
  if (url.pathname === "/api/settings") {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(loadSettings()));
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const patch = JSON.parse(body || "{}");
          const updated = saveSettings(patch);
          console.log("⚙️ [SETTINGS UPDATED]", updated);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, settings: updated }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // 8. Trigger Weekly Payment Reminders Job (POST)
  if (req.method === "POST" && url.pathname === "/api/cron/payment-reminders") {
    const result = await triggerWeeklyRemindersJob();
    res.writeHead(result.success ? 200 : 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🧵 KRISH CLOTHING CO. — FREE WHATSAPP GATEWAY`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📲 Scan QR Code at: http://localhost:${PORT}/qr`);
  console.log(`======================================================\n`);
});
