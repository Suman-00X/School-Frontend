import { useCallback, useEffect, useState } from "react";
import type { ApiError } from "@/common/api";

/* Seconds left before a rate-limited form may try again */
export function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const start = useCallback((seconds: number) => {
    const n = Date.now();
    setNow(n);
    setUntil(n + seconds * 1000);
  }, []);

  return { secondsLeft: Math.max(0, Math.ceil((until - now) / 1000)), start };
}

/* Retry-After when sent; the sign-in throttle only names minutes in its message ("Try again in 15 minute(s)") */
export function retryAfterSeconds(err: ApiError) {
  if (err.retryAfter) return err.retryAfter;
  const minutes = /(\d+)\s*minute/i.exec(err.message);
  return minutes ? Number(minutes[1]) * 60 : 60;
}

export const formatWait = (seconds: number) =>
  seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`;
