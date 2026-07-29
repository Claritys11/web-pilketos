export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "VIEWER";
export type ElectionStatus = "SETUP" | "READY" | "OPEN" | "PAUSED" | "CLOSED" | "ARCHIVED";
export type AuditResult = "SUCCESS" | "FAILURE";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface AdminSessionUser {
  id: string;
  username: string;
  role: AdminRole;
  email?: string | null;
  name?: string | null;
}

export interface ElectionListItem {
  id: string;
  title: string;
  description: string | null;
  status: ElectionStatus;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    username: string;
  };
  _count?: {
    candidates?: number;
    tokens?: number;
    votes?: number;
  };
}

export interface Candidate {
  id: string;
  electionId: string;
  orderNumber: number;
  name: string;
  className: string;
  photoUrl: string | null;
  vision: string;
  missions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ElectionDetail extends ElectionListItem {
  candidates: Candidate[];
}

export interface DashboardStats {
  election: {
    id: string;
    title: string;
    status: ElectionStatus;
    openedAt: string | null;
  };
  totalVotes: number;
  totalTokens: number;
  usedTokens: number;
  participationRate: number;
  lastVoteAt: string | null;
  generatedAt: string;
  candidateStats: Array<{
    candidateId: string;
    orderNumber: number;
    name: string;
    voteCount: number;
    percentage: number;
  }>;
}

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: AuditResult;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
  actor?: {
    id: string;
    username: string;
    role: AdminRole;
  } | null;
}

export interface AdminAccount {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
