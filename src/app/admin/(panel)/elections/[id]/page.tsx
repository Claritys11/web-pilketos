import { ElectionDetailClient } from "@/components/admin/ElectionDetailClient";
import { getAdminPageUser } from "@/lib/admin/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminElectionDetailPage({ params }: PageProps) {
  const [{ id }, user] = await Promise.all([params, getAdminPageUser()]);

  return <ElectionDetailClient electionId={id} user={user} />;
}
