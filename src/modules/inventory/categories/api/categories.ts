import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { fetchAllPages } from "@/modules/users/shared";

export const CATEGORIES_PATH = "/inventory/categories";

export type Category = { id: string; name: string; description: string | null; createdAt: string; updatedAt: string };
export type CategoryInput = { name: string; description?: string };

export const createCategory = (body: CategoryInput) => api.post<Category>(CATEGORIES_PATH, body);
export const updateCategory = ({ id, ...body }: Partial<CategoryInput> & { id: string }) => api.patch<Category>(`${CATEGORIES_PATH}/${id}`, body);
export const removeCategory = (id: string) => api.delete<null>(`${CATEGORIES_PATH}/${id}`);

/* Every category (a short list), for filters and pickers */
export function useAllCategories(enabled = true) {
  return useQuery({
    queryKey: [CATEGORIES_PATH, "all"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => (await fetchAllPages<Category>(CATEGORIES_PATH, {}, 1000)).rows
  });
}
