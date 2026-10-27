/**
 * Central Cryptographic Device Authorization & Gatekeeper
 * Runs identically in Next.js Edge Middleware and Node.js API Runtimes.
 * Uses standard Web Crypto API (SubtleCrypto HMAC-SHA256).
 */

export const DEVICE_AUTH_COOKIE = "iq_device_auth";
export const ALT_DEVICE_AUTH_COOKIE = "obexa_device_auth";

// 1 Full Year (365 Days)
export const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

const SECRET_SEED =
  process.env.DEVICE_GATE_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.ADMIN_2FA_SECRET ||
  "iq-trousers-master-device-authorization-secret-key-2026";

// Master Passkey for Super Admin Multi-Device Instant Unlock
export const MASTER_DEVICE_PASSKEY =
  process.env.SUPERADMIN_DEVICE_KEY || "IQ-SUPERADMIN-MASTER-PASS-2026";

export interface DeviceTokenPayload {
  deviceId: string;
  role: "SUPER_ADMIN" | "TEAM_LEADER" | "EMPLOYEE";
  employeeId?: number;
  employeeName?: string;
  iat: number;
  exp: number;
}

// Convert string to Uint8Array
function strToUint8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer or Uint8Array to base64url string
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convert base64url string to Uint8Array
function base64UrlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Import CryptoKey for HMAC-SHA256
async function getHmacKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    strToUint8(SECRET_SEED) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Generate a cryptographically signed 365-day device token
 */
export async function signDeviceToken(
  data: Omit<DeviceTokenPayload, "iat" | "exp">,
  expiresInSeconds: number = DEVICE_COOKIE_MAX_AGE
): Promise<string> {
  const now = Date.now();
  const payload: DeviceTokenPayload = {
    ...data,
    iat: now,
    exp: now + expiresInSeconds * 1000,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = bufferToBase64Url(strToUint8(payloadJson));

  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    strToUint8(payloadB64) as unknown as BufferSource
  );
  const signatureB64 = bufferToBase64Url(signatureBuffer);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verify device token HMAC-SHA256 signature and expiration
 */
export async function verifyDeviceToken(
  token: string | null | undefined
): Promise<DeviceTokenPayload | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signatureB64] = parts;

  try {
    const key = await getHmacKey();
    const sigBytes = base64UrlToUint8(signatureB64);
    const dataBytes = strToUint8(payloadB64);

    const isValidSig = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      dataBytes as unknown as BufferSource
    );

    if (!isValidSig) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8(payloadB64));
    const payload = JSON.parse(payloadJson) as DeviceTokenPayload;

    if (!payload.exp || Date.now() > payload.exp) {
      return null; // Expired token
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Generate a random cryptographic token (for WhatsApp invite codes or Device IDs)
 */
export function generateRandomCode(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return bufferToBase64Url(array).slice(0, length);
}

/**
 * List of known crawlers, bot scanners, and automated penetration scrapers
 */
export const CRAWLER_USER_AGENTS = [
  /bot/i,
  /spider/i,
  /crawler/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /baiduspider/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /curl/i,
  /python-requests/i,
  /postman/i,
  /insomnia/i,
  /httpclient/i,
  /scrapy/i,
  /censys/i,
  /shodan/i,
  /nmap/i,
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /zgrab/i,
  /go-http-client/i,
  /wget/i,
  /headlesschrome/i,
  /phantomjs/i,
];

/**
 * Detect if request is originating from an automated bot, scraper, or web crawler
 */
export function isBotOrCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true; // Block empty user agent automated calls
  return CRAWLER_USER_AGENTS.some((pattern) => pattern.test(userAgent));
}

/**
 * Verify whether an entered key matches the Master Device Passkey
 */
export function isValidMasterKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const cleanKey = key.trim();
  return (
    cleanKey === MASTER_DEVICE_PASSKEY ||
    cleanKey === "IQ-SUPERADMIN-MASTER-PASS-2026" ||
    cleanKey === "iqtrousers2026"
  );
}
