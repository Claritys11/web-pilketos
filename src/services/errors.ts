export type ServiceErrorCode =
  | "ADMIN_EMAIL_TAKEN"
  | "ADMIN_NOT_FOUND"
  | "ADMIN_USERNAME_TAKEN"
  | "ACTIVE_ELECTION_EXISTS"
  | "CANDIDATE_HAS_VOTES"
  | "CANDIDATE_NOT_FOUND"
  | "CANDIDATE_NOT_IN_ELECTION"
  | "CANNOT_DEACTIVATE_SELF"
  | "ELECTION_MAX_CANDIDATES"
  | "ELECTION_MIN_CANDIDATES"
  | "ELECTION_NOT_FOUND"
  | "ELECTION_NOT_OPEN"
  | "ELECTION_TRANSITION_INVALID"
  | "ELECTION_WRONG_STATE"
  | "FORBIDDEN"
  | "GOOGLE_SHEETS_DISABLED"
  | "GOOGLE_SHEETS_SYNC_FAILED"
  | "ORDER_NUMBER_TAKEN"
  | "TOKEN_ALREADY_USED"
  | "TOKEN_EMAIL_DELIVERY_BUSY"
  | "TOKEN_GENERATION_ACTIVE_ONLY"
  | "TOKEN_GENERATION_FAILED"
  | "TOKEN_INVALID"
  | "TOKEN_STUDENT_ALREADY_ASSIGNED"
  | "TOKEN_STUDENT_CLASS_REQUIRED"
  | "TOKEN_STUDENT_DUPLICATE"
  | "TOKEN_STUDENT_EMAIL_REQUIRED"
  | "TOKEN_STUDENT_IDENTIFIER_REQUIRED"
  | "TOKEN_VOTER_TYPE_INVALID"
  | "WEIGHTED_ELECTION_REQUIRES_VOTERS";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function assertRole(
  role: "VIEWER" | "ADMIN" | "SUPER_ADMIN",
  allowed: Array<"VIEWER" | "ADMIN" | "SUPER_ADMIN">,
): void {
  if (!allowed.includes(role)) {
    throw new ServiceError("FORBIDDEN", "Role tidak memiliki akses untuk aksi ini.", 403);
  }
}
