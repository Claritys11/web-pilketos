import type { AdminRole } from "@prisma/client";

import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { created, handleApiError, ok } from "@/lib/api/response";
import { createAdminSchema, paginationQuerySchema } from "@/schemas/api";
import { adminService } from "@/services/admin.service";

export async function GET(request: Request) {
  try {
    await requireAdmin(["SUPER_ADMIN"]);
    const searchParams = new URL(request.url).searchParams;
    const pagination = paginationQuerySchema.parse(Object.fromEntries(searchParams));
    const isActive = searchParams.get("filterBy[isActive]");
    return ok(
      await adminService.listAdmins({
        ...pagination,
        role: (searchParams.get("filterBy[role]") ?? undefined) as AdminRole | undefined,
        ...(isActive !== null ? { isActive: isActive === "true" } : {}),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["SUPER_ADMIN"]);
    const body = createAdminSchema.parse(await request.json());
    return created(
      await adminService.createAdmin({
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
