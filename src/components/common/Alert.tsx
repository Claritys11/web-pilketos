import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

type AlertTone = "danger" | "success" | "warning" | "info";

const TONE_CLASS: Record<
  AlertTone,
  {
    wrapper: string;
    icon: string;
    title: string;
  }
> = {
  danger: {
    wrapper: "border-red-200 bg-red-50 text-red-800",
    icon: "bg-red-100 text-red-700",
    title: "text-red-950",
  },
  success: {
    wrapper: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-950",
  },
  warning: {
    wrapper: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "bg-amber-100 text-amber-700",
    title: "text-amber-950",
  },
  info: {
    wrapper: "border-sky-200 bg-sky-50 text-sky-800",
    icon: "bg-sky-100 text-sky-700",
    title: "text-sky-950",
  },
};

const ICON = {
  danger: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
  info: Info,
};

export function Alert({
  tone,
  title,
  children,
}: {
  tone: AlertTone;
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = ICON[tone];
  const classes = TONE_CLASS[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={`flex gap-3 rounded-lg border p-4 text-sm leading-6 shadow-sm ${classes.wrapper}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${classes.icon}`}>
        <Icon aria-hidden="true" size={18} />
      </span>
      <div className="min-w-0">
        {title ? <p className={`font-bold ${classes.title}`}>{title}</p> : null}
        <div className={title ? "mt-1 font-medium" : "font-semibold"}>{children}</div>
      </div>
    </div>
  );
}
