"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Stepper } from "@/components/voting/Stepper";
import { useFullscreenControl } from "@/components/voting/FullscreenOverlay";
import { loadVotingSession } from "@/lib/vote/client-state";

export default function VoteFullscreenPage() {
  const router = useRouter();
  const { requestFullscreen } = useFullscreenControl(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [title, setTitle] = useState("Pilketos");

  useEffect(() => {
    const session = loadVotingSession();
    if (!session) {
      router.replace("/vote");
      return;
    }

    const timeout = window.setTimeout(() => setTitle(session.electionTitle), 0);
    return () => window.clearTimeout(timeout);
  }, [router]);

  async function startVoting() {
    setIsStarting(true);
    setError(null);
    try {
      await requestFullscreen();
      router.push("/vote/candidates");
    } catch {
      setError("Browser menolak layar penuh. Aktifkan manual dengan F11, lalu klik lagi.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:py-12">
      <Stepper currentStep={2} />

      <section className="grid flex-1 place-items-center py-10">
        <div className="w-full max-w-2xl rounded-lg border border-neutral-200 bg-white p-6 shadow-md sm:p-8">
          <p className="text-sm font-semibold text-[var(--color-primary-700)]">{title}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl">
            Voting dilakukan dalam layar penuh
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-600">
            Setelah dimulai, tetap berada di tab ini sampai suara berhasil dikirim.
          </p>

          {error ? (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void startVoting()}
            disabled={isStarting}
            className="mt-8 h-14 w-full rounded-lg bg-[var(--color-vote-primary)] px-6 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2 disabled:opacity-60"
          >
            {isStarting ? "Menyiapkan..." : "Mulai Voting"}
          </button>
        </div>
      </section>
    </main>
  );
}
