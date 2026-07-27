/**
 * Configuration Layer — Centralized Environment Variable Validation
 *
 * THIS IS THE ONLY FILE IN THE CODEBASE THAT MAY ACCESS process.env.
 * All other modules must import from this file.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §Configuration Layer
 * Reference: 02_SYSTEM_ARCHITECTURE.md §Environment Variables (Required)
 *
 * Behavior:
 *   - Validates all required env vars at module load time using Zod.
 *   - Throws a descriptive error at startup (not at runtime) if any are missing.
 *   - Exports a fully-typed, immutable config object.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),

  // Auth (NextAuth / Auth.js v5)
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),

  // Voting token security
  TOKEN_HMAC_SECRET: z
    .string()
    .min(32, "TOKEN_HMAC_SECRET must be at least 32 characters (256-bit)"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
  APP_VERSION: z.string().default("0.1.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// ---------------------------------------------------------------------------
// Validation — throw immediately if misconfigured
// ---------------------------------------------------------------------------

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  const errors = _parsed.error.flatten().fieldErrors;
  const missing = Object.entries(errors)
    .map(([key, messages]) => `  ${key}: ${(messages ?? []).join(", ")}`)
    .join("\n");

  throw new Error(
    `\n[Pilketos] Invalid environment configuration.\n` +
      `Fix the following before starting the server:\n\n${missing}\n\n` +
      `Copy .env.example to .env.local and fill in all values.\n`,
  );
}

const _env = _parsed.data;

// ---------------------------------------------------------------------------
// Typed config export — grouped by concern
// ---------------------------------------------------------------------------

export const config = {
  /**
   * Database connection strings for Prisma.
   * DATABASE_URL uses connection pooling (Supabase pooler).
   * DIRECT_URL bypasses pooling — required for migrations.
   */
  database: {
    url: _env.DATABASE_URL,
    directUrl: _env.DIRECT_URL,
  },

  /**
   * Auth.js (NextAuth) v5 configuration.
   */
  auth: {
    secret: _env.AUTH_SECRET,
    url: _env.NEXTAUTH_URL,
  },

  /**
   * HMAC-SHA256 secret for deterministic token hashing.
   * Changing this invalidates ALL existing voting tokens.
   * Reference: 05_SECURITY.md §HMAC Token Security
   */
  token: {
    hmacSecret: _env.TOKEN_HMAC_SECRET,
  },

  /**
   * Supabase credentials.
   * serviceRoleKey bypasses RLS — must NEVER reach the browser.
   * Reference: 02_SYSTEM_ARCHITECTURE.md §Environment Variables
   */
  supabase: {
    url: _env.SUPABASE_URL,
    anonKey: _env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: _env.SUPABASE_SERVICE_ROLE_KEY,
  },

  /**
   * General application settings.
   */
  app: {
    publicUrl: _env.NEXT_PUBLIC_APP_URL,
    version: _env.APP_VERSION,
    nodeEnv: _env.NODE_ENV,
    isDevelopment: _env.NODE_ENV === "development",
    isProduction: _env.NODE_ENV === "production",
    isTest: _env.NODE_ENV === "test",
  },
} as const;

/**
 * Inferred type of the validated config.
 * Useful for typing function parameters that receive config slices.
 */
export type Config = typeof config;
