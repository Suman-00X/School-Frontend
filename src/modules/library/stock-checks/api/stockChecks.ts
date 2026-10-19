import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import type { ScanOutcome, StockCheck, StockCheckSummary } from "../../shared/api/types";

export const STOCK_CHECKS_PATH = "/library/stock-checks";

const invalidate = [STOCK_CHECKS_PATH];

export const useStockCheck = (id: string) => useApiGet<StockCheck & { summary: StockCheckSummary }>(`${STOCK_CHECKS_PATH}/${id}`);

export const useStartStockCheck = () =>
  useApiMutation((body: { title: string; notes?: string }) => api.post<StockCheck>(STOCK_CHECKS_PATH, body), { invalidate });

export const sendScans = (id: string, codes: string[]) =>
  api.post<{ results: ScanOutcome[]; summary: StockCheckSummary }>(`${STOCK_CHECKS_PATH}/${id}/scans`, { codes });

/* Closing marks copies MISSING and may move holds: copies and holds change too */
export const useCloseStockCheck = () =>
  useApiMutation((id: string) => api.post<StockCheck>(`${STOCK_CHECKS_PATH}/${id}/closure`), {
    invalidate: [STOCK_CHECKS_PATH, "/library/copies", "/library/books", "/library/catalogue", "/library/holds"]
  });
