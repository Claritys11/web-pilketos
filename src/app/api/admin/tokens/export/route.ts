import { requireAdmin } from "@/lib/api/auth";
import { csv, handleApiError } from "@/lib/api/response";
import { electionIdQuerySchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export async function GET(request: Request) {
  try {
    await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { electionId } = electionIdQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const tokens = await tokenService.exportTokenMetadata(electionId);
    const rows = tokens.map((token, index) =>
      [index + 1, token.createdAt.toISOString(), token.usedAt?.toISOString() ?? ""].join(","),
    );

    return csv(["token_number,created_at,used_at", ...rows].join("\n"), "tokens-pilketos.csv");
  } catch (error) {
    return handleApiError(error);
  }
}
