/**
 * Logger Service — Interface & Default Export
 *
 * Application code must use this interface, not console.log directly.
 * This enables structured logging, level filtering, and easy replacement
 * with production-grade loggers (Pino, Winston) without changing callers.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §Logging Architecture
 *
 * IMPORTANT DISTINCTION:
 *   - This logger is for APPLICATION events (errors, request lifecycle, debug).
 *   - Audit logs (user actions like VOTE_CAST, ELECTION_OPENED) use AuditService
 *     and are stored in the database, NOT here.
 */

// ---------------------------------------------------------------------------
// Log level definition
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ILogger {
  /**
   * Debug-level message. Only emitted in development.
   * Use for verbose details useful during development.
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Info-level message. Request lifecycle, service events.
   * Use for normal operational events.
   */
  info(message: string, context?: LogContext): void;

  /**
   * Warning-level message. Degraded behavior, retries, deprecated usage.
   * Use when something unexpected happened but the system continues normally.
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Error-level message. Exceptions, DB failures, unhandled errors.
   * Always include the caught error object when available.
   *
   * SECURITY: Never log token plaintexts, passwords, or PII.
   * Reference: 05_SECURITY.md §Logging & Audit Security
   */
  error(message: string, error?: unknown, context?: LogContext): void;
}

// ---------------------------------------------------------------------------
// Factory type — allows tests to inject a custom logger
// ---------------------------------------------------------------------------

export type LoggerFactory = () => ILogger;

// ---------------------------------------------------------------------------
// Default export — resolved at module load, injectable in tests
// ---------------------------------------------------------------------------

import { ConsoleLogger } from "./console";

/**
 * The application-wide logger instance.
 * Replace this export during testing with a mock that implements ILogger.
 */
export const logger: ILogger = new ConsoleLogger();
