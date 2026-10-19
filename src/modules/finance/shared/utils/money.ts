import { useMemo } from "react";
import { useSchoolCurrency } from "@/modules/users/shared";
import { formatMoney } from "@/common/utils/format";

/* Money across finance: JSON numbers with at most 2 decimals, in the school's currency (D-16) */

/* "5,000.00" (no currency sign), for compact cells and summaries */
export const formatAmount = (amount: number | string | null | undefined) => {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

/* A typed amount → number with at most 2 decimals, or null when empty or not a number */
export const parseAmount = (text: string): number | null => {
  const t = text.replace(/,/g, "").trim();
  if (!t || !/^\d*(\.\d*)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/* More than 2 decimals? (the API refuses them) */
export const hasTooManyDecimals = (text: string) => /\.\d{3,}$/.test(text.replace(/,/g, "").trim());

/* Sum without floating-point drift (in paise) */
export const sumAmounts = (values: (number | null | undefined)[]) =>
  values.reduce<number>((total, v) => total + Math.round((v ?? 0) * 100), 0) / 100;

/* "₹" for INR, "$" for USD; the code itself when the device has no symbol for it */
export const currencySymbol = (currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(0).find(p => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
};

/* const money = useMoney(); money(5000) → "₹5,000.00" in the school's currency */
export function useMoney() {
  const currency = useSchoolCurrency();
  return useMemo(() => {
    const fn = (amount: number | string | null | undefined) => formatMoney(amount, currency);
    return Object.assign(fn, { currency, symbol: currencySymbol(currency) });
  }, [currency]);
}
