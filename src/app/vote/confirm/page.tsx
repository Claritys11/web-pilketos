"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FullscreenOverlay } from "@/components/voting/FullscreenOverlay";
import { Stepper } from "@/components/voting/Stepper";
import {
  clearVotingSession,
  loadVotingSession,
  markVotingDone,
  type VotingSession,
} from "@/lib/vote/client-state";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export default function VoteConfirmPage() {
  const router = useRouter();
  const [session, setSession] = useState<VotingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedSession = loadVotingSession();
    if (!storedSession?.selectedCandidate) {
      router.replace("/vote/candidates");
      return;
    }
    const timeout = window.setTimeout(() => setSession(storedSession), 0);
    return () => window.clearTimeout(timeout);
  }, [router]);

  async function submitVote() {
    if (!session?.selectedCandidate || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/vote/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: session.token,
          electionId: session.electionId,
          candidateId: session.selectedCandidate.id,
        }),
      });
      const result = (await response.json()) as ApiResponse<{ message: string }>;

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? "Suara gagal dikirim.");
      }

      clearVotingSession();
      markVotingDone();
      router.replace("/vote/done");
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Suara gagal dikirim.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const candidate = session?.selectedCandidate;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:py-12">
      <FullscreenOverlay />
      <Stepper currentStep={3} />

      <section className="grid flex-1 place-items-center py-10">
        <div className="w-full max-w-3xl rounded-lg border border-neutral-200 bg-white p-6 shadow-md sm:p-8">
          <p className="text-sm font-semibold text-[var(--color-primary-700)]">
            {session?.electionTitle ?? "Konfirmasi"}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl">
            Konfirmasi pilihan
          </h1>

          {candidate ? (
            <div className="mt-8 grid gap-5 rounded-lg border border-neutral-200 bg-neutral-50 p-5 sm:grid-cols-[96px_1fr]">
              {candidate.photoUrl ? (
                <img
                  src={candidate.photoUrl}
                  alt={`Foto ${candidate.name}`}
                  className="h-24 w-24 rounded-lg object-cover"
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-lg bg-emerald-50 text-2xl font-semibold text-emerald-700">
                  {candidate.orderNumber}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--color-primary-700)]">
                  Nomor {candidate.orderNumber}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-neutral-950">{candidate.name}</h2>
                <p className="mt-1 text-sm text-neutral-500">{candidate.className}</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push("/vote/candidates")}
              disabled={isSubmitting}
              className="h-12 rounded-lg border border-[var(--color-primary-200)] px-5 text-base font-semibold text-[var(--color-primary-700)] transition hover:bg-[var(--color-primary-50)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] disabled:opacity-60"
            >
              Kembali Pilih Ulang
            </button>
            <button
              type="button"
              onClick={() => void submitVote()}
              disabled={!candidate || isSubmitting}
              className="h-12 rounded-lg bg-[var(--color-vote-primary)] px-5 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? "Mengirim..." : "Kirim Suara"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
