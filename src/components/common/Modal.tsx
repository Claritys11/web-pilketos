"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

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
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    window.requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus(),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={titleId}
        role="dialog"
        className="w-full max-w-xl rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 p-5">
          <h2 id={titleId} className="text-lg font-semibold text-neutral-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="grid h-11 w-11 place-items-center rounded-lg border border-neutral-200 text-xl text-neutral-600 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
          >
            <X aria-hidden="true" size={18} />
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
