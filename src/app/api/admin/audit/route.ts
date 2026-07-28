import type { AuditAction, AuditResult } from "@prisma/client";

import { requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { paginationQuerySchema } from "@/schemas/api";
import { auditService } from "@/services/audit.service";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const searchParams = new URL(request.url).searchParams;
    const pagination = paginationQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(
      await auditService.listLogs({
        ...pagination,
        action: (searchParams.get("filterBy[action]") ?? undefined) as AuditAction | undefined,
        result: (searchParams.get("filterBy[result]") ?? undefined) as AuditResult | undefined,
        actorId: searchParams.get("filterBy[actorId]") ?? undefined,
        targetType: searchParams.get("filterBy[targetType]") ?? undefined,
        targetId: searchParams.get("filterBy[targetId]") ?? undefined,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
