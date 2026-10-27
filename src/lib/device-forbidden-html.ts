/**
 * High-Security 403 Forbidden HTML Template for Unauthorized Devices
 * Rendered directly by Next.js Edge Middleware with zero external dependencies.
 */

export function renderForbiddenPage(clientIp: string, userAgent: string, requestUrl: string): string {
  // Sanitize inputs for HTML rendering
  const safeIp = clientIp.replace(/[^a-zA-Z0-9.:_-]/g, "") || "Unknown IP";
  const safeUa = userAgent.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 120);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>403 Forbidden — Access Restricted | IQ TROUSERS</title>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      max-width: 520px;
      width: 100%;
      padding: 36px 28px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ef4444, #f97316, #ef4444);
    }
    .shield-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 20px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ef4444;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border-radius: 9999px;
      margin-bottom: 16px;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    p {
      color: #9ca3af;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .meta-box {
      background: #1f2937;
      border-radius: 10px;
      padding: 14px 16px;
      text-align: left;
      font-size: 12px;
      margin-bottom: 24px;
      border: 1px solid #374151;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      color: #9ca3af;
    }
    .meta-val {
      color: #e5e7eb;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 260px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      border: none;
      width: 100%;
    }
    .btn-primary {
      background: #ea580c;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #c2410c;
    }
    .btn-secondary {
      background: #374151;
      color: #d1d5db;
    }
    .btn-secondary:hover {
      background: #4b5563;
      color: #ffffff;
    }
    .btn-ghost {
      background: transparent;
      color: #9ca3af;
      font-size: 12px;
      padding: 8px;
    }
    .btn-ghost:hover {
      color: #f3f4f6;
    }
    /* Modal styles */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 999;
    }
    .modal-box {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 12px;
      max-width: 400px;
      width: 100%;
      padding: 24px;
      text-align: left;
    }
    .input-field {
      width: 100%;
      background: #1f2937;
      border: 1px solid #4b5563;
      border-radius: 6px;
      padding: 10px 14px;
      color: #ffffff;
      font-size: 14px;
      margin-top: 10px;
      margin-bottom: 16px;
      outline: none;
    }
    .input-field:focus {
      border-color: #ea580c;
    }
    .modal-actions {
      display: flex;
      gap: 10px;
    }
    .alert-msg {
      margin-top: 12px;
      padding: 10px;
      border-radius: 6px;
      font-size: 13px;
      display: none;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #6ee7b7;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid #ef4444;
      color: #fca5a5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="shield-icon">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>

    <span class="badge">403 Forbidden • Device Gate</span>
    <h1>Access Restricted</h1>
    <p>
      This terminal is not an authorized company device. Access to <strong>employee.iqtrousers.in</strong> is strictly reserved for verified employee phones and administrator devices.
    </p>

    <div class="meta-box">
      <div class="meta-row">
        <span class="meta-label">Client IP:</span>
        <span class="meta-val">${safeIp}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">User Agent:</span>
        <span class="meta-val" title="${safeUa}">${safeUa}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Security Protocol:</span>
        <span class="meta-val" style="color: #10b981;">HMAC-SHA256 Hardware Lock</span>
      </div>
    </div>

    <div id="requestAlert" class="alert-msg"></div>

    <div class="actions">
      <button class="btn btn-primary" onclick="openMasterModal()">
        🔑 Super Admin / Activation Unlock
      </button>
      <button class="btn btn-secondary" onclick="requestAccess()">
        📲 Request Device Approval
      </button>
      <span class="btn-ghost">
        Super Admin: Enter passkey • Employee: Enter WhatsApp code
      </span>
    </div>
  </div>

  <!-- Device Instant Unlock Modal -->
  <div id="masterModal" class="modal-overlay">
    <div class="modal-box">
      <h3 style="color:#ffffff;font-size:18px;margin-bottom:8px;">Instant Device Unlock</h3>
      <p style="font-size:13px;color:#9ca3af;margin-bottom:12px;">
        Authorize this device for 365 Days using your Super Admin Master Passkey or your WhatsApp Activation Code.
      </p>

      <label style="font-size:12px;color:#d1d5db;font-weight:600;">Device Name / Label:</label>
      <input type="text" id="deviceNameInput" class="input-field" placeholder="e.g. iPhone, MacBook Pro, Office PC" value="Authorized Device">

      <label style="font-size:12px;color:#d1d5db;font-weight:600;">Master Passkey or WhatsApp Activation Code:</label>
      <input type="password" id="masterKeyInput" class="input-field" placeholder="Paste Master Passkey or WhatsApp Code">

      <div id="modalAlert" class="alert-msg"></div>

      <div class="modal-actions">
        <button class="btn btn-primary" id="btnConfirmUnlock" onclick="submitMasterUnlock()">
          Authorize Device
        </button>
        <button class="btn btn-secondary" onclick="closeMasterModal()">
          Cancel
        </button>
      </div>
    </div>
  </div>

  <script>
    function openMasterModal() {
      document.getElementById('masterModal').style.display = 'flex';
      document.getElementById('masterKeyInput').focus();
    }

    function closeMasterModal() {
      document.getElementById('masterModal').style.display = 'none';
      document.getElementById('modalAlert').style.display = 'none';
    }

    async function requestAccess() {
      const alertBox = document.getElementById('requestAlert');
      alertBox.className = 'alert-msg alert-success';
      alertBox.textContent = 'Submitting device approval request...';
      alertBox.style.display = 'block';

      try {
        const res = await fetch('/api/auth/device-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: window.location.href,
            referrer: document.referrer
          })
        });
        const data = await res.json();
        if (res.ok) {
          alertBox.textContent = 'Device authorization request logged. Please ask the Administrator to send your WhatsApp activation link.';
        } else {
          alertBox.className = 'alert-msg alert-error';
          alertBox.textContent = data.error || 'Failed to submit request.';
        }
      } catch (err) {
        alertBox.textContent = 'Device request logged. Ask Super Admin to send your WhatsApp authorization link.';
      }
    }

    async function submitMasterUnlock() {
      const passkey = document.getElementById('masterKeyInput').value.trim();
      const devName = document.getElementById('deviceNameInput').value.trim() || 'Admin Device';
      const alertBox = document.getElementById('modalAlert');
      const confirmBtn = document.getElementById('btnConfirmUnlock');

      if (!passkey) {
        alertBox.className = 'alert-msg alert-error';
        alertBox.textContent = 'Please enter your Super Admin Master Passkey.';
        alertBox.style.display = 'block';
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Verifying...';

      try {
        const res = await fetch('/api/auth/device-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterKey: passkey,
            deviceName: devName
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alertBox.className = 'alert-msg alert-success';
          alertBox.textContent = 'Device authorized successfully! Redirecting...';
          alertBox.style.display = 'block';
          setTimeout(() => {
            window.location.href = data.redirectUrl || '/admin/login';
          }, 800);
        } else {
          alertBox.className = 'alert-msg alert-error';
          alertBox.textContent = data.error || 'Invalid Master Passkey.';
          alertBox.style.display = 'block';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Authorize Device';
        }
      } catch (err) {
        alertBox.className = 'alert-msg alert-error';
        alertBox.textContent = 'Network error while unlocking device: ' + err.message;
        alertBox.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Authorize Device';
      }
    }
  </script>
</body>
</html>`;
}
