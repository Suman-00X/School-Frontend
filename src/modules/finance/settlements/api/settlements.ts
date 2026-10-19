import { api, type Query } from "@/common/api";
import { useApiList } from "@/common/hooks";

export const SETTLEMENTS_PATH = "/finance/settlements";

/* A payout from the payment gateway into the school's bank */
export type Settlement = {
  id: string;
  provider: string;
  settlementId: string;
  /* What reached the bank */
  amount: number;
  /* What the gateway kept, tax included */
  fees: number;
  tax: number;
  utr: string | null;
  settledAt: string;
  journalEntryId: string | null;
  journalEntry: { id: string; entryNumber: string; entryDate: string } | null;
};

export const useSettlements = (q: { from?: string; to?: string; page?: number; limit?: number }) => useApiList<Settlement>(SETTLEMENTS_PATH, q as Query);

export type ImportResult = {
  from: string;
  to: string;
  found: number;
  imported: number;
  alreadyImported: number;
  notYetProcessed: number;
  settlements: Settlement[];
};

/* Both optional: the last 7 days */
export const importSettlements = (body: { from?: string; to?: string }) => api.post<ImportResult>(`${SETTLEMENTS_PATH}/imports`, body);
