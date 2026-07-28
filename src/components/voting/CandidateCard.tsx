"use client";

/* eslint-disable @next/next/no-img-element */

import type { VotingCandidate } from "@/lib/vote/client-state";

interface CandidateCardProps {
  candidate: VotingCandidate;
  selected: boolean;
  onSelect: (candidate: VotingCandidate) => void;
  onDetail: (candidate: VotingCandidate) => void;
}

export function CandidateCard({ candidate, selected, onSelect, onDetail }: CandidateCardProps) {
  const initials = candidate.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <article
      className={`flex h-full flex-col rounded-lg border bg-white p-5 shadow-sm transition ${
        selected
          ? "border-2 border-[var(--color-vote-border-selected)] bg-[var(--color-vote-selected)] shadow-lg"
          : "border-neutral-200 hover:border-[var(--color-primary-300)] hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-600)] text-lg font-bold text-white">
          {candidate.orderNumber}
        </span>
        {candidate.photoUrl ? (
          <img
            src={candidate.photoUrl}
            alt={`Foto ${candidate.name}`}
            className="h-20 w-20 rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xl font-semibold text-emerald-700">
            {initials || candidate.orderNumber}
          </div>
        )}
      </div>

      <div className="mt-5 flex-1">
        <h2 className="text-xl font-semibold leading-7 text-neutral-950">{candidate.name}</h2>
        <p className="mt-1 text-sm font-medium text-neutral-500">{candidate.className}</p>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-[var(--color-primary-700)]">Visi</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-700">{candidate.vision}</p>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-[var(--color-primary-700)]">Misi</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-neutral-700">
            {candidate.missions.slice(0, 2).map((mission) => (
              <li key={mission} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                />
                <span>{mission}</span>
              </li>
            ))}
          </ul>
          {candidate.missions.length > 2 ? (
            <button
              type="button"
              onClick={() => onDetail(candidate)}
              className="mt-2 text-sm font-semibold text-[var(--color-primary-700)] underline-offset-4 hover:underline"
            >
              Lihat Selengkapnya
            </button>
          ) : null}
        </section>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onDetail(candidate)}
          className="h-11 rounded-lg border border-[var(--color-primary-200)] px-4 text-sm font-semibold text-[var(--color-primary-700)] transition hover:bg-[var(--color-primary-50)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)]"
        >
          Lihat Detail
        </button>
        <button
          type="button"
          onClick={() => onSelect(candidate)}
          className="h-11 rounded-lg bg-[var(--color-vote-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-vote-primary)] focus:ring-offset-2"
        >
          {selected ? "Terpilih" : "Pilih"}
        </button>
      </div>
    </article>
  );
}
