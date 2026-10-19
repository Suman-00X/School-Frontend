import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import type { Book, BookInput, CatalogueEntry } from "../../shared/api/types";

export const BOOKS_PATH = "/library/books";
export const CATALOGUE_PATH = "/library/catalogue";

/* Book writes change copy counts, pickers and the public catalogue */
const invalidate = [BOOKS_PATH, CATALOGUE_PATH];

export const useBook = (bookId: string) => useApiGet<Book>(`${BOOKS_PATH}/${bookId}`);
export const useCatalogueEntry = (bookId: string) => useApiGet<CatalogueEntry>(`${CATALOGUE_PATH}/${bookId}`);

export const useCreateBook = () => useApiMutation((body: BookInput) => api.post<Book>(BOOKS_PATH, body), { invalidate });

export const useUpdateBook = () =>
  useApiMutation(({ id, ...body }: Partial<BookInput> & { id: string }) => api.patch<Book>(`${BOOKS_PATH}/${id}`, body), { invalidate });

export const useDeleteBook = () => useApiMutation((id: string) => api.delete<Book>(`${BOOKS_PATH}/${id}`), { invalidate });
