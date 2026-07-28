import { handleApiError, ok } from "@/lib/api/response";
import { validateTokenSchema } from "@/schemas/api";
import { tokenService } from "@/services/token.service";

export async function POST(request: Request) {
  try {
    const body = validateTokenSchema.parse(await request.json());
    return ok(await tokenService.validateToken(body.token));
  } catch (error) {
    return handleApiError(error);
  }
}
