import { formatDate } from "@/common/utils/format";

/* HR display helpers: months ("2026-09"), day counts, attendance statuses */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* "2026-09" -> "September 2026" */
export const monthLabel = (month: string | null | undefined) => {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : month;
};

/* "2026-09-01" -> "2026-09" */
export const monthOf = (date: string) => date.slice(0, 7);

export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/* Months from `from` to `to` (inclusive), newest first */
export const monthRange = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = to; m >= from; m = addMonths(m, -1)) out.push(m);
  return out;
};

/* 1 -> "1 day", 2.5 -> "2.5 days" */
export const dayCount = (days: number | null | undefined) => {
  const n = Number(days ?? 0);
  return `${n} day${n === 1 ? "" : "s"}`;
};

/* "2026-10-19" plus n days */
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

/* "09:15:00" -> "09:15" (for time inputs) */
export const clock = (time: string | null | undefined) => (time ? time.slice(0, 5) : "");

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE", "ON_DUTY"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/* Statuses that can carry check-in / check-out times */
export const TIMED_STATUSES: AttendanceStatus[] = ["PRESENT", "HALF_DAY", "ON_DUTY"];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "Leave",
  ON_DUTY: "On duty"
};

/* The one-key code shown on the grid's buttons, and the key that sets it */
export const ATTENDANCE_SHORT: Record<AttendanceStatus, { label: string; key: string }> = {
  PRESENT: { label: "P", key: "p" },
  ABSENT: { label: "A", key: "a" },
  HALF_DAY: { label: "½", key: "h" },
  LEAVE: { label: "L", key: "l" },
  ON_DUTY: { label: "OD", key: "o" }
};

export const CLOSURE_LABELS: Record<string, string> = {
  WEEKLY_OFF: "Weekly off",
  HOLIDAY: "Holiday",
  VACATION: "Vacation"
};

/* "19 Oct 2026" or "19 Oct 2026 – 23 Oct 2026" */
export const dateSpan = (from: string, to: string) => (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`);
