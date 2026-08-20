"use client";

import { useEffect, useRef, useState } from "react";

interface LiveCounterAnimationProps {
  /** Target percentage value (0–100) */
  value: number;
  /** Animation duration in ms */
  durationMs?: number;
  suffix?: string;
}

/**
 * Animates a numeric value from its previous state to the new target.
 * Uses requestAnimationFrame for smooth, non-blocking animation.
 *
 * Inspired by CountCandidatesInterval.tsx from _reference/e-pilketos
 */
export function LiveCounterAnimation({
  value,
  durationMs = 1000,
  suffix = "%",
}: LiveCounterAnimationProps) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;

    if (start === end) {
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      setDisplayed(Number(current.toFixed(1)));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, durationMs]);

  return (
    <span>
      {displayed.toFixed(1)}
      {suffix}
    </span>
  );
}
