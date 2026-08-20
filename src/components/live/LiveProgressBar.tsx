"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, Award } from "lucide-react";

interface LiveProgressBarProps {
  /** Percentage (0–100) for candidate 1 (left / red) */
  percent1: number;
  /** Name of candidate 1 */
  name1: string;
  /** Name of candidate 2 */
  name2: string;
  /** Vote count of candidate 1 */
  voteCount1?: number;
  /** Vote count of candidate 2 */
  voteCount2?: number;
}

/**
 * Broadcast-grade dual-color progress bar showing live vote distribution.
 * Uses high-contrast red vs sky/blue gradients with ambient glows.
 */
export function LiveProgressBar({
  percent1,
  name1,
  name2,
  voteCount1 = 0,
  voteCount2 = 0,
}: LiveProgressBarProps) {
  const [currentPercent1, setCurrentPercent1] = useState(percent1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setCurrentPercent1(percent1);
    }, 80);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [percent1]);

  const percent2 = 100 - currentPercent1;
  const leadDiff = Math.abs(currentPercent1 - percent2);
  const isCand1Leading = currentPercent1 > percent2;
  const isTied = Math.abs(currentPercent1 - percent2) < 0.05;

  return (
    <div className="w-full space-y-4">
      {/* Top Header Labels */}
      <div className="flex items-center justify-between text-sm sm:text-base font-semibold">
        {/* Candidate 1 Pill */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          </span>
          <span className="text-slate-200 font-bold max-w-[180px] sm:max-w-[280px] truncate">
            {name1}
          </span>
          <span className="tabular-nums text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
            {voteCount1} suara
          </span>
        </div>

        {/* Candidate 2 Pill */}
        <div className="flex items-center gap-2.5 flex-row-reverse">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
          </span>
          <span className="text-slate-200 font-bold max-w-[180px] sm:max-w-[280px] truncate text-right">
            {name2}
          </span>
          <span className="tabular-nums text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
            {voteCount2} suara
          </span>
        </div>
      </div>

      {/* Main Dual Bar Track */}
      <div className="relative h-6 sm:h-7 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800 shadow-inner p-0.5">
        {/* Candidate 1 Bar (Red) */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] relative overflow-hidden"
          style={{
            width: `${currentPercent1}%`,
            transition: "width 2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Subtle light shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        </div>

        {/* Divider Glow Marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,1)] z-10 transition-all duration-1000"
          style={{
            left: `${currentPercent1}%`,
            transition: "left 2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>

      {/* Bottom Ticker & Split Percentage */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-400 pt-1">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          {isTied ? (
            <span className="text-slate-300">Suara seimbang</span>
          ) : (
            <span className="flex items-center gap-1">
              <Award className={`h-3.5 w-3.5 ${isCand1Leading ? "text-red-400" : "text-sky-400"}`} />
              <strong className={isCand1Leading ? "text-red-400" : "text-sky-400"}>
                {isCand1Leading ? name1 : name2}
              </strong>
              <span>unggul</span>
              <strong className="text-slate-200 font-mono">
                +{leadDiff.toFixed(1)}%
              </strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono font-semibold text-xs sm:text-sm">
          <span className="text-red-400">{currentPercent1.toFixed(1)}%</span>
          <span className="text-slate-600">:</span>
          <span className="text-sky-400">{percent2.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
