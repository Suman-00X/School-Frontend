import { useQuery } from "@tanstack/react-query";
import { api, EMPLOYEE_ROLES, type Account, type Query } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";

export const useAccount = (userId: string | undefined) => useApiGet<Account>(userId ? `/users/${userId}` : null);

/* Any subset of the person fields */
export const updateAccount = (userId: string, body: Record<string, string>) => api.patch<Account>(`/users/${userId}`, body);

/* Signs the person out of every device at once */
export const deactivateAccount = (userId: string) => api.delete<null>(`/users/${userId}`);

/* ---- the role profile behind an account ---- */

type ProfileRow = { id: string; userId: string; employeeCode?: string };

const MAX_PAGES = 10;

async function findByUser(path: string, query: Query, userId: string) {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await api.get<ProfileRow[]>(path, { ...query, page, limit: 100 });
    const hit = res.data.find(r => r.userId === userId);
    if (hit) return hit;
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return null;
}

const STAFF_ROLES = EMPLOYEE_ROLES.filter(r => r !== "TEACHER");

/* Gap: an account does not name its profile. Teachers and staff (filtered by role) are few enough
   to page through and match on userId; students and parents are not looked up. */
export function useRoleProfile(account: Account | undefined) {
  const { can } = useAuth();
  const kind = !account
    ? null
    : account.role === "TEACHER"
      ? "teacher"
      : STAFF_ROLES.includes(account.role)
        ? "staff"
        : account.role === "STUDENT"
          ? "student"
          : "parent";
  const path = kind === "teacher" ? "/users/teachers" : "/users/staff";
  const searchable = (kind === "teacher" && can("users.teachers.read")) || (kind === "staff" && can("users.staff.read"));
  const q = useQuery({
    queryKey: [path, "byUser", account?.id],
    enabled: !!account && searchable,
    staleTime: 5 * 60_000,
    queryFn: () => findByUser(path, kind === "staff" ? { role: account!.role } : {}, account!.id)
  });
  const to = q.data ? `${path}/${q.data.id}` : null;
  return { kind, searchable, to, code: q.data?.employeeCode, isLoading: q.isLoading && searchable };
}
