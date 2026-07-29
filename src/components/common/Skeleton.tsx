export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="mt-4 h-8 w-2/3" />
      <SkeletonLine className="mt-3 h-4 w-full" />
      <SkeletonLine className="mt-2 h-4 w-5/6" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 border-b border-neutral-100 p-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <SkeletonLine key={columnIndex} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}
