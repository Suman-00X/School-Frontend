import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import type { Hold } from "../../shared/api/types";

export const HOLDS_PATH = "/library/holds";

/* A hold changes its book's counts and may move a copy */
const invalidate = [HOLDS_PATH, "/library/books", "/library/catalogue", "/library/copies", "/library/borrowers"];

export const useHold = (holdId: string | null) => useApiGet<Hold>(holdId ? `${HOLDS_PATH}/${holdId}` : null);

export const usePlaceHold = () =>
  useApiMutation((body: { bookId: string; borrowerUserId: string; notNeededAfter?: string }) => api.post<Hold>(HOLDS_PATH, body), { invalidate });

export const useCancelHold = () =>
  useApiMutation(({ id, reason }: { id: string; reason?: string }) => api.post<Hold>(`${HOLDS_PATH}/${id}/cancellation`, reason ? { reason } : {}), { invalidate });
