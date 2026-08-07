import { requireAdmin } from "@/lib/api/auth";
import { ok, handleApiError } from "@/lib/api/response";
import { electionIdQuerySchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export async function GET(request: Request) {
  try {
    await requireAdmin(["VIEWER", "ADMIN", "SUPER_ADMIN"]);
    const { electionId } = electionIdQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return ok(await tokenService.listTokenMetadata(electionId));
  } catch (error) {
    return handleApiError(error);
  }
}
