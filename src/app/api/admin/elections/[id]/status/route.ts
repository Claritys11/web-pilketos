import { after } from "next/server";

import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { idParamsSchema, updateElectionStatusSchema } from "@/schemas/api";
import { electionService } from "@/services/election.service";
import { tokenService } from "@/services/token.service";

export const maxDuration = 3600;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const body = updateElectionStatusSchema.parse(await request.json());
    const requestContext = getRequestContext(request);
    const election = await electionService.transitionStatus({
      electionId: id,
      status: body.status,
      actorId: admin.id,
      actorRole: admin.role,
      ...requestContext,
    });
    if (body.status === "OPEN" && election.sendReminderOnOpen) {
      after(async () => {
        try {
          await tokenService.deliverElectionReminderQueue({
            electionId: id,
            actorId: admin.id,
            ...requestContext,
          });
        } catch (error) {
          console.error("Election reminder queue failed.", error);
        }
      });
    }
    return ok(election);
  } catch (error) {
    return handleApiError(error);
  }
}
