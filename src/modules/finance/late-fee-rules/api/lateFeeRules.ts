import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { formatAmount } from "../../shared";

/* FIXED: the slab's amount is the fee. PER_DAY: the amount is added for each day of the slab */
export const CHARGE_TYPES = ["FIXED", "PER_DAY"] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

/* Days fromDay..toDay of delay after the grace period (toDay null: and beyond) */
export type Slab = { id?: string; fromDay: number; toDay: number | null; chargeType: ChargeType; amount: number };

export type LateFeeRule = {
  id: string;
  name: string;
  description: string | null;
  graceDays: number;
  /* Most an invoice can be charged under the rule */
  maxAmount: number | null;
  /* One per school: used by structures without a rule of their own */
  isDefault: boolean;
  slabs: Slab[];
  createdAt: string;
  updatedAt: string;
};

export type RuleInput = {
  name: string;
  description?: string;
  graceDays: number;
  /* PATCH: null removes the cap */
  maxAmount?: number | null;
  isDefault: boolean;
  /* Omit toDay on the last slab for "and beyond" */
  slabs: { fromDay: number; toDay?: number; chargeType: ChargeType; amount: number }[];
};

export const RULES_PATH = "/finance/late-fee-rules";
export const MAX_SLABS = 20;

export const createRule = (body: RuleInput) => api.post<LateFeeRule>(RULES_PATH, body);
export const updateRule = ({ id, ...body }: Partial<RuleInput> & { id: string }) => api.patch<LateFeeRule>(`${RULES_PATH}/${id}`, body);
export const removeRule = (id: string) => api.delete<unknown>(`${RULES_PATH}/${id}`);

/* "1–7 d: 50 · 8–30 d: 200 · 31+ d: 10/day" */
export const slabsSummary = (slabs: Slab[]) =>
  slabs
    .map(s => `${s.toDay === null ? `${s.fromDay}+` : `${s.fromDay}–${s.toDay}`} d: ${formatAmount(s.amount)}${s.chargeType === "PER_DAY" ? "/day" : ""}`)
    .join(" · ");

/* Every rule, for the fee structure picker */
export function useRuleOptions(enabled = true) {
  const { can } = useAuth();
  const allowed = enabled && can("finance.lateFeeRules.read");
  const q = useQuery({
    queryKey: [RULES_PATH, { all: true }],
    enabled: allowed,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: LateFeeRule[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await api.get<LateFeeRule[]>(RULES_PATH, { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows;
    }
  });
  const rules = q.data ?? [];
  const byId = useMemo(() => new Map(rules.map(r => [r.id, r])), [rules]);
  return { allowed, rules, byId, defaultRule: rules.find(r => r.isDefault) ?? null, isLoading: q.isLoading };
}
