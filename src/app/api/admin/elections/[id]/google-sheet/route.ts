import { requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/response";
import { idParamsSchema } from "@/schemas/api";
import { ServiceError } from "@/services/errors";
import { googleSheetsService } from "@/services/google-sheets.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const result = await googleSheetsService.syncElection(id);
    if (result.status === "DISABLED") {
      throw new ServiceError(
        "GOOGLE_SHEETS_DISABLED",
        "Google Sheets belum diaktifkan di environment deployment.",
        422,
      );
    }
    if (result.status === "FAILED") {
      throw new ServiceError(
        "GOOGLE_SHEETS_SYNC_FAILED",
        result.error ?? "Sinkronisasi Google Sheets gagal.",
        502,
      );
    }
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
