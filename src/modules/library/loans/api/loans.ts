import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import type { BorrowerAccount, FineMethod, FinePayment, FineWaiver, Loan, ReturnCondition } from "../../shared/api/types";

export const LOANS_PATH = "/library/loans";

/* Circulation changes loans, accounts, copies, holds, the catalogue and the reports */
export const CIRCULATION_INVALIDATES = [
  LOANS_PATH,
  "/library/borrowers",
  "/library/copies",
  "/library/books",
  "/library/catalogue",
  "/library/holds",
  "/library/reports"
];

export type IssueInput = {
  borrowerUserId: string;
  copyId?: string;
  accessionNumber?: string;
  issuedOn?: string;
  backdateReason?: string;
  dueDate?: string;
  overrideReason?: string;
};

export type ReturnInput = { id: string; condition: ReturnCondition; damageCharge?: number; notes?: string };
export type PayInput = { id: string; amount: number; method: FineMethod; reference?: string };
export type WaiveInput = { id: string; amount?: number; reason: string };

export const useLoan = (loanId: string | null) => useApiGet<Loan>(loanId ? `${LOANS_PATH}/${loanId}` : null);

export const useAccount = (userId: string | null, enabled = true) =>
  useApiGet<BorrowerAccount>(userId ? `/library/borrowers/${userId}/account` : null, undefined, { enabled });

const opts = { invalidate: CIRCULATION_INVALIDATES };

export const useIssue = () => useApiMutation((body: IssueInput) => api.post<Loan>(LOANS_PATH, body), opts);

export const useReturn = () => useApiMutation(({ id, ...body }: ReturnInput) => api.post<Loan>(`${LOANS_PATH}/${id}/return`, body), opts);

export const useRenew = () => useApiMutation((id: string) => api.post<Loan>(`${LOANS_PATH}/${id}/renewal`), opts);

export const useRecordFound = () =>
  useApiMutation(({ id, notes }: { id: string; notes?: string }) => api.post<Loan>(`${LOANS_PATH}/${id}/recovery`, notes ? { notes } : {}), opts);

export const usePayFine = () =>
  useApiMutation(({ id, ...body }: PayInput) => api.post<FinePayment & { loan: Loan }>(`${LOANS_PATH}/${id}/fine-payment`, body), opts);

export const useWaiveFine = () =>
  useApiMutation(({ id, ...body }: WaiveInput) => api.post<FineWaiver & { loan: Loan }>(`${LOANS_PATH}/${id}/fine-waiver`, body), opts);

/* The open loan of a copy (return mode) */
export async function findOpenLoan(copyId: string): Promise<Loan | null> {
  const res = await api.get<Loan[]>(LOANS_PATH, { copyId, status: "ISSUED", limit: 1 });
  return res.data[0] ?? null;
}
