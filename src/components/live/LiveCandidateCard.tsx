"use client";

import Image from "next/image";
import { User } from "lucide-react";

interface LiveCandidateCardProps {
  orderNumber: number;
  name: string;
  className: string;
  photoUrl?: string | null | undefined;
  align?: "left" | "right";
}

/**
 * Display card for candidate profile photo and details in Live Mode.
 * Inspired by ImageProfile & CandidateCard from _reference/e-pilketos
 */
export function LiveCandidateCard({
  orderNumber,
  name,
  className,
  photoUrl,
  align = "left",
}: LiveCandidateCardProps) {
  const isRight = align === "right";

  return (
    <div
      className={`flex flex-col items-center sm:flex-row gap-6 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl ${
        isRight ? "sm:flex-row-reverse text-right" : "text-left"
      }`}
    >
      {/* Candidate Photo */}
      <div className="relative w-36 h-48 sm:w-44 sm:h-56 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-slate-700/50 shadow-inner">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 144px, 176px"
            priority
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/80">
            <User className="w-12 h-12 mb-2 stroke-[1.5]" />
            <span className="text-xs font-medium">Tanpa Foto</span>
          </div>
        )}
        <div className="absolute top-2 left-2 bg-red-600/90 text-white font-bold text-xs px-2.5 py-1 rounded-md backdrop-blur-sm shadow">
          #{orderNumber}
        </div>
      </div>

      {/* Candidate Metadata */}
      <div className="flex flex-col justify-center min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-1">
          Kandidat #{orderNumber}
        </span>
        <h2 className="text-xl sm:text-2xl font-bold text-white truncate max-w-[240px] sm:max-w-[280px]">
          {name}
        </h2>
        <p className="text-sm font-medium text-slate-400 mt-1">{className}</p>
      </div>
    </div>
  );
}
