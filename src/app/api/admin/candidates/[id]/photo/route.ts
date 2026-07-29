import { getRequestContext, requireAdmin } from "@/lib/api/auth";
import { fail, handleApiError, ok } from "@/lib/api/response";
import {
  isAllowedPhotoMimeType,
  normalizeFilenameExtension,
  validatePhotoExtension,
  validatePhotoSignature,
} from "@/lib/security/upload";
import { idParamsSchema } from "@/schemas/api";
import { candidateService } from "@/services/candidate.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(["ADMIN", "SUPER_ADMIN"]);
    const { id } = idParamsSchema.parse(await context.params);
    const formData = await request.formData();
    const photo = formData.get("photo");

    if (!(photo instanceof File)) {
      return fail("VALIDATION_ERROR", "File foto wajib disertakan.", 400);
    }

    if (photo.size > 2 * 1024 * 1024) {
      return fail("FILE_TOO_LARGE", "Ukuran file terlalu besar.", 400);
    }

    if (!isAllowedPhotoMimeType(photo.type)) {
      return fail("INVALID_FILE_TYPE", "Format file tidak didukung.", 400);
    }

    const extension = normalizeFilenameExtension(photo.name);
    if (!validatePhotoExtension(extension, photo.type)) {
      return fail("INVALID_FILE_EXTENSION", "Ekstensi file tidak sesuai format foto.", 400);
    }

    const buffer = new Uint8Array(await photo.arrayBuffer());
    if (!validatePhotoSignature(buffer, photo.type)) {
      return fail("INVALID_FILE_SIGNATURE", "Isi file tidak sesuai format foto.", 400);
    }

    return ok(
      await candidateService.uploadPhoto({
        id,
        buffer,
        mimeType: photo.type,
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
