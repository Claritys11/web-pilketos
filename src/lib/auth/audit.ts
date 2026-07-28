import type { AuditAction, AuditResult } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AuthAuditInput {
  actorId?: string | null;
  action: Extract<AuditAction, "ADMIN_LOGIN_SUCCESS" | "ADMIN_LOGIN_FAILED">;
  result: AuditResult;
  request: Request;
  metadata?: Record<string, unknown>;
}

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function writeAuthAuditLog(input: AuthAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      result: input.result,
      ipAddress: getClientIp(input.request),
      userAgent: input.request.headers.get("user-agent"),
      targetType: "admin",
      targetId: input.actorId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
    },
  });
}
