import type { AdminRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ServiceError, assertRole } from "@/services/errors";

export interface ApiAdminSession {
  id: string;
  username: string;
  role: AdminRole;
}

export async function requireAdmin(allowed: AdminRole[] = ["VIEWER", "ADMIN", "SUPER_ADMIN"]) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ServiceError("FORBIDDEN", "Tidak terautentikasi.", 401);
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (!admin?.isActive) {
    throw new ServiceError(
      "FORBIDDEN",
      "Sesi admin sudah tidak berlaku. Silakan login kembali.",
      401,
    );
  }

  assertRole(admin.role, allowed);

  return admin;
}

export function getRequestContext(request: Request) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}
