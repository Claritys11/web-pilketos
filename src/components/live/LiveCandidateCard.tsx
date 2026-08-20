"use client";

import Image from "next/image";
import { User, Sparkles } from "lucide-react";

interface LiveCandidateCardProps {
  orderNumber: number;
  name: string;
  className: string;
  photoUrl?: string | null | undefined;
  align?: "left" | "right";
  isLeader?: boolean | undefined;
}

/**
 * Broadcast display card for candidate profile photo and details in Live Mode.
 * Features ambient backlight glow, glassmorphism, and high-legibility typography.
 */
export function LiveCandidateCard({
  orderNumber,
  name,
  className,
  photoUrl,
  align = "left",
  isLeader = false,
}: LiveCandidateCardProps) {
  const isRight = align === "right";
  const isFirst = orderNumber === 1;

  // Accent color themes based on candidate order number
  const theme = isFirst
    ? {
        badgeBg: "bg-red-600/90 border-red-500/40 text-white",
        glow: "shadow-[0_0_60px_-10px_rgba(220,38,38,0.35)]",
        border: "border-red-500/30 hover:border-red-500/50",
        accentText: "text-red-400",
        badgeGradient: "from-red-600 to-rose-600",
      }
    : {
        badgeBg: "bg-sky-600/90 border-sky-500/40 text-white",
        glow: "shadow-[0_0_60px_-10px_rgba(14,165,233,0.35)]",
        border: "border-sky-500/30 hover:border-sky-500/50",
        accentText: "text-sky-400",
        badgeGradient: "from-sky-600 to-indigo-600",
      };

  return (
    <div
      className={`relative flex flex-col items-center sm:flex-row gap-6 sm:gap-7 p-6 sm:p-7 rounded-3xl bg-slate-900/70 border ${theme.border} backdrop-blur-xl ${theme.glow} transition-all duration-500 ${
        isRight ? "sm:flex-row-reverse text-right" : "text-left"
      }`}
    >
      {/* Leader Sparkle Tag */}
      {isLeader && (
        <div
          className={`absolute -top-3.5 ${
            isRight ? "right-8" : "left-8"
          } inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${
            theme.badgeGradient
          } text-[11px] font-bold text-white uppercase tracking-wider shadow-lg z-20`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Unggul Sementara
        </div>
      )}

      {/* Candidate Photo Showcase Container */}
      <div className="relative w-40 h-52 sm:w-48 sm:h-64 rounded-2xl overflow-hidden bg-slate-950 shrink-0 border border-slate-700/60 shadow-2xl group">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 160px, 192px"
            priority
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-gradient-to-b from-slate-900 to-slate-950">
            <User className="w-14 h-14 mb-2 stroke-[1.5] text-slate-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tanpa Foto
            </span>
          </div>
        )}

        {/* Gradient vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />

        {/* Floating Number Badge on Photo */}
        <div
          className={`absolute top-3 ${
            isRight ? "right-3" : "left-3"
          } flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/80 border border-white/20 text-white font-black text-sm backdrop-blur-md shadow-xl`}
        >
          0{orderNumber}
        </div>
      </div>

      {/* Candidate Metadata */}
      <div className="flex flex-col justify-center min-w-0 space-y-2">
        <div
          className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${theme.accentText}`}
        >
          <span>Kandidat Nomor #{orderNumber}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight max-w-[240px] sm:max-w-[300px] break-words">
          {name}
        </h2>

        <div className="pt-1">
          <span className="inline-block px-3 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-xs font-semibold text-slate-300 shadow-sm">
            {className}
          </span>
        </div>
      </div>
    </div>
  );
}
