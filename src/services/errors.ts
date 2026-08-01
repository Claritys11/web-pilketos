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
  | "ORDER_NUMBER_TAKEN"
  | "TOKEN_ALREADY_USED"
  | "TOKEN_GENERATION_ACTIVE_ONLY"
  | "TOKEN_GENERATION_FAILED"
  | "TOKEN_INVALID";

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
