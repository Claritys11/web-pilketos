import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { idParamsSchema, updateElectionStatusSchema } from "@/schemas/api";
import { electionService } from "@/services/election.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const body = updateElectionStatusSchema.parse(await request.json());
    return ok(
      await electionService.transitionStatus({
        electionId: id,
        status: body.status,
        actorId: admin.id,
        actorRole: admin.role,
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
