/**
 * Centralized, hardcoded navigation constants and security sanitizers for cross-page parameters.
 * Guarantees zero open redirects, prevents IDOR/injection, and ensures reliable state passing.
 */

// Hardcoded Query Parameter Names
export const PARAM_CUSTOMER_ID = "customerId" as const;
export const PARAM_BUSINESS_TYPE = "businessType" as const;
export const PARAM_RETURN_TO = "returnTo" as const;

// Hardcoded LocalStorage Keys
export const STORAGE_KEY_ORDER_DRAFT = "garmentpro_order_draft" as const;
export const STORAGE_KEY_SELECTED_CUSTOMER = "garmentpro_selected_customer_id" as const;
export const STORAGE_KEY_EMPLOYEE_NAME = "garmentpro_employee_name" as const;

// Hardcoded Allowed Application Routes
export const APP_ROUTES = {
  HOME: "/",
  ORDERS_NEW: "/orders/new",
  PRODUCTS: "/products",
  CHECKOUT: "/checkout",
  CUSTOMERS_NEW: "/customers/new",
  ORDERS: "/orders",
} as const;

// Allowed Business Types Whitelist
export const VALID_BUSINESS_TYPES = [
  "RETAILER",
  "RETAILER WITH SPECIAL DISCOUNT",
  "WHOLESALER",
  "WHOLESALER WITHOUT GST",
] as const;

export type ValidBusinessType = (typeof VALID_BUSINESS_TYPES)[number];

/**
 * Sanitizes and validates internal redirect paths (returnTo).
 * Strictly rejects external URLs, protocol-relative URLs (//), and javascript: schemes.
 */
export function sanitizeInternalReturnTo(
  rawUrl: string | null | undefined,
  fallback: string = APP_ROUTES.ORDERS_NEW
): string {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();

  // Must begin with a single slash, never double slash, never backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  // Check that no colon occurs before any query string (prevents javascript: or data:)
  const pathPart = trimmed.split("?")[0];
  if (pathPart.includes(":")) {
    return fallback;
  }

  // Whitelist check: pathPart must match known application routes
  const allowedPrefixes = [
    APP_ROUTES.ORDERS_NEW,
    APP_ROUTES.PRODUCTS,
    APP_ROUTES.CHECKOUT,
    APP_ROUTES.CUSTOMERS_NEW,
    APP_ROUTES.ORDERS,
  ];

  const isAllowed =
    pathPart === APP_ROUTES.HOME ||
    allowedPrefixes.some((prefix) => pathPart === prefix || pathPart.startsWith(prefix + "/"));

  return isAllowed ? trimmed : fallback;
}

/**
 * Validates and parses positive integer IDs (e.g. customerId, productId).
 */
export function sanitizePositiveInt(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    return Number.isSafeInteger(val) && val > 0 ? val : null;
  }
  const clean = String(val).trim();
  if (!/^\d+$/.test(clean)) return null;
  const parsed = parseInt(clean, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Validates businessType against strict whitelist.
 */
export function sanitizeBusinessType(val: string | null | undefined): ValidBusinessType | null {
  if (!val || typeof val !== "string") return null;
  const upper = val.trim().toUpperCase();
  if (VALID_BUSINESS_TYPES.includes(upper as ValidBusinessType)) {
    return upper as ValidBusinessType;
  }
  if (upper.includes("WITHOUT GST") || upper.includes("NO GST")) {
    return "WHOLESALER WITHOUT GST";
  }
  if (upper.includes("SPECIAL DISCOUNT")) {
    return "RETAILER WITH SPECIAL DISCOUNT";
  }
  if (upper.includes("WHOLESALE")) {
    return "WHOLESALER";
  }
  return null;
}

/**
 * Safely constructs the Order Form return URL with encoded customer parameter.
 */
export function buildOrderFormReturnUrl(customerId?: number | null): string {
  const safeId = sanitizePositiveInt(customerId);
  if (safeId) {
    return `${APP_ROUTES.ORDERS_NEW}?${PARAM_CUSTOMER_ID}=${safeId}`;
  }
  return APP_ROUTES.ORDERS_NEW;
}
