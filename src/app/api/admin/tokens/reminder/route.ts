import { after } from "next/server";

import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { tokenReminderSchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export const maxDuration = 3600;

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const body = tokenReminderSchema.parse(await request.json());
    const requestContext = getRequestContext(request);
    const queued = await tokenService.prepareElectionReminders({
      electionId: body.electionId,
      mode: body.mode,
      actorRole: admin.role as "ADMIN" | "SUPER_ADMIN",
    });

    if (queued.pending > 0) {
      after(async () => {
        try {
          await tokenService.deliverElectionReminderQueue({
            electionId: body.electionId,
            actorId: admin.id,
            ...requestContext,
          });
        } catch (error) {
          console.error("Election reminder queue failed.", error);
        }
      });
    }

    return ok(queued, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
