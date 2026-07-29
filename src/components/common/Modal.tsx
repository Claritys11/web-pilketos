"use client";

import { useEffect } from "react";

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        aria-modal="true"
        role="dialog"
        className="w-full max-w-xl rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="grid h-11 w-11 place-items-center rounded-lg border border-neutral-200 text-xl text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            x
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer ? (
          <footer className="flex justify-end gap-3 border-t border-neutral-200 p-5">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
