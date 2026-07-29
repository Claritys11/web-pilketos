import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { candidateUpdateSchema, idParamsSchema } from "@/schemas/api";
import { candidateService } from "@/services/candidate.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const body = candidateUpdateSchema.parse(await request.json());
    return ok(
      await candidateService.updateCandidate({
        id,
        ...body,
        actorId: admin.id,
        actorRole: admin.role,
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    return ok(
      await candidateService.deleteCandidate({
        id,
        actorId: admin.id,
        actorRole: admin.role,
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
