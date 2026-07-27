/**
 * ConsoleLogger — Development implementation of ILogger.
 *
 * Outputs structured JSON lines to stdout/stderr.
 * In production, replace with a structured logger (Pino, Winston) by
 * swapping the default export in src/lib/logger/index.ts.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §Logging Architecture
 */

import { config } from "@/config/env";
import type { ILogger, LogContext } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEntry(
  level: string,
  message: string,
  context?: LogContext,
  error?: unknown,
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined && Object.keys(context).length > 0) {
    entry["context"] = context;
  }

  if (error !== undefined) {
    if (error instanceof Error) {
      entry["error"] = {
        name: error.name,
        message: error.message,
        // Stack only in non-production; never sent to client
        ...(!config.app.isProduction && { stack: error.stack }),
      };
    } else {
      entry["error"] = String(error);
    }
  }

  return JSON.stringify(entry);
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ConsoleLogger implements ILogger {
  private readonly isDevelopment = config.app.isDevelopment;

  debug(message: string, context?: LogContext): void {
    // Debug messages are suppressed in production and test environments
    if (!this.isDevelopment) {
      return;
    }
    console.log(formatEntry("debug", message, context));
  }

  info(message: string, context?: LogContext): void {
    console.log(formatEntry("info", message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(formatEntry("warn", message, context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(formatEntry("error", message, context, error));
  }
}
