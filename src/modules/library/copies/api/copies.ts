import { api } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import type { Book, Copy, CopyStatus, ItemType } from "../../shared/api/types";
import { codeQuery } from "../../shared/utils/labels";

export const COPIES_PATH = "/library/copies";

export type AddCopiesInput = {
  bookId: string;
  count: number;
  price?: number;
  acquiredOn?: string;
  source?: string;
  itemType?: ItemType;
  conditionNotes?: string;
};

export type CopyChanges = {
  status?: CopyStatus;
  barcode?: string | null;
  itemType?: ItemType | null;
  price?: number | null;
  acquiredOn?: string | null;
  source?: string;
  conditionNotes?: string;
};

/* Copy writes change the book's counts and the catalogue too */
const invalidate = [COPIES_PATH, "/library/books", "/library/catalogue", "/library/holds"];

export const useAddCopies = () =>
  useApiMutation(({ bookId, ...body }: AddCopiesInput) => api.post<{ book: Book; copies: Copy[] }>(`/library/books/${bookId}/copies`, body), { invalidate });

export const useUpdateCopy = () =>
  useApiMutation(({ id, ...body }: CopyChanges & { id: string }) => api.patch<Copy>(`${COPIES_PATH}/${id}`, body), { invalidate });

/* A scanned accession number or barcode -> the copy (null when none has it) */
export async function findCopy(code: string): Promise<Copy | null> {
  const res = await api.get<Copy[]>(COPIES_PATH, { ...codeQuery(code), limit: 1 });
  return res.data[0] ?? null;
}
