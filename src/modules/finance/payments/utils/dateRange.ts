import { todayIso } from "@/common/utils/format";

/* The payments, refunds and settlements lists filter by date only when both ends are sent
   (journal: the server refuses one alone). A single end is completed here: from a day up to
   today, or everything up to a day. */
const EARLIEST = "2000-01-01";

export function dateRange(from: string, to: string): { from?: string; to?: string } {
  if (!from && !to) return {};
  const start = from || EARLIEST;
  const end = to || (from > todayIso() ? from : todayIso());
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}
