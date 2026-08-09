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
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  STORAGE_DRIVER: z.enum(["local", "supabase"]).optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
  APP_VERSION: z.string().default("0.1.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Mail
  EMAIL_DRIVER: z.enum(["smtp", "gmail_api", "none"]).default("smtp"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().url().optional(),
  GMAIL_FROM: z.string().optional(),
  GMAIL_SECONDARY_CLIENT_ID: z.string().optional(),
  GMAIL_SECONDARY_CLIENT_SECRET: z.string().optional(),
  GMAIL_SECONDARY_REFRESH_TOKEN: z.string().optional(),
  GMAIL_SECONDARY_FROM: z.string().optional(),
  TOKEN_EMAIL_SENDS_PER_MINUTE: z.coerce.number().int().min(1).max(100).default(50),

  // Google Sheets sync
  GOOGLE_SHEETS_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_SHEET_NAME: z.string().optional(),
  GOOGLE_SHEETS_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation — throw immediately if misconfigured
// ---------------------------------------------------------------------------

const isSkippingEnvValidation = process.env.SKIP_ENV_VALIDATION === "1";
const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success && !isSkippingEnvValidation) {
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

const _env = _parsed.success
  ? _parsed.data
  : ({
      DATABASE_URL: "postgresql://dummy:dummy@localhost:5432/dummy",
      DIRECT_URL: "postgresql://dummy:dummy@localhost:5432/dummy",
      AUTH_SECRET: "dummy_secret_32_chars_long_12345678",
      NEXTAUTH_URL: "http://localhost:6500",
      TOKEN_HMAC_SECRET: "dummy_secret_32_chars_long_12345678",
      SUPABASE_URL: "https://xyzabcdef.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dummy_anon_key",
      SUPABASE_SERVICE_ROLE_KEY: "dummy_service_key",
      STORAGE_DRIVER: "local",
      NEXT_PUBLIC_APP_URL: "http://localhost:6500",
      APP_VERSION: "0.1.0",
      NODE_ENV: "production",
      EMAIL_DRIVER: "none",
      SMTP_HOST: undefined,
      SMTP_PORT: undefined,
      SMTP_SECURE: undefined,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
      SMTP_FROM: undefined,
      GMAIL_CLIENT_ID: undefined,
      GMAIL_CLIENT_SECRET: undefined,
      GMAIL_REFRESH_TOKEN: undefined,
      GMAIL_REDIRECT_URI: undefined,
      GMAIL_FROM: undefined,
      GMAIL_SECONDARY_CLIENT_ID: undefined,
      GMAIL_SECONDARY_CLIENT_SECRET: undefined,
      GMAIL_SECONDARY_REFRESH_TOKEN: undefined,
      GMAIL_SECONDARY_FROM: undefined,
      TOKEN_EMAIL_SENDS_PER_MINUTE: 50,
      GOOGLE_SHEETS_ENABLED: false,
      GOOGLE_SHEETS_SPREADSHEET_ID: undefined,
      GOOGLE_SHEETS_SHEET_NAME: undefined,
      GOOGLE_SHEETS_CLIENT_EMAIL: undefined,
      GOOGLE_SHEETS_PRIVATE_KEY: undefined,
      GOOGLE_OAUTH_CLIENT_ID: undefined,
      GOOGLE_OAUTH_CLIENT_SECRET: undefined,
      GOOGLE_OAUTH_REFRESH_TOKEN: undefined,
    } as unknown as z.infer<typeof envSchema>);

if (isSkippingEnvValidation && configIsRuntime()) {
  throw new Error("[Pilketos] SKIP_ENV_VALIDATION is only allowed during build-time validation.");
}

function configIsRuntime() {
  return (
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.npm_lifecycle_event !== "build"
  );
}

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

  storage: {
    driver: _env.STORAGE_DRIVER ?? (_env.NODE_ENV === "production" ? "supabase" : "local"),
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

  mail: {
    driver: _env.EMAIL_DRIVER,
    smtpHost: _env.SMTP_HOST,
    smtpPort: _env.SMTP_PORT,
    smtpSecure: _env.SMTP_SECURE ?? false,
    smtpUser: _env.SMTP_USER,
    smtpPassword: _env.SMTP_PASSWORD,
    from: _env.SMTP_FROM,
    gmailClientId: _env.GMAIL_CLIENT_ID,
    gmailClientSecret: _env.GMAIL_CLIENT_SECRET,
    gmailRefreshToken: _env.GMAIL_REFRESH_TOKEN,
    gmailRedirectUri: _env.GMAIL_REDIRECT_URI,
    gmailFrom: _env.GMAIL_FROM,
    gmailProviders: [
      _env.GMAIL_CLIENT_ID &&
      _env.GMAIL_CLIENT_SECRET &&
      _env.GMAIL_REFRESH_TOKEN &&
      _env.GMAIL_FROM
        ? {
            name: "primary",
            clientId: _env.GMAIL_CLIENT_ID,
            clientSecret: _env.GMAIL_CLIENT_SECRET,
            refreshToken: _env.GMAIL_REFRESH_TOKEN,
            from: _env.GMAIL_FROM,
          }
        : null,
      _env.GMAIL_SECONDARY_CLIENT_ID &&
      _env.GMAIL_SECONDARY_CLIENT_SECRET &&
      _env.GMAIL_SECONDARY_REFRESH_TOKEN &&
      (_env.GMAIL_SECONDARY_FROM || _env.GMAIL_FROM)
        ? {
            name: "secondary",
            clientId: _env.GMAIL_SECONDARY_CLIENT_ID,
            clientSecret: _env.GMAIL_SECONDARY_CLIENT_SECRET,
            refreshToken: _env.GMAIL_SECONDARY_REFRESH_TOKEN,
            from: _env.GMAIL_SECONDARY_FROM || _env.GMAIL_FROM || "",
          }
        : null,
    ].filter((provider) => provider !== null),
    enabled:
      _env.EMAIL_DRIVER === "smtp"
        ? Boolean(_env.SMTP_HOST && _env.SMTP_PORT && _env.SMTP_FROM)
        : _env.EMAIL_DRIVER === "gmail_api"
          ? Boolean(
              _env.GMAIL_CLIENT_ID &&
              _env.GMAIL_CLIENT_SECRET &&
              _env.GMAIL_REFRESH_TOKEN &&
              _env.GMAIL_FROM,
            )
          : false,
    sendsPerMinute: _env.TOKEN_EMAIL_SENDS_PER_MINUTE,
    sendDelayMs: Math.ceil(60000 / _env.TOKEN_EMAIL_SENDS_PER_MINUTE),
  },

  sheets: {
    enabled: Boolean(
      _env.GOOGLE_SHEETS_ENABLED &&
      ((_env.GOOGLE_SHEETS_CLIENT_EMAIL && _env.GOOGLE_SHEETS_PRIVATE_KEY) ||
        ((_env.GOOGLE_OAUTH_CLIENT_ID || _env.GMAIL_CLIENT_ID) &&
          (_env.GOOGLE_OAUTH_CLIENT_SECRET || _env.GMAIL_CLIENT_SECRET) &&
          (_env.GOOGLE_OAUTH_REFRESH_TOKEN || _env.GMAIL_REFRESH_TOKEN))),
    ),
    spreadsheetId: _env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: _env.GOOGLE_SHEETS_SHEET_NAME ?? "Pilketos",
    clientEmail: _env.GOOGLE_SHEETS_CLIENT_EMAIL,
    privateKey: _env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    oauthClientId: _env.GOOGLE_OAUTH_CLIENT_ID || _env.GMAIL_CLIENT_ID,
    oauthClientSecret: _env.GOOGLE_OAUTH_CLIENT_SECRET || _env.GMAIL_CLIENT_SECRET,
    oauthRefreshToken: _env.GOOGLE_OAUTH_REFRESH_TOKEN || _env.GMAIL_REFRESH_TOKEN,
  },
} as const;

/**
 * Inferred type of the validated config.
 * Useful for typing function parameters that receive config slices.
 */
export type Config = typeof config;
