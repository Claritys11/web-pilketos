import { getRequestContext } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { castVoteSchema } from "@/schemas/api";
import { voteService } from "@/services/vote.service";

export async function POST(request: Request) {
  try {
    const body = castVoteSchema.parse(await request.json());
    return ok(await voteService.castVote({ ...body, ...getRequestContext(request) }));
  } catch (error) {
    return handleApiError(error);
  }
}
