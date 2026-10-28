import { NextRequest, NextResponse } from "next/server";
import {
  DEVICE_AUTH_COOKIE,
  ALT_DEVICE_AUTH_COOKIE,
  verifyDeviceToken,
  isBotOrCrawler,
} from "@/lib/device-gate";
import { renderForbiddenPage } from "@/lib/device-forbidden-html";

/**
 * Global Enterprise Security Middleware for employee.iqtrousers.in:
 * 1. Directory traversal & path injection protection
 * 2. Search engine & automated crawler/bot blackout (robots / noindex / 403)
 * 3. Cryptographic Hardware/Device Gatekeeper (Restricted Terminal Lock)
 */

// Patterns indicating directory traversal or malicious climbing attempts
const TRAVERSAL_PATTERNS = [
  /\.\./,                  // Direct ".."
  /\.\.[\/\\]/,            // "../" or "..\"
  /%2e%2e/i,               // Encoded ".."
  /%252e%252e/i,           // Double encoded ".."
  /%c0%ae%c0%ae/i,         // UTF-8 overlong ".."
  /\.\.%2f/i,              // "..%2f"
  /\.\.%5c/i,              // "..%5c"
  /%2e%2e%2f/i,            // "%2e%2e%2f"
  /%2e%2e%5c/i,            // "%2e%2e%5c"
  /%252f/i,                // Double-encoded "/"
  /%255c/i,                // Double-encoded "\"
  /%00/,                   // Null byte
  /\0/,                    // Null character
];

// Sensitive files/folders that should never be crawled or accessed directly
const RESTRICTED_TARGETS = [
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.svn/i,
  /^\/\.htaccess/i,
  /^\/\.htpasswd/i,
  /^\/etc\//i,
  /^\/proc\//i,
  /^\/windows\//i,
  /^\/package\.json/i,
  /^\/package-lock\.json/i,
  /^\/tsconfig\.json/i,
  /^\/prisma\//i,
  /^\/scripts\//i,
  /^\/node_modules\//i,
  /^\/\.system_generated/i,
  /^\/\.vercel/i,
  /\.(db|sqlite|sqlite3|sql|pem|key|crt|bak|config)$/i,
];

// Public whitelist: paths that do NOT require a device cookie to load
const PUBLIC_WHITELIST = [
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/manifest\.json$/,
  /^\/manifest-admin\.json$/,
  /^\/sw\.js$/,
  /^\/apple-touch-icon\.png$/,
  /^\/icon-192\.png$/,
  /^\/icon-512\.png$/,
  /^\/auth\/access/,
  /^\/api\/auth\/device-unlock/,
  /^\/api\/auth\/device-request/,
  /^\/api\/auth\/device-verify/,
  /^\/api\/webhook/,
];

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const rawPath = url.pathname;
  const rawSearch = url.search;
  const fullUrl = request.url;
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                   request.headers.get("x-real-ip") ||
                   "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  const host = request.headers.get("host") || "";

  // 0. Internal Docker & Coolify Container Healthcheck
  const isInternalLocalhost =
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1");

  if (isInternalLocalhost && (rawPath === "/" || rawPath === "/api/health")) {
    return new NextResponse("OK", { status: 200 });
  }

  // 1. Check raw path and search for traversal sequences
  const isTraversal = TRAVERSAL_PATTERNS.some(
    (pattern) => pattern.test(rawPath) || pattern.test(rawSearch) || pattern.test(fullUrl)
  );

  if (isTraversal) {
    console.warn(`[SECURITY ALERT] Blocked directory traversal attempt: ${request.method} ${fullUrl} from IP: ${clientIp}`);
    return new NextResponse(
      JSON.stringify({
        error: "Forbidden",
        message: "Access Denied: Directory traversal / path crawling is strictly prohibited.",
        statusCode: 403,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
        },
      }
    );
  }

  // 2. Try URL decoding to catch nested or obfuscated traversal
  try {
    const decodedPath = decodeURIComponent(rawPath);
    const decodedSearch = decodeURIComponent(rawSearch);

    const isDecodedTraversal = TRAVERSAL_PATTERNS.some(
      (pattern) => pattern.test(decodedPath) || pattern.test(decodedSearch)
    );

    if (isDecodedTraversal) {
      console.warn(`[SECURITY ALERT] Blocked decoded traversal attempt: ${rawPath}`);
      return new NextResponse(
        JSON.stringify({
          error: "Forbidden",
          message: "Access Denied: Encoded directory traversal is prohibited.",
          statusCode: 403,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
          },
        }
      );
    }

    // 3. Check for restricted system files and folders
    const isRestrictedTarget = RESTRICTED_TARGETS.some(
      (target) => target.test(decodedPath) || target.test(rawPath)
    );

    if (isRestrictedTarget) {
      console.warn(`[SECURITY ALERT] Blocked sensitive file access attempt: ${decodedPath}`);
      return new NextResponse(
        JSON.stringify({
          error: "Forbidden",
          message: "Access to protected system resources is denied.",
          statusCode: 403,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
          },
        }
      );
    }
  } catch (err) {
    return new NextResponse("Bad Request: Malformed URI sequence", { status: 400 });
  }

  // 4. Check Public Whitelist (Assets & Device Authentication Endpoints)
  // Evaluated before bot blocking so Chrome WebAPK minting and PWA service workers can fetch assets without 403
  const isWhitelisted = PUBLIC_WHITELIST.some((pattern) => pattern.test(rawPath));
  if (isWhitelisted) {
    if (rawPath === "/manifest.json" && request.headers.get("referer")?.includes("/admin")) {
      return applySecurityHeaders(NextResponse.rewrite(new URL("/manifest-admin.json", request.url)), request);
    }
    return applySecurityHeaders(NextResponse.next(), request);
  }

  // 5. Block Automated Bots, Crawlers, and Scrapers (Total Bot Blackout)
  if (isBotOrCrawler(userAgent)) {
    return new NextResponse(
      JSON.stringify({
        error: "Forbidden",
        message: "403 Forbidden: Automated crawlers, scrapers, and bot agents are strictly blocked on employee.iqtrousers.in.",
        statusCode: 403,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
        },
      }
    );
  }

  // 6. Device Authorization Gate Check
  const deviceCookie =
    request.cookies.get(DEVICE_AUTH_COOKIE)?.value ||
    request.cookies.get(ALT_DEVICE_AUTH_COOKIE)?.value;

  const validDevice = await verifyDeviceToken(deviceCookie);

  if (!validDevice) {
    // Missing or invalid device token: strictly block with 403 Forbidden
    if (rawPath.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({
          error: "Forbidden",
          message: "403 Forbidden: Unauthorized device. Terminal access restricted to approved company devices.",
          statusCode: 403,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
          },
        }
      );
    }

    // For web browser navigation: render sleek 403 Forbidden page
    const html = renderForbiddenPage(clientIp, userAgent, fullUrl);
    return new NextResponse(html, {
      status: 403,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      },
    });
  }

  // Authorized device: allow request to proceed with all security headers
  return applySecurityHeaders(NextResponse.next(), request);
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex");

  if (request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Download-Options", "noopen");

  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "connect-src 'self' https: http: wss: ws:",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
