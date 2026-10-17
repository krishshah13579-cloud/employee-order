import { NextRequest, NextResponse } from "next/server";

/**
 * Global Anti-Traversal & Anti-Crawling Security Middleware
 * Prevents directory traversal attacks (e.g. ../../../, %2e%2e, null bytes)
 * and blocks unauthorized crawling into sensitive system files/folders.
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

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const rawPath = url.pathname;
  const rawSearch = url.search;
  const fullUrl = request.url;

  // 1. Check raw path and search for traversal sequences
  const isTraversal = TRAVERSAL_PATTERNS.some(
    (pattern) => pattern.test(rawPath) || pattern.test(rawSearch) || pattern.test(fullUrl)
  );

  if (isTraversal) {
    console.warn(`[SECURITY ALERT] Blocked directory traversal attempt: ${request.method} ${fullUrl} from IP: ${request.headers.get("x-forwarded-for") || "unknown"}`);
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
          },
        }
      );
    }
  } catch (err) {
    // Malformed URI encoding is suspicious
    return new NextResponse("Bad Request: Malformed URI sequence", { status: 400 });
  }

  // Add security headers to response
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
