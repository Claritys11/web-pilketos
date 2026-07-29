import { ElectionsClient } from "@/components/admin/ElectionsClient";
import { getAdminPageUser } from "@/lib/admin/session";

export default async function AdminElectionsPage() {
  const user = await getAdminPageUser();

  return <ElectionsClient user={user} />;
}
