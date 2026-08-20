"use client";

import { useEffect, useRef, useState } from "react";

interface LiveProgressBarProps {
  /** Percentage (0–100) for candidate 1 (left / red) */
  percent1: number;
  /** Name of candidate 1 */
  name1: string;
  /** Name of candidate 2 */
  name2: string;
}

/**
 * Dual-color progress bar showing the vote split between two candidates.
 * Left side (red) = candidate 1. Right side (blue) = candidate 2.
 * Animates smoothly via CSS transition when percentages change.
 *
 * Inspired by Progressbar.tsx from _reference/e-pilketos
 */
export function LiveProgressBar({ percent1, name1, name2 }: LiveProgressBarProps) {
  const [currentPercent1, setCurrentPercent1] = useState(percent1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Tiny delay so CSS transition is visible on initial render
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

  return (
    <div className="space-y-3">
      {/* Labels */}
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-red-400">{currentPercent1.toFixed(1)}%</span>
        <span className="text-indigo-400">{percent2.toFixed(1)}%</span>
      </div>

      {/* Bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-indigo-600">
        <div
          className="h-full rounded-full bg-red-500"
          style={{
            width: `${currentPercent1}%`,
            transition: "width 2s ease-in-out",
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-white/80">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full bg-red-500"
            aria-hidden="true"
          />
          {name1}
        </span>
        <span className="flex items-center gap-2 text-white/80">
          {name2}
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full bg-indigo-600"
            aria-hidden="true"
          />
        </span>
      </div>
    </div>
  );
}
