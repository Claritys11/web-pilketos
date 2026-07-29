import fs from "node:fs/promises";
import path from "node:path";

import { notFound } from "next/navigation";

const UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads");
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const relativePath = segments.join("/");
  const filePath = path.resolve(UPLOADS_DIR, relativePath);

  if (!filePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) {
    notFound();
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) {
    notFound();
  }

  try {
    const file = await fs.readFile(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    notFound();
  }
}
