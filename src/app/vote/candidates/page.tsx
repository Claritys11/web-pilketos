"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CandidateCard } from "@/components/voting/CandidateCard";
import { CandidateDetailModal } from "@/components/voting/CandidateDetailModal";
import { FullscreenOverlay } from "@/components/voting/FullscreenOverlay";
import { Stepper } from "@/components/voting/Stepper";
import {
  loadVotingSession,
  saveVotingSession,
  type VotingCandidate,
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

export default function VoteCandidatesPage() {
  const router = useRouter();
  const [session, setSession] = useState<VotingSession | null>(null);
  const [candidates, setCandidates] = useState<VotingCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<VotingCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedSession = loadVotingSession();
    if (!storedSession) {
      router.replace("/vote");
      return;
    }

    const timeout = window.setTimeout(() => {
      setSession(storedSession);
      setSelectedId(storedSession.selectedCandidate?.id ?? null);
    }, 0);

    void fetch(`/api/vote/candidates?electionId=${encodeURIComponent(storedSession.electionId)}`)
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<{ items: VotingCandidate[] }>;
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error?.message ?? "Daftar kandidat belum tersedia.");
        }
        setCandidates(result.data.items);
      })
      .catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : "Gagal memuat kandidat.");
      })
      .finally(() => setIsLoading(false));

    return () => window.clearTimeout(timeout);
  }, [router]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) ?? null,
    [candidates, selectedId],
  );

  function selectCandidate(candidate: VotingCandidate) {
    setSelectedId(candidate.id);
    if (session) {
      saveVotingSession({ ...session, selectedCandidate: candidate });
      setSession({ ...session, selectedCandidate: candidate });
    }
  }

  function continueToConfirm() {
    if (selectedCandidate && session) {
      saveVotingSession({ ...session, selectedCandidate });
      router.push("/vote/confirm");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-28 pt-8 sm:px-8 lg:pt-12">
      <FullscreenOverlay />
      <Stepper currentStep={2} />

      <header className="mt-8 flex flex-col gap-2 sm:mt-10">
        <p className="text-sm font-semibold text-[var(--color-primary-700)]">
          {session?.electionTitle ?? "Pilketos"}
        </p>
        <h1 className="text-3xl font-bold leading-tight text-neutral-950 sm:text-4xl">
          Pilih satu kandidat
        </h1>
      </header>

      {isLoading ? (
        <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6 text-neutral-600">
          Memuat daftar kandidat...
        </div>
      ) : error ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : (
        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              selected={candidate.id === selectedId}
              onSelect={selectCandidate}
              onDetail={setDetailCandidate}
            />
          ))}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-5 py-4 shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-6 text-sm font-medium text-neutral-600">
            {selectedCandidate
              ? `Pilihan sementara: ${selectedCandidate.name}`
              : "Belum ada kandidat dipilih."}
          </p>
          <button
            type="button"
            onClick={continueToConfirm}
            disabled={!selectedCandidate}
            className="h-12 rounded-lg bg-[var(--color-vote-primary)] px-6 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2 disabled:opacity-50 sm:w-56"
          >
            Lanjut
          </button>
        </div>
      </div>

      <CandidateDetailModal candidate={detailCandidate} onClose={() => setDetailCandidate(null)} />
    </main>
  );
}
