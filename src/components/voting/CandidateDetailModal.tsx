"use client";

import type { VotingCandidate } from "@/lib/vote/client-state";

interface CandidateDetailModalProps {
  candidate: VotingCandidate | null;
  onClose: () => void;
}

export function CandidateDetailModal({ candidate, onClose }: CandidateDetailModalProps) {
  if (!candidate) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        aria-modal="true"
        role="dialog"
        className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--color-primary-700)]">
              Kandidat Nomor {candidate.orderNumber}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-950">{candidate.name}</h2>
            <p className="text-sm text-neutral-500">{candidate.className}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail kandidat"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-neutral-200 text-xl text-neutral-600 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)]"
          >
            ×
          </button>
        </header>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          <section>
            <h3 className="text-sm font-semibold text-[var(--color-primary-700)]">Visi</h3>
            <p className="mt-2 text-base leading-7 text-neutral-800">{candidate.vision}</p>
          </section>
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--color-primary-700)]">Misi</h3>
            <ul className="mt-3 space-y-3">
              {candidate.missions.map((mission) => (
                <li
                  key={mission}
                  className="rounded-lg bg-neutral-50 p-3 text-sm leading-6 text-neutral-700"
                >
                  {mission}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
