import { AuditClient } from "@/components/admin/AuditClient";

interface PageProps {
  searchParams: Promise<{ targetId?: string }>;
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const { targetId } = await searchParams;

  return targetId ? <AuditClient initialTargetId={targetId} /> : <AuditClient />;
}
