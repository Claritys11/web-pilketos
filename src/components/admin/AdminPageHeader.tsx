export function AdminPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-primary-700)]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-neutral-950">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
    </div>
  );
}
