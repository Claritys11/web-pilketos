import type { NextConfig } from "next";
import { config } from "./src/config/env";

/**
 * Next.js 16 Configuration — Pilketos E-Voting System
 *
 * Security headers are defined here as a fallback for static routes.
 * The primary injection of security headers for dynamic routes happens
 * in src/middleware.ts (Edge Runtime), which runs first.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §Security Headers
 * Reference: 05_SECURITY.md §HTTP Security Headers
 */

const supabaseStoragePattern = new URL(config.supabase.url).hostname;

const nextConfig: NextConfig = {
  // -------------------------------------------------------------------------
  // React Compiler — enabled by default in Next.js 16
  // Optimizes re-renders automatically without manual memoization
  // -------------------------------------------------------------------------
  reactCompiler: true,

  // -------------------------------------------------------------------------
  // Image optimization — allow Supabase Storage as trusted image source
  // Reference: 05_SECURITY.md §Browser Security
  // -------------------------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseStoragePattern,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Security headers — applied to all routes via next.config
  // Note: middleware.ts overrides these for more granular control on /admin/*
  // Reference: 05_SECURITY.md §HTTP Security Headers
  // -------------------------------------------------------------------------
  async headers() {
    const supabaseUrl = config.supabase.url;

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${supabaseUrl}`,
              `connect-src 'self' ${supabaseUrl}`,
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
