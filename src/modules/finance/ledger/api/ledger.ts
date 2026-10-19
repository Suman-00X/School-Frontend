import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type ListMeta, type Query } from "@/common/api";
import { useApiGet, useApiList, useApiMutation } from "@/common/hooks";
import type { Option } from "@/common/ui";
import type { ActorBrief, StudentBrief } from "../../shared/api/records";

export const LEDGER_PATH = "/finance/ledger";

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses"
};

export const ACCOUNT_TYPE_HINTS: Record<AccountType, string> = {
  ASSET: "What the school has or is owed (cash, bank)",
  LIABILITY: "What the school owes (advances, payables)",
  EQUITY: "The school's own funds",
  INCOME: "Money earned (fees, grants, donations)",
  EXPENSE: "Money spent (salaries, bills, repairs)"
};

/* Kept by their sub-ledgers (invoices, student credit): no manual journal lines */
export const CONTROL_KEYS = ["RECEIVABLES", "STUDENT_CREDIT"];

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  isContra: boolean;
  systemKey: string | null;
  feeHeadId: string | null;
  description: string | null;
  feeHead: { id: string; name: string; code: string } | null;
  isSystem: boolean;
  normalBalance: "DEBIT" | "CREDIT";
};

export const accountLabel = (a: Pick<LedgerAccount, "code" | "name">) => `${a.code} ${a.name}`;

/* The whole chart of accounts (a school has tens of accounts, not thousands) */
export function useAllAccounts(enabled = true) {
  const q = useQuery({
    queryKey: [`${LEDGER_PATH}/accounts`, { all: true }],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const rows: LedgerAccount[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await api.get<LedgerAccount[]>(`${LEDGER_PATH}/accounts`, { page, limit: 100 });
        rows.push(...res.data);
        if (!res.meta || page >= res.meta.totalPages) break;
      }
      return rows.sort((a, b) => a.code.localeCompare(b.code));
    }
  });
  return { ...q, accounts: q.data ?? [] };
}

export function useAccountOptions({ manualOnly = false }: { manualOnly?: boolean } = {}) {
  const { accounts, isLoading } = useAllAccounts();
  const options = useMemo<Option[]>(
    () =>
      accounts
        .filter(a => !manualOnly || !CONTROL_KEYS.includes(a.systemKey ?? ""))
        .map(a => ({ value: a.id, label: accountLabel(a), description: ACCOUNT_TYPE_LABELS[a.accountType] })),
    [accounts, manualOnly]
  );
  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  return { options, byId, isLoading };
}

export const useAccount = (accountId: string | null) => useApiGet<LedgerAccount>(accountId ? `${LEDGER_PATH}/accounts/${accountId}` : null);

export type AccountInput = { code: string; name: string; accountType: AccountType; isContra?: boolean; description?: string };

export const createAccount = (body: AccountInput) => api.post<LedgerAccount>(`${LEDGER_PATH}/accounts`, body);
export const updateAccount = ({ id, ...body }: { id: string; name?: string; description?: string }) => api.patch<LedgerAccount>(`${LEDGER_PATH}/accounts/${id}`, body);
export const removeAccount = (id: string) => api.delete<null>(`${LEDGER_PATH}/accounts/${id}`);

export const useLedgerMutation = <V, D>(fn: (v: V) => Promise<{ data: D; message: string }>) => useApiMutation(fn, { invalidate: [LEDGER_PATH] });

/* ---- account ledger ---- */

export type LedgerLine = {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  narration: string;
  sourceType: string;
  sourceId: string;
  lineId: string;
  debit: number;
  credit: number;
  studentId: string | null;
  memo: string | null;
  /* Running balance, in the account's normal direction */
  balance: number;
};

export type LedgerMeta = ListMeta & {
  account: { accountId: string; code: string; name: string; accountType: AccountType; isContra: boolean; normalBalance: "DEBIT" | "CREDIT" };
  from: string | null;
  to: string;
  openingBalance: number;
  debits: number;
  credits: number;
  closingBalance: number;
};

