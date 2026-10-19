import { useQuery } from "@tanstack/react-query";
import { api, type Query } from "@/common/api";
import { useApiGet, useApiList } from "@/common/hooks";
import { fetchAllPages, type PersonValues, type UserSummary } from "@/modules/users/shared";

export const PARENTS_PATH = "/users/parents";

export type Parent = {
  id: string;
  userId: string;
  parentCode: string;
  occupation: string | null;
  /* numeric column: comes back as a string ("1200000.00") */
  annualIncome: string | null;
  description: string | null;
  createdAt: string;
  user: UserSummary;
};

export type ParentProfileBody = { occupation?: string; annualIncome?: number; description?: string };
export type NewParentBody = { user: Partial<PersonValues>; profile: ParentProfileBody };

export const useParents = (query: Query) => useApiList<Parent>(PARENTS_PATH, query);
export const useParent = (parentId: string | null) => useApiGet<Parent>(parentId ? `${PARENTS_PATH}/${parentId}` : null);

/* GET /users/parents has no search (gap): pickers load up to 500 and filter on the device */
export const useAllParents = (enabled = true) =>
  useQuery({
    queryKey: [PARENTS_PATH, "all"],
    enabled,
    staleTime: 60_000,
    queryFn: () => fetchAllPages<Parent>(PARENTS_PATH)
  });

export const createParent = (body: NewParentBody) => api.post<Parent>(PARENTS_PATH, body);

/* The row comes back without `user`; callers refetch */
export const updateParent = ({ parentId, ...body }: ParentProfileBody & { parentId: string }) =>
  api.patch<Parent>(`${PARENTS_PATH}/${parentId}`, body);
