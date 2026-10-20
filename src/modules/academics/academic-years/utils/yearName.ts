import type { AcademicYear } from "@/common/api";
import { formatDate } from "@/common/utils/format";

/* Mirrors the backend (academic-years/utils/yearName.util.js): the name comes from the dates,
   a year lasts at most 13 months, spans at most two calendar years and overlaps no other year.
   The server enforces all of it; this is for live hints. Dates are "YYYY-MM-DD". */

export const MAX_YEAR_MONTHS = 13;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (value: string) => DATE.test(value);

const parse = (d: string) => new Date(`${d}T00:00:00Z`);
const format = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (d: string, days: number) => {
  const date = parse(d);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
};

/* The same day `months` later, clamped to the month's end */
export const addMonths = (d: string, months: number) => {
  const [year, month, day] = d.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return format(target);
};

/* "2026-27" when it runs into the next calendar year, "2026" within one */
export const yearNameFor = (startDate: string, endDate: string) => {
  const start = startDate.slice(0, 4);
  const end = endDate.slice(0, 4);
  return start === end ? start : `${start}-${end.slice(2)}`;
};

/* The last day a year starting on `startDate` may end: 13 months, and within the next calendar year */
export const latestEndFor = (startDate: string) => {
  const byLength = addDays(addMonths(startDate, MAX_YEAR_MONTHS), -1);
  const byCalendar = `${Number(startDate.slice(0, 4)) + 1}-12-31`;
  return byLength < byCalendar ? byLength : byCalendar;
};

/* Why these dates can't make a year (the server's rules, worded for the form), or null */
export function yearDatesProblem(startDate: string, endDate: string, others: AcademicYear[], exceptId?: string): string | null {
  if (!isDate(startDate) || !isDate(endDate) || endDate <= startDate) return null;
  if (Number(endDate.slice(0, 4)) > Number(startDate.slice(0, 4)) + 1)
    return `An academic year spans at most two calendar years: starting ${formatDate(startDate)}, it must end by ${formatDate(latestEndFor(startDate))}`;
  const byLength = addDays(addMonths(startDate, MAX_YEAR_MONTHS), -1);
  if (endDate > byLength)
    return `An academic year lasts at most ${MAX_YEAR_MONTHS} months: starting ${formatDate(startDate)}, it must end by ${formatDate(byLength)}`;
  const other = others.find(y => y.id !== exceptId && y.startDate <= endDate && y.endDate >= startDate);
  if (other)
    return `Overlaps ${other.yearName} (${formatDate(other.startDate)} – ${formatDate(other.endDate)}). Academic years cannot overlap.`;
  return null;
}

/* The year right after one ending on `endDate`: from the next day, twelve months long */
export const nextYearDates = (endDate: string) => {
  const startDate = addDays(endDate, 1);
  return { startDate, endDate: addDays(addMonths(startDate, 12), -1) };
};
