"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Stepper } from "@/components/voting/Stepper";
import { clearVotingSession, consumeVotingDone } from "@/lib/vote/client-state";

export default function VoteDonePage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    if (!consumeVotingDone()) {
      router.replace("/vote");
      return;
    }

    clearVotingSession();
    void document.exitFullscreen?.().catch(() => undefined);

    const interval = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(value - 1, 0));
    }, 1000);

    const timeout = window.setTimeout(() => {
      clearVotingSession();
      router.replace("/vote");
    }, 3000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:py-12">
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
            Terima kasih sudah berpartisipasi. Halaman akan kembali ke awal dalam {secondsLeft}{" "}
            detik.
          </p>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
              style={{ width: `${(secondsLeft / 3) * 100}%` }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
