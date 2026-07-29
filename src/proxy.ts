import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { config as appConfig } from "@/config/env";

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;

const RATE_LIMITS = [
  {
    name: "admin-login",
    matches: (pathname: string) =>
      pathname === "/api/auth/signin" || pathname === "/api/auth/callback/credentials",
    limit: 5,
    windowMs: 15 * 60_000,
  },
  {
    name: "vote-validate",
    matches: (pathname: string) => pathname === "/api/vote/validate-token",
    limit: 10,
    windowMs: 60_000,
  },
  {
    name: "vote-cast",
    matches: (pathname: string) => pathname === "/api/vote/cast",
    limit: 20,
    windowMs: 60_000,
  },
] as const;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const isSecureAuthUrl = appConfig.auth.url.startsWith("https://");

function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function buildContentSecurityPolicy(nonce: string): string {
  const scriptSrc = appConfig.app.isDevelopment
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${appConfig.supabase.url}`,
    `connect-src 'self' ${appConfig.supabase.url}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isSecureAuthUrl ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function withSecurityHeaders(response: NextResponse, contentSecurityPolicy: string): NextResponse {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

function continueWithSecurityHeaders(
  request: NextRequest,
  nonce: string,
  contentSecurityPolicy: string,
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  return withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    contentSecurityPolicy,
  );
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Terlalu banyak percobaan. Coba lagi beberapa saat.",
        details: null,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function checkRateLimit(request: NextRequest): NextResponse | null {
  if (request.method !== "POST") {
    return null;
  }

  const rule = RATE_LIMITS.find((item) => item.matches(request.nextUrl.pathname));
  if (!rule) {
    return null;
  }

  const now = Date.now();
  const key = `${rule.name}:${getClientIp(request)}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs });
    return null;
  }

  entry.count += 1;

  if (rateLimitStore.size > 5_000) {
    for (const [storeKey, storeEntry] of rateLimitStore.entries()) {
      if (storeEntry.resetAt <= now) {
        rateLimitStore.delete(storeKey);
      }
    }
  }

  if (entry.count > rule.limit) {
    return tooManyRequests(Math.ceil((entry.resetAt - now) / 1000));
  }

  return null;
}

function unauthorized(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Tidak terautentikasi.",
          details: null,
        },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function forbidden(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Kamu tidak memiliki izin untuk mengakses resource ini.",
          details: null,
        },
      },
      { status: 403 },
    );
  }

  return new NextResponse("Akses ditolak.", { status: 403 });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const nonce = createNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const rateLimited = checkRateLimit(request);

  if (rateLimited) {
    return withSecurityHeaders(rateLimited, contentSecurityPolicy);
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApiRoute = pathname.startsWith("/api/admin");
  const isLoginPage = pathname === "/admin/login";

  if (!isAdminRoute && !isAdminApiRoute) {
    return continueWithSecurityHeaders(request, nonce, contentSecurityPolicy);
  }

  if (isLoginPage) {
    return continueWithSecurityHeaders(request, nonce, contentSecurityPolicy);
  }

  const token = await getToken({
    req: request,
    secret: appConfig.auth.secret,
    secureCookie: isSecureAuthUrl,
  });

  if (!token?.id) {
    return withSecurityHeaders(unauthorized(request), contentSecurityPolicy);
  }

  if (pathname.startsWith("/admin/settings") && token.role !== "SUPER_ADMIN") {
    return withSecurityHeaders(forbidden(request), contentSecurityPolicy);
  }

  return continueWithSecurityHeaders(request, nonce, contentSecurityPolicy);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
