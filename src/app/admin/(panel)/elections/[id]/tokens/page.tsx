import { TokensClient } from "@/components/admin/TokensClient";
import { getAdminPageUser } from "@/lib/admin/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTokensPage({ params }: PageProps) {
  const [{ id }, user] = await Promise.all([params, getAdminPageUser()]);

  return <TokensClient electionId={id} user={user} />;
}
