"use client";

/* eslint-disable @next/next/no-img-element */

import type { VotingCandidate } from "@/lib/vote/client-state";

interface CandidateDetailModalProps {
  candidate: VotingCandidate | null;
  onClose: () => void;
}

export function CandidateDetailModal({ candidate, onClose }: CandidateDetailModalProps) {
  if (!candidate) {
    return null;
  }

  const initials = candidate.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <section
        aria-modal="true"
        role="dialog"
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="grid gap-5 border-b border-neutral-200 p-5 sm:grid-cols-[220px_1fr_auto]">
          <div className="relative h-64 overflow-hidden rounded-lg bg-red-50 sm:h-72">
            {candidate.photoUrl ? (
              <img
                src={candidate.photoUrl}
                alt={`Foto ${candidate.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-5xl font-bold text-[var(--color-primary-700)]">
                {initials || candidate.orderNumber}
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-bold text-[var(--color-primary-700)] shadow">
              No. {candidate.orderNumber}
            </div>
          </div>
          <div className="self-center">
            <p className="text-sm font-semibold uppercase text-[var(--color-primary-700)]">
              Detail Kandidat
            </p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-neutral-950">
              {candidate.name}
            </h2>
            <p className="mt-2 text-base font-medium text-neutral-500">{candidate.className}</p>
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
