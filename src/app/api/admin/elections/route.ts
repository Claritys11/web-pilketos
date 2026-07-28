import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { created, handleApiError, ok } from "@/lib/api/response";
import { createElectionSchema, electionStatusSchema, paginationQuerySchema } from "@/schemas/api";
import { electionService } from "@/services/election.service";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const pagination = paginationQuerySchema.parse(Object.fromEntries(url.searchParams));
    const rawStatus = url.searchParams.get("filterBy[status]");
    const status = rawStatus ? electionStatusSchema.parse(rawStatus) : undefined;
    return ok(await electionService.listElections(status ? { ...pagination, status } : pagination));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const body = createElectionSchema.parse(await request.json());
    return created(
      await electionService.createElection({
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
