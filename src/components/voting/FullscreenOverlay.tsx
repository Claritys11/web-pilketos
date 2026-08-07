"use client";

import { useCallback, useEffect, useState } from "react";

interface FullscreenOverlayProps {
  enabled?: boolean;
  title?: string;
  description?: string;
  buttonLabel?: string;
  restoreOnExit?: boolean;
}

type NavigatorWithKeyboardLock = Navigator & {
  keyboard?: {
    lock?: (keys?: string[]) => Promise<void>;
    unlock?: () => void;
  };
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const LOCKED_KEYS = ["Escape", "F5"];

function getFullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

async function requestElementFullscreen(element: FullscreenElement) {
  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }

  await element.webkitRequestFullscreen?.();
}

function isInterrupted() {
  return !getFullscreenElement() || document.visibilityState !== "visible" || !document.hasFocus();
}

export function useFullscreenControl(enabled = true) {
  const [interrupted, setInterrupted] = useState(false);

  const requestFullscreen = useCallback(async () => {
    const root = document.documentElement as FullscreenElement;
    if (!getFullscreenElement()) {
      await requestElementFullscreen(root);
    }

    const keyboard = (navigator as NavigatorWithKeyboardLock).keyboard;
    await keyboard?.lock?.(LOCKED_KEYS).catch(() => undefined);
    setInterrupted(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const restoreFullscreen = () => {
      if (!getFullscreenElement()) {
        void requestFullscreen().catch(() => undefined);
      }
    };

    const checkInterruption = () => {
      const interruptedNow = isInterrupted();
      setInterrupted(interruptedNow);

      if (interruptedNow && document.visibilityState === "visible" && document.hasFocus()) {
        window.setTimeout(restoreFullscreen, 250);
      }
    };

    const preventExitShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isRefresh = key === "f5" || ((event.ctrlKey || event.metaKey) && key === "r");
      const isEscape = event.key === "Escape" || event.code === "Escape";
      const isCloseTab = (event.ctrlKey || event.metaKey) && key === "w";
      const isDevTools =
        key === "f12" || ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "i");

      if (isRefresh || isEscape || isCloseTab || isDevTools) {
        event.preventDefault();
        event.stopPropagation();
        checkInterruption();
      }
    };

    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("fullscreenchange", checkInterruption);
    document.addEventListener("webkitfullscreenchange", checkInterruption);
    document.addEventListener("visibilitychange", checkInterruption);
    document.addEventListener("keydown", preventExitShortcuts, true);
    window.addEventListener("blur", checkInterruption);
    window.addEventListener("focus", checkInterruption);
    window.addEventListener("beforeunload", preventUnload);

    checkInterruption();

    return () => {
      const keyboard = (navigator as NavigatorWithKeyboardLock).keyboard;
      keyboard?.unlock?.();
      document.removeEventListener("fullscreenchange", checkInterruption);
      document.removeEventListener("webkitfullscreenchange", checkInterruption);
      document.removeEventListener("visibilitychange", checkInterruption);
      document.removeEventListener("keydown", preventExitShortcuts, true);
      window.removeEventListener("blur", checkInterruption);
      window.removeEventListener("focus", checkInterruption);
      window.removeEventListener("beforeunload", preventUnload);
    };
  }, [enabled, requestFullscreen]);

  return { interrupted, requestFullscreen };
}

export function FullscreenOverlay({
  enabled = true,
  title = "Mode layar penuh terjeda",
  description = "Kembali ke layar penuh untuk melanjutkan proses voting dari posisi terakhir. Jika tombol Esc ditekan, browser bisa keluar sesaat dan sistem akan meminta masuk layar penuh lagi.",
  buttonLabel = "Kembali ke Layar Penuh",
}: FullscreenOverlayProps) {
  const { interrupted, requestFullscreen } = useFullscreenControl(enabled);

  if (!enabled || !interrupted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-5 backdrop-blur-sm">
      <section
        aria-modal="true"
        role="dialog"
        className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-2xl text-amber-700">
          !
        </div>
        <h2 className="text-xl font-semibold text-neutral-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p>
        <button
          type="button"
          onClick={() => void requestFullscreen()}
          className="mt-6 h-12 w-full rounded-lg bg-[var(--color-vote-primary)] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2"
        >
          {buttonLabel}
        </button>
      </section>
    </div>
  );
}
