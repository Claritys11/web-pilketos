"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FullscreenOverlay } from "@/components/voting/FullscreenOverlay";
import { Stepper } from "@/components/voting/Stepper";
import { clearVotingSession, consumeVotingDone } from "@/lib/vote/client-state";

export default function VoteDonePage() {
  const router = useRouter();
  const [redirectProgress, setRedirectProgress] = useState(0);

  useEffect(() => {
    if (!consumeVotingDone()) {
      router.replace("/vote");
      return;
    }

    clearVotingSession();

    const startedAt = Date.now();
    const duration = 7000;
    const interval = window.setInterval(() => {
      const nextProgress = Math.min(((Date.now() - startedAt) / duration) * 100, 100);
      setRedirectProgress(nextProgress);
      if (nextProgress >= 100) {
        window.clearInterval(interval);
        router.replace("/vote");
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:py-12">
      <FullscreenOverlay
        title="Layar penuh terjeda"
        description="Voting sudah selesai, tetapi halaman tetap dijaga dalam mode layar penuh."
      />
      <Stepper currentStep={4} />

      <section className="grid flex-1 place-items-center py-10">
        <div className="w-full max-w-xl rounded-lg border border-emerald-200 bg-white p-6 text-center shadow-md sm:p-8">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-4xl font-bold text-emerald-700">
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl">
            Suara berhasil dicatat
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-600">
            Terima kasih sudah berpartisipasi. Halaman tetap berada dalam mode layar penuh dan akan
            menyiapkan pemilih berikutnya secara otomatis.
          </p>
          <div className="mt-8 overflow-hidden rounded-full bg-emerald-50">
            <div
              className="h-3 rounded-full bg-emerald-600 transition-[width] duration-100 ease-linear"
              style={{ width: `${redirectProgress}%` }}
            />
          </div>
          <p className="mt-3 text-sm font-medium text-emerald-700">
            Mengarahkan kembali ke input token...
          </p>
          <button
            type="button"
            onClick={() => router.replace("/vote")}
            className="mt-8 h-12 rounded-lg bg-[var(--color-vote-primary)] px-6 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2"
          >
            Siapkan Pemilih Berikutnya
          </button>
        </div>
      </section>
    </main>
  );
}
