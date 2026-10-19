import { useEffect, useState } from "react";

/* "08:45:00" → "8:45 AM" in the device's clock style */
export function formatClock(value: string | null | undefined) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h)) return value;
  return new Date(2026, 0, 1, h, m || 0).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* "08:45:00" → minutes since midnight */
export const minutesOf = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
};

/* The current time, refreshed every minute (for "now" highlights) */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* The API's weekday (1 = Monday … 7 or 0 = Sunday) is today? */
export const isWeekdayToday = (weekday: number, now = new Date()) => weekday % 7 === now.getDay();

/* "2026-08" → "August 2026" */
export const monthName = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

/* 2 → "2nd" */
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* A date-only value is before today (device calendar) */
export const isPast = (date: string, today: string) => date < today;
