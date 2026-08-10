import { handleApiError, ok } from "@/lib/api/response";
import { electionService } from "@/services/election.service";

export async function GET() {
  try {
    return ok(await electionService.getOpenElectionSummary());
  } catch (error) {
    return handleApiError(error);
  }
}
