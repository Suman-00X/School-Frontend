import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { formatDate } from "@/common/utils/format";

export type Exam = { id: string; examName: string; examType: string; startDate: string; endDate: string; resultsPublishedAt: string | null };

/* Every exam of the header's year, newest first, for the picker */
export function useExams() {
  const { can } = useAuth();
  return useQuery({
    queryKey: ["/academics/exams", "all"],
    enabled: can("academics.exams.read"),
    staleTime: 60_000,
    queryFn: async () => {
      const rows: Exam[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await api.get<Exam[]>("/academics/exams", { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }
  });
}

export const examOption = (e: Exam) => ({
  value: e.id,
  label: e.examName,
  description: `${formatDate(e.startDate)} – ${formatDate(e.endDate)}${e.resultsPublishedAt ? " · results published" : ""}`
});
