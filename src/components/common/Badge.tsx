import type { AdminRole, AuditResult, ElectionStatus } from "@/lib/admin/types";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  primary: "bg-red-50 text-[var(--color-primary-700)] ring-red-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function electionStatusTone(status: ElectionStatus): BadgeTone {
  const tones: Record<ElectionStatus, BadgeTone> = {
    SETUP: "info",
    READY: "warning",
    OPEN: "success",
    PAUSED: "warning",
    CLOSED: "danger",
    ARCHIVED: "neutral",
  };

  return tones[status];
}

export function roleTone(role: AdminRole): BadgeTone {
  return role === "SUPER_ADMIN" ? "primary" : role === "ADMIN" ? "success" : "neutral";
}

export function resultTone(result: AuditResult): BadgeTone {
  return result === "SUCCESS" ? "success" : "danger";
}
