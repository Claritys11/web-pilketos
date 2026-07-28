import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { created, handleApiError } from "@/lib/api/response";
import { tokenGenerateSchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const body = tokenGenerateSchema.parse(await request.json());
    return created(
      await tokenService.generateTokenBatch({
        ...body,
        actorId: admin.id,
        actorRole: admin.role as "ADMIN" | "SUPER_ADMIN",
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
