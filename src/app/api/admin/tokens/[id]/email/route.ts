import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { idParamsSchema, updateTokenEmailSchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const body = updateTokenEmailSchema.parse(await request.json());

    return ok(
      await tokenService.updateTokenEmail({
        tokenId: id,
        studentEmail: body.studentEmail,
        actorId: admin.id,
        actorRole: admin.role as "ADMIN" | "SUPER_ADMIN",
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
