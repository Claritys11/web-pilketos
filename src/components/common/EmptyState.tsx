export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-neutral-100 text-xl text-neutral-500">
          -
        </div>
        <h3 className="mt-4 text-base font-semibold text-neutral-950">{title}</h3>
        {description ? (
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
