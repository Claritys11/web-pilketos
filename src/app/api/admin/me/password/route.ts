import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { changeOwnPasswordSchema } from "@/schemas/api";
import { adminService } from "@/services/admin.service";

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(["SUPER_ADMIN"]);
    const body = changeOwnPasswordSchema.parse(await request.json());

    return ok(
      await adminService.changeOwnPassword({
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
