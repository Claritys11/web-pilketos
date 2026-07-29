"use client";

import { useEffect } from "react";

export function useDashboardPolling(callback: () => void, enabled: boolean, intervalMs = 5000) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        callback();
      }
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [callback, enabled, intervalMs]);
}