export function useAccountLedger(accountId: string, query: { from?: string; to?: string; studentId?: string; page?: number; limit?: number }) {
  const path = `${LEDGER_PATH}/accounts/${accountId}/ledger`;
  return useQuery({
    queryKey: [path, query],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const res = await api.get<LedgerLine[]>(path, query as Query, { signal });
      return { rows: res.data, meta: res.meta as LedgerMeta, message: res.message };
    }
  });
}

/* ---- journal ---- */

export const SOURCE_TYPES = ["INVOICE", "PAYMENT", "REFUND", "STUDENT_CREDIT", "SETTLEMENT", "MANUAL"] as const;

export const SOURCE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  PAYMENT: "Payment",
  REFUND: "Refund",
  STUDENT_CREDIT: "Student credit",
  SETTLEMENT: "Gateway settlement",
  MANUAL: "Manual entry"
};

export const sourceLabel = (t: string) => SOURCE_LABELS[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");

export type JournalLine = {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  studentId: string | null;
  memo: string | null;
  account: { id: string; code: string; name: string; accountType: AccountType };
  student: StudentBrief | null;
};

export type JournalEntry = {
  id: string;
  sequence: number;
  entryNumber: string;
  entryDate: string;
  narration: string;
  sourceType: string;
  sourceId: string;
  event: string;
  total: number;
  reversalOfId: string | null;
  postedBy: string | null;
  lines: JournalLine[];
  poster: ActorBrief | null;
  createdAt: string;
};

export type JournalFilters = { from?: string; to?: string; sourceType?: string; sourceId?: string; accountId?: string; studentId?: string; page?: number; limit?: number };

export const useJournal = (filters: JournalFilters, opts: { enabled?: boolean } = {}) => useApiList<JournalEntry>(`${LEDGER_PATH}/journal-entries`, filters as Query, opts);

export const useJournalEntry = (entryId: string | null) => useApiGet<JournalEntry>(entryId ? `${LEDGER_PATH}/journal-entries/${entryId}` : null);

export type ManualEntryInput = { date?: string; narration: string; lines: { accountId: string; debit?: number; credit?: number; memo?: string }[] };

export const postEntry = (body: ManualEntryInput) => api.post<JournalEntry>(`${LEDGER_PATH}/journal-entries`, body);

export const reverseEntry = ({ entryId, reason, date }: { entryId: string; reason: string; date?: string }) =>
  api.post<JournalEntry>(`${LEDGER_PATH}/journal-entries/${entryId}/reversal`, { reason, date });

/* ---- reports ---- */

export type TrialBalance = {
  asOf: string;
  accounts: { accountId: string; code: string; name: string; accountType: AccountType; isContra: boolean; debit: number; credit: number }[];
  totals: { debit: number; credit: number };
  balanced: boolean;
};

export const useTrialBalance = (asOf: string) =>
  useQuery({
    queryKey: [`${LEDGER_PATH}/trial-balance`, { asOf }],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => (await api.get<TrialBalance>(`${LEDGER_PATH}/trial-balance`, { asOf: asOf || undefined }, { signal })).data
  });

type SummaryAccount = { accountId: string; code: string; name: string; accountType: AccountType; isContra: boolean; amount: number };

export type IncomeSummary = {
  from: string;
  to: string;
  feeIncome: { byFeeHead: SummaryAccount[]; total: number };
  lateFees: number;
  /* Negative: contra-income */
  concessions: number;
  otherIncome: { accounts: SummaryAccount[]; total: number };
  netIncome: number;
  expenses: { accounts: SummaryAccount[]; total: number };
  surplus: number;
};

export const useIncomeSummary = (from: string, to: string) =>
  useQuery({
    queryKey: [`${LEDGER_PATH}/income-summary`, { from, to }],
    enabled: !!from && !!to && from <= to,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => (await api.get<IncomeSummary>(`${LEDGER_PATH}/income-summary`, { from, to }, { signal })).data
  });
