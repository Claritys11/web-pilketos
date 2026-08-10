import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { tokenEmailDeliverySchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const body = tokenEmailDeliverySchema.parse(await request.json());

    return ok(
      await tokenService.retryFailedTokenEmails({
        electionId: body.electionId,
        mode: body.mode,
        tokenId: body.tokenId,
        actorId: admin.id,
        actorRole: admin.role as "ADMIN" | "SUPER_ADMIN",
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
