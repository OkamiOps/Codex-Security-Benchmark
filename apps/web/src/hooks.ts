import { useEffect, useState } from "react";

/** Ticks every second while `active` is true. */
export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return now;
}

/** Elapsed ms from startedAt; live-updates when status is running. */
export function useElapsedMs(
  startedAt: string | null | undefined,
  status: string | null | undefined,
  completedAt?: string | null,
): number | null {
  const running = status === "running";
  const now = useNow(running);

  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;

  if (running) return Math.max(0, now - start);

  if (completedAt) {
    const end = Date.parse(completedAt);
    if (!Number.isNaN(end)) return Math.max(0, end - start);
  }

  return Math.max(0, Date.now() - start);
}
