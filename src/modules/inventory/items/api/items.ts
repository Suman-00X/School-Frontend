import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { fetchAllPages } from "@/modules/users/shared";
import type { Unit } from "../../shared/utils/format";

export const ITEMS_PATH = "/inventory/items";

export type Item = {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string } | null;
  unit: Unit;
  stockOnHand: number;
  reorderLevel: number;
  averageUnitCost: number;
  /* stock × average cost */
  stockValue: number;
  isLowStock: boolean;
  location: string | null;
  description: string | null;
  discontinued: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ItemInput = {
  sku: string;
  name: string;
  categoryId: string;
  unit: Unit;
  reorderLevel: number;
  location?: string;
  description?: string;
  discontinued: boolean;
};

export const createItem = (body: ItemInput) => api.post<Item>(ITEMS_PATH, body);
export const updateItem = ({ id, ...body }: Partial<ItemInput> & { id: string }) => api.patch<Item>(`${ITEMS_PATH}/${id}`, body);
export const removeItem = (id: string) => api.delete<null>(`${ITEMS_PATH}/${id}`);

/* Every item, for the movement form's picker (stock and cost shown per option) */
export function useAllItems(enabled = true) {
  return useQuery({
    queryKey: [ITEMS_PATH, "all"],
    enabled,
    queryFn: async () => (await fetchAllPages<Item>(ITEMS_PATH, {}, 2000)).rows
  });
}
