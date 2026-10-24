import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Central server-side secret key for signing sessions and 2FA tokens
const SECRET_KEY =
  process.env.SESSION_SECRET ||
  process.env.ADMIN_2FA_SECRET ||
  process.env.DATABASE_URL ||
  "krish-clothing-co-super-secure-production-secret-2026-fallback-key";

/**
 * Cryptographic Password & PIN Hashing using Node.js scrypt (NIST SP 800-132 / OWASP standard)
 * Stored format: scrypt:<salt_hex>:<hash_hex>
 */
export function hashPassword(plainText: string): string {
  if (!plainText) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(plainText.trim(), salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time verification of passwords and PINs.
 * Backward-compatible with existing plaintext credentials for seamless zero-downtime auto-migration.
 */
export function verifyPassword(plainText: string, storedValue: string | null | undefined): boolean {
  if (!storedValue || !plainText) return false;

  const cleanPlain = plainText.trim();
  const cleanStored = storedValue.trim();

  // 1. Check if storedValue is an scrypt hash
  if (cleanStored.startsWith("scrypt:")) {
    const parts = cleanStored.split(":");
    if (parts.length !== 3) return false;
    const [, salt, expectedHashHex] = parts;
    try {
      const derivedKey = crypto.scryptSync(cleanPlain, salt, 64);
      const keyBuffer = Buffer.from(derivedKey.toString("hex"), "hex");
      const expectedBuffer = Buffer.from(expectedHashHex, "hex");
      if (keyBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(keyBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  // 2. Backward compatibility with plaintext credentials using constant-time comparison
  try {
    const plainBuf = Buffer.from(cleanPlain);
    const storedBuf = Buffer.from(cleanStored);
    if (plainBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(plainBuf, storedBuf);
  } catch {
    return cleanPlain === cleanStored;
  }
}

/**
 * Cryptographically sign a JSON payload with HMAC-SHA256
 */
export function signToken(payload: Record<string, any>, expiresInSeconds: number = 60 * 60 * 24 * 7): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const data = JSON.stringify({ ...payload, exp: expiresAt });
  const dataBase64 = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataBase64)
    .digest("base64url");

  return `${dataBase64}.${signature}`;
}

/**
 * Verify HMAC-SHA256 signature and expiration
 */
export function verifyToken<T = any>(token: string | null | undefined): T | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) {
    // If legacy base64 without signature, strictly reject
    return null;
  }

  const [dataBase64, signature] = parts;

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataBase64)
    .digest("base64url");

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(dataBase64, "base64url").toString("utf-8"));
    if (data.exp && Date.now() > data.exp) {
      // Token has expired
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

/**
 * Validate Admin Session from Request Cookies
 */
export async function getAdminSession(req: NextRequest) {
  const cookie = req.cookies.get("iq_admin_session");
  if (!cookie?.value) return null;

  const decoded = verifyToken<{ username: string; id?: number }>(cookie.value);
  if (!decoded || !decoded.username) return null;

  try {
    const admin = await prisma.adminAccount.findUnique({
      where: { username: decoded.username },
      select: { id: true, username: true },
    });

    if (!admin) return null;

    // Super Admin is dynamically determined by the primary master admin account in database
    const primaryAdmin = await prisma.adminAccount.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });
    const isSuperAdmin = !primaryAdmin || admin.id === primaryAdmin.id;
    return {
      id: admin.id,
      username: admin.username,
      isSuperAdmin,
    };
  } catch {
    return null;
  }
}

/**
 * Validate Employee Session from Request Cookies
 */
export async function getEmployeeSession(req: NextRequest) {
  const cookie = req.cookies.get("garmentpro_emp_session");
  if (!cookie?.value) return null;

  const decoded = verifyToken<{ id: number; name: string }>(cookie.value);
  if (!decoded || !decoded.id) return null;

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        designation: true,
        isTeamLeader: true,
        canEditOrders: true,
        canUpdateStock: true,
        isActive: true,
      },
    });

    if (!employee || !employee.isActive) return null;

    return employee;
  } catch {
    return null;
  }
}

/**
 * Team Leader Permission Check:
 * "JUST TEAM LEADER CAN HAVE A LOOK I.E. KRISH SHAH NO OTHER T.L. CAN CHECK ANY OTHER EMPLOYEES DATA."
 */
export function isSpecialTeamLeaderKrishShah(
  emp: { name?: string | null; isTeamLeader?: boolean | null; designation?: string | null } | null | undefined
): boolean {
  if (!emp) return false;
  const name = (emp.name || "").trim().toLowerCase();
  const des = (emp.designation || "").trim().toLowerCase();
  const isTL =
    Boolean(emp.isTeamLeader) ||
    des === "t.l." ||
    des === "tl" ||
    des === "team leader" ||
    des.includes("team leader") ||
    des.includes("t.l.");
  return isTL && (name.includes("krish") || name === "krish shah");
}

/**
 * Middleware helper for Admin-only API routes
 */
export async function requireAdmin(req: NextRequest) {
  const admin = await getAdminSession(req);
  if (!admin) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Admin session required." },
        { status: 401 }
      ),
    };
  }
  return { authorized: true, user: admin };
}

/**
 * In-memory OTP failed attempt tracker to prevent brute-forcing
 */
const failedOtpAttempts: Record<string, { count: number; lockedUntil: number }> = {};

export function checkOtpRateLimit(key: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const record = failedOtpAttempts[key];

  if (record && record.lockedUntil > now) {
    const minutesLeft = Math.ceil((record.lockedUntil - now) / (60 * 1000));
    return {
      allowed: false,
      error: `Too many failed attempts. Account temporarily locked. Please try again in ${minutesLeft} minute(s).`,
    };
  }

  return { allowed: true };
}

export function recordFailedOtpAttempt(key: string): void {
  const now = Date.now();
  if (!failedOtpAttempts[key] || failedOtpAttempts[key].lockedUntil <= now) {
    failedOtpAttempts[key] = { count: 1, lockedUntil: 0 };
  } else {
    failedOtpAttempts[key].count += 1;
  }

  // Lock for 15 minutes after 5 failed attempts
  if (failedOtpAttempts[key].count >= 5) {
    failedOtpAttempts[key].lockedUntil = now + 15 * 60 * 1000;
  }
}

export function resetOtpAttempts(key: string): void {
  delete failedOtpAttempts[key];
}
