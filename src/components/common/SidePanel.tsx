"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { RefObject } from "react";

export function SidePanel({
  title,
  description,
  children,
  footer,
  onClose,
  initialFocusRef,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTarget =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
    window.requestAnimationFrame(() => focusTarget?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [initialFocusRef]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-xl"
      >
        <header className="flex min-h-20 items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-neutral-950">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-5 text-neutral-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer ? (
          <footer className="border-t border-neutral-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
