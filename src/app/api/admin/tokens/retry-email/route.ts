import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { electionIdBodySchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const body = electionIdBodySchema.parse(await request.json());

    return ok(
      await tokenService.retryFailedTokenEmails({
        electionId: body.electionId,
        actorId: admin.id,
        actorRole: admin.role as "ADMIN" | "SUPER_ADMIN",
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
