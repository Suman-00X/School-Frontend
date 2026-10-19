import { useCallback } from "react";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";

/* Amounts in the school's currency: const money = useMoney(); money(1250) */
export function useMoney() {
  const currency = useSchoolCurrency();
  return useCallback((amount: number | string | null | undefined) => formatMoney(amount ?? 0, currency), [currency]);
}
