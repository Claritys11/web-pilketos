import type { AdminRole } from "@prisma/client";

import { auth } from "@/auth";
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

  const admin = {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role,
  };

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
