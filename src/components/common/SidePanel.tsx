"use client";

export function SidePanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Tutup panel"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-5">
          <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-10 w-10 place-items-center rounded-lg border border-neutral-200 text-xl text-neutral-600 hover:bg-neutral-50"
          >
            x
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
