import { CandidatesClient } from "@/components/admin/CandidatesClient";
import { getAdminPageUser } from "@/lib/admin/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCandidatesPage({ params }: PageProps) {
  const [{ id }, user] = await Promise.all([params, getAdminPageUser()]);

  return <CandidatesClient electionId={id} user={user} />;
}
