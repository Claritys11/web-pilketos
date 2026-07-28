import { requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { electionIdQuerySchema } from "@/schemas/api";
import { electionService } from "@/services/election.service";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { electionId } = electionIdQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return ok(await electionService.getDashboardStats(electionId));
  } catch (error) {
    return handleApiError(error);
  }
}
