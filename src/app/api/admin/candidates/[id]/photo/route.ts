import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { candidateService } from "@/services/candidate.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = await context.params;
    const formData = await request.formData();
    const photo = formData.get("photo");

    if (!(photo instanceof File)) {
      return fail("VALIDATION_ERROR", "File foto wajib disertakan.", 400);
    }

    if (photo.size > 2 * 1024 * 1024) {
      return fail("FILE_TOO_LARGE", "Ukuran file terlalu besar.", 400);
    }

    const extension = MIME_TO_EXTENSION[photo.type as keyof typeof MIME_TO_EXTENSION];
    if (!extension) {
      return fail("INVALID_FILE_TYPE", "Format file tidak didukung.", 400);
    }

    const buffer = new Uint8Array(await photo.arrayBuffer());
    return ok(
      await candidateService.uploadPhoto({
        id,
        buffer,
        mimeType: photo.type as keyof typeof MIME_TO_EXTENSION,
        extension,
        actorId: admin.id,
        actorRole: admin.role,
        ...getRequestContext(request),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
