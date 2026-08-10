import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { idParamsSchema, updateElectionEmailTemplatesSchema } from "@/schemas/api";
import { electionService } from "@/services/election.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = idParamsSchema.parse(await context.params);
    return ok(await electionService.getElection(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const body = updateElectionEmailTemplatesSchema.parse(await request.json());
    return ok(
      await electionService.updateEmailTemplates({
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
    const admin = await requireAdmin(["SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    return ok(
      await electionService.deleteElection({
        electionId: id,
        actorId: admin.id,
        actorRole: admin.role,
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
