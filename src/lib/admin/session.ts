import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AdminSessionUser } from "@/lib/admin/types";

export async function getAdminPageUser(): Promise<AdminSessionUser> {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return session.user;
}
