"use client";

import { useEffect, useRef, useState } from "react";

interface LiveCounterAnimationProps {
  /** Target percentage value (0–100) */
  value: number;
  /** Animation duration in ms */
  durationMs?: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * Animates a numeric value from its previous state to the new target.
 * Uses requestAnimationFrame with cubic ease-out for smooth broadcast animation.
 * Enforces tabular-nums so digits do not jump around while animating.
 */
export function LiveCounterAnimation({
  value,
  durationMs = 1200,
  suffix = "%",
  decimals = 1,
  className = "",
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
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      setDisplayed(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
        setDisplayed(end);
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
    <span className={`tabular-nums font-mono ${className}`}>
      {displayed.toFixed(decimals)}
      {suffix}
    </span>
  );
}
