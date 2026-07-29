import type { AuditAction, AuditResult } from "@prisma/client";

import { requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { auditQuerySchema } from "@/schemas/api";
import { auditService } from "@/services/audit.service";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const searchParams = new URL(request.url).searchParams;
    const query = auditQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(
      await auditService.listLogs({
        page: query.page,
        pageSize: query.pageSize,
        action: query["filterBy[action]"] as AuditAction | undefined,
        result: query["filterBy[result]"] as AuditResult | undefined,
        actorId: query["filterBy[actorId]"],
        targetType: query["filterBy[targetType]"],
        targetId: query["filterBy[targetId]"],
        createdFrom: query["filterBy[createdFrom]"],
        createdTo: query["filterBy[createdTo]"],
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
