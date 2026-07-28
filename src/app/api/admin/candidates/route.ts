import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { created, handleApiError, ok } from "@/lib/api/response";
import { candidateCreateSchema, electionIdQuerySchema } from "@/schemas/api";
import { candidateService } from "@/services/candidate.service";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { electionId } = electionIdQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return ok({ items: await candidateService.listCandidates(electionId) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const body = candidateCreateSchema.parse(await request.json());
    return created(
      await candidateService.createCandidate({
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
