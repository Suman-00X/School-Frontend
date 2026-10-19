import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import type { Option } from "@/common/ui";

/* What a fee is for: Tuition, Transport, Exam… (school-wide) */
export type FeeHead = {
  id: string;
  name: string;
  /* Upper case, 2–20 letters, digits, - or _ */
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeeHeadInput = { name: string; code: string; description?: string };

export const FEE_HEADS_PATH = "/finance/fee-heads";

export const createFeeHead = (body: FeeHeadInput) => api.post<FeeHead>(FEE_HEADS_PATH, body);
export const updateFeeHead = ({ id, ...body }: Partial<FeeHeadInput> & { id: string }) => api.patch<FeeHead>(`${FEE_HEADS_PATH}/${id}`, body);
export const removeFeeHead = (id: string) => api.delete<unknown>(`${FEE_HEADS_PATH}/${id}`);

/* Every fee head, for pickers (a school has a handful) */
export function useFeeHeadOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("finance.feeHeads.read");
  const q = useQuery({
    queryKey: [FEE_HEADS_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: FeeHead[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await api.get<FeeHead[]>(FEE_HEADS_PATH, { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows;
    }
  });
  const options = useMemo<Option[]>(() => (q.data ?? []).map(h => ({ value: h.id, label: h.name, description: h.code })), [q.data]);
  const byId = useMemo(() => new Map((q.data ?? []).map(h => [h.id, h])), [q.data]);
  return { allowed, heads: q.data ?? [], options, byId, isLoading: q.isLoading };
}
