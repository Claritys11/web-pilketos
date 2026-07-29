import { DashboardClient } from "@/components/admin/DashboardClient";
import { getAdminPageUser } from "@/lib/admin/session";

export default async function AdminDashboardPage() {
  const user = await getAdminPageUser();

  return <DashboardClient user={user} />;
}
