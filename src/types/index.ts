/**
 * Shared TypeScript Types & Enums — Pilketos E-Voting System
 *
 * This file contains the canonical type definitions shared across
 * service layer, API layer, and UI layer.
 *
 * These types must remain consistent with:
 *   - 01_DATABASE_DESIGN.md (entity definitions & enums)
 *   - 03_API_SPECIFICATION.md (request/response shapes)
 *
 * IMPORTANT: Do NOT import Prisma types directly in UI or API layers.
 * Use the types defined here instead to maintain layered architecture.
 */

// ---------------------------------------------------------------------------
// Database Enum Mirrors
// Must stay in sync with prisma/schema.prisma enums
// Reference: 01_DATABASE_DESIGN.md §Enum Definitions
// ---------------------------------------------------------------------------

/**
 * Status lifecycle of a voting election.
 * State machine transitions are enforced in ElectionService.
 * Reference: 01_DATABASE_DESIGN.md §State Machine & Transition Rules
 */
export type ElectionStatus = "SETUP" | "READY" | "OPEN" | "PAUSED" | "CLOSED" | "ARCHIVED";

/**
 * Valid election status transitions (source → allowed targets).
 * Reference: 01_DATABASE_DESIGN.md §State Machine
 */
export const ELECTION_STATUS_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  SETUP: ["READY"],
  READY: ["OPEN", "SETUP"],
  OPEN: ["PAUSED", "CLOSED"],
  PAUSED: ["OPEN", "CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
} as const;

/**
 * Admin role within the system.
 * SUPER_ADMIN can manage other admin accounts.
 * Reference: 01_DATABASE_DESIGN.md §Admin Roles
 * Reference: 05_SECURITY.md §Authorization Model
 */
export type AdminRole = "VIEWER" | "ADMIN" | "SUPER_ADMIN";

/**
 * Audit log action types.
 * Reference: 01_DATABASE_DESIGN.md §AuditLog Entity
 */
export type AuditAction =
  // Auth actions
  | "ADMIN_LOGIN_SUCCESS"
  | "ADMIN_LOGIN_FAILED"
  | "ADMIN_LOGOUT"
  // Election actions
  | "ELECTION_CREATED"
  | "ELECTION_UPDATED"
  | "ELECTION_STATUS_CHANGED"
  | "ELECTION_DELETED"
  // Candidate actions
  | "CANDIDATE_CREATED"
  | "CANDIDATE_UPDATED"
  | "CANDIDATE_DELETED"
  | "CANDIDATE_PHOTO_UPLOADED"
  // Token actions
  | "TOKEN_BATCH_GENERATED"
  | "TOKEN_EXPORTED"
  // Vote actions (no PII — see 05_SECURITY.md §Privacy Architecture)
  | "VOTE_CAST"
  // Admin management actions
  | "ADMIN_CREATED"
  | "ADMIN_UPDATED"
  | "ADMIN_DEACTIVATED";

/**
 * Audit log result values.
 */
export type AuditResult = "SUCCESS" | "FAILURE";

// ---------------------------------------------------------------------------
// Standard API Response types
// Reference: 03_API_SPECIFICATION.md §Response Format Standard
// ---------------------------------------------------------------------------

export interface ApiSuccessResponse<T = undefined> {
  success: true;
  data: T extends undefined ? never : T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]> | null;
  };
}

export type ApiResponse<T = undefined> = ApiSuccessResponse<T> | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Common application error codes
// Reference: 03_API_SPECIFICATION.md §Error Codes
// ---------------------------------------------------------------------------

export const ErrorCode = {
  // Input validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Authentication / authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Voting-specific
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_ALREADY_USED: "TOKEN_ALREADY_USED",
  ELECTION_NOT_OPEN: "ELECTION_NOT_OPEN",
  ELECTION_NOT_FOUND: "ELECTION_NOT_FOUND",
  CANDIDATE_NOT_IN_ELECTION: "CANDIDATE_NOT_IN_ELECTION",
  ACTIVE_ELECTION_EXISTS: "ACTIVE_ELECTION_EXISTS",
  ELECTION_TRANSITION_INVALID: "ELECTION_TRANSITION_INVALID",
  INSUFFICIENT_CANDIDATES: "INSUFFICIENT_CANDIDATES",
  INSUFFICIENT_TOKENS: "INSUFFICIENT_TOKENS",
  MAX_CANDIDATES_REACHED: "MAX_CANDIDATES_REACHED",
  ELECTION_NOT_SETUP: "ELECTION_NOT_SETUP",

  // Storage
  UPLOAD_FAILED: "UPLOAD_FAILED",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// Session types (NextAuth JWT payload)
// Reference: 02_SYSTEM_ARCHITECTURE.md §Admin Authentication Detail
// ---------------------------------------------------------------------------

export interface AdminSession {
  id: string;
  username: string;
  role: AdminRole;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
