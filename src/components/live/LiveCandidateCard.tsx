"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { LiveCounterAnimation } from "@/components/live/LiveCounterAnimation";

interface LiveCandidateCardProps {
  orderNumber: number;
  name: string;
  className: string;
  photoUrl?: string | null | undefined;
  align?: "left" | "right";
  isLeader?: boolean | undefined;
  percentage: number;
  voteCount: number;
}

/**
 * Broadcast display card for candidate profile in Live Mode — light-mode glass variant.
 * Layout: photo (circle), name/class, then large % number at bottom. Leader has a
 * coloured corner ribbon and a subtle ambient red glow.
 */
export function LiveCandidateCard({
  orderNumber,
  name,
  className,
  photoUrl,
  align = "left",
  isLeader = false,
  percentage,
  voteCount,
}: LiveCandidateCardProps) {
  const isRight = align === "right";
  const isFirst = orderNumber === 1;

  const accentColor = isFirst ? "#c00018" : "#5d3f3c";
  const accentBg = isFirst ? "bg-[#e7232a]" : "bg-[#5d3f3c]";
  const glow = isLeader
    ? "shadow-[0_0_40px_-10px_rgba(231,35,42,0.2)] border border-[rgba(231,35,42,0.2)]"
    : "border border-white/40 shadow-sm";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.4)",
        borderLeft: "1px solid rgba(255,255,255,0.4)",
      }}
      className={`relative rounded-2xl h-full p-6 flex flex-col overflow-hidden ${glow}`}
    >
      {/* Leader corner ribbon */}
      {isLeader && (
        <div
          className={`absolute top-0 ${isRight ? "left-0 rounded-br-xl rounded-tl-xl" : "right-0 rounded-bl-xl rounded-tr-xl"} ${accentBg} text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 z-10 flex items-center gap-1`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          UNGGUL
        </div>
      )}

      {/* Candidate info row */}
      <div
        className={`flex items-start gap-5 mb-6 relative z-10 ${isRight ? "flex-row-reverse text-right" : ""}`}
      >
        {/* Avatar */}
        <div className="w-[88px] h-[88px] rounded-full overflow-hidden border-4 border-white shadow-md bg-[#e4e2e1] flex-shrink-0">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              width={88}
              height={88}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-10 h-10 text-[#926f6b]" />
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col justify-center min-w-0">
          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-[#926f6b]">
            Kandidat {orderNumber}
          </span>
          <h2 className="mt-0.5 text-xl font-bold text-[#1b1c1c] leading-tight break-words max-w-[200px]">
            {name}
          </h2>
          <span className="mt-1 text-sm font-medium" style={{ color: accentColor }}>
            {className}
          </span>
        </div>
      </div>

      {/* Vote stats — pinned to bottom */}
      <div
        className={`mt-auto relative z-10 flex flex-col ${isRight ? "items-end" : "items-start"}`}
      >
        <span
          className="font-black tracking-tighter leading-none tabular-nums"
          style={{
            fontSize: "clamp(2.5rem,5vw,3.5rem)",
            color: isLeader ? accentColor : "#1b1c1c",
            opacity: isLeader ? 1 : 0.75,
          }}
        >
          <LiveCounterAnimation value={percentage} durationMs={1400} decimals={1} suffix="%" />
        </span>
        <span className="mt-2 text-sm text-[#5d3f3c] flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="w-4 h-4 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-3-3v6M5 3h14a2 2 0 012 2v16l-4-4H5a2 2 0 01-2-2V5a2 2 0 012-2z"
            />
          </svg>
          {voteCount.toLocaleString("id-ID")} Suara
        </span>
      </div>

      {/* Decorative ambient blob */}
      {isLeader && (
        <div
          className={`absolute ${isRight ? "-top-16 -right-16" : "-bottom-16 -left-16"} w-52 h-52 rounded-full blur-3xl z-0 pointer-events-none`}
          style={{ background: "rgba(192,0,24,0.05)" }}
        />
      )}
    </div>
  );
}
