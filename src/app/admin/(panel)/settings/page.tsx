import { SettingsClient } from "@/components/admin/SettingsClient";
import { getAdminPageUser } from "@/lib/admin/session";

export default async function SettingsPage() {
  const user = await getAdminPageUser();

  return <SettingsClient user={user} />;
}
