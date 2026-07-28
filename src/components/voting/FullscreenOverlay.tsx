"use client";

import { useCallback, useEffect, useState } from "react";

interface FullscreenOverlayProps {
  enabled?: boolean;
}

type NavigatorWithKeyboardLock = Navigator & {
  keyboard?: {
    lock?: () => Promise<void>;
  };
};

export function useFullscreenControl(enabled = true) {
  const [interrupted, setInterrupted] = useState(false);

  const requestFullscreen = useCallback(async () => {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      await root.requestFullscreen();
    }

    const keyboard = (navigator as NavigatorWithKeyboardLock).keyboard;
    await keyboard?.lock?.().catch(() => undefined);
    setInterrupted(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const checkInterruption = () => {
      setInterrupted(!document.fullscreenElement || document.visibilityState !== "visible");
    };

    document.addEventListener("fullscreenchange", checkInterruption);
    document.addEventListener("visibilitychange", checkInterruption);
    window.addEventListener("blur", checkInterruption);
    window.addEventListener("focus", checkInterruption);

    checkInterruption();

    return () => {
      document.removeEventListener("fullscreenchange", checkInterruption);
      document.removeEventListener("visibilitychange", checkInterruption);
      window.removeEventListener("blur", checkInterruption);
      window.removeEventListener("focus", checkInterruption);
    };
  }, [enabled]);

  return { interrupted, requestFullscreen };
}

export function FullscreenOverlay({ enabled = true }: FullscreenOverlayProps) {
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
        <h2 className="text-xl font-semibold text-neutral-950">Mode layar penuh terjeda</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Kembali ke layar penuh untuk melanjutkan proses voting dari posisi terakhir.
        </p>
        <button
          type="button"
          onClick={() => void requestFullscreen()}
          className="mt-6 h-12 w-full rounded-lg bg-[var(--color-vote-primary)] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2"
        >
          Kembali ke Layar Penuh
        </button>
      </section>
    </div>
  );
}
