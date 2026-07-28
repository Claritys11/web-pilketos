import type { AuditAction, AuditResult, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface WriteAuditLogInput {
  actorId?: string | null | undefined;
  action: AuditAction;
  targetType?: string | null | undefined;
  targetId?: string | null | undefined;
  result: AuditResult;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  metadata?: Prisma.InputJsonObject;
}

export class AuditService {
  async listLogs(params: {
    page?: number;
    pageSize?: number;
    action?: AuditAction | undefined;
    result?: AuditResult | undefined;
    actorId?: string | undefined;
    targetType?: string | undefined;
    targetId?: string | undefined;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const where: Prisma.AuditLogWhereInput = {
      ...(params.action ? { action: params.action } : {}),
      ...(params.result ? { result: params.result } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
      ...(params.targetId ? { targetId: params.targetId } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async writeLog(input: WriteAuditLogInput, tx: Prisma.TransactionClient = prisma) {
    return tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        result: input.result,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }
}

export const auditService = new AuditService();
