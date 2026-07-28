import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { updateAdminSchema } from "@/schemas/api";
import { adminService } from "@/services/admin.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["SUPER_ADMIN"]);
    const { id } = await context.params;
    const body = updateAdminSchema.parse(await request.json());
    return ok(
      await adminService.updateAdmin({
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
