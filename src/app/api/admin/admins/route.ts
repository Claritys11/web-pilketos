import type { AdminRole } from "@prisma/client";

import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { created, handleApiError, ok } from "@/lib/api/response";
import { adminListQuerySchema, createAdminSchema } from "@/schemas/api";
import { adminService } from "@/services/admin.service";

export async function GET(request: Request) {
  try {
    await requireAdmin(["SUPER_ADMIN"]);
    const searchParams = new URL(request.url).searchParams;
    const query = adminListQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(
      await adminService.listAdmins({
        page: query.page,
        pageSize: query.pageSize,
        role: query["filterBy[role]"] as AdminRole | undefined,
        isActive: query["filterBy[isActive]"],
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
