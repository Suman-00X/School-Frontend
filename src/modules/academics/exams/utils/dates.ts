import { formatDate } from "@/common/utils/format";
import type { Exam } from "../api/exams";

/* "16 Jul 2026 – 23 Jul 2026", or one end, or "" */
export const examDates = (e: Pick<Exam, "startDate" | "endDate">) =>
  e.startDate && e.endDate
    ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}`
    : e.startDate
      ? `From ${formatDate(e.startDate)}`
      : e.endDate
        ? `Until ${formatDate(e.endDate)}`
        : "";
