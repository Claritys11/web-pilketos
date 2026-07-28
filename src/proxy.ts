import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { config as appConfig } from "@/config/env";

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
} as const;

function buildContentSecurityPolicy(): string {
  const scriptSrc = appConfig.app.isDevelopment
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self'";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${appConfig.supabase.url}`,
    `connect-src 'self' ${appConfig.supabase.url}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());

  if (appConfig.app.isProduction) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
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
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApiRoute = pathname.startsWith("/api/admin");
  const isLoginPage = pathname === "/admin/login";

  if (!isAdminRoute && !isAdminApiRoute) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (isLoginPage) {
    return withSecurityHeaders(NextResponse.next());
  }

  const token = await getToken({
    req: request,
    secret: appConfig.auth.secret,
    secureCookie: appConfig.app.isProduction,
  });

  if (!token?.id) {
    return withSecurityHeaders(unauthorized(request));
  }

  if (pathname.startsWith("/admin/settings") && token.role !== "SUPER_ADMIN") {
    return withSecurityHeaders(forbidden(request));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
