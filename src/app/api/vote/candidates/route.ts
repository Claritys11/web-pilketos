import { handleApiError, ok } from "@/lib/api/response";
import { electionIdQuerySchema } from "@/schemas/api";
import { candidateService } from "@/services/candidate.service";

export async function GET(request: Request) {
  try {
    const { electionId } = electionIdQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return ok({ items: await candidateService.listPublicCandidates(electionId) });
  } catch (error) {
    return handleApiError(error);
  }
}
