import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";

/* Someone who can be given module access (an employee) */
export type Person = { id: string; name: string; email?: string; role?: string };

type EmployeeRow = { user: { id: string; firstName: string; lastName: string; email: string; role: string } };

const LIMIT = 100;

/* Every page of an employee list (the lists have no search, so the picker searches on the client) */
async function listAll(path: string, signal: AbortSignal): Promise<Person[]> {
  const out: Person[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await api.get<EmployeeRow[]>(path, { page, limit: LIMIT }, { signal });
    for (const r of res.data)
      out.push({ id: r.user.id, name: `${r.user.firstName} ${r.user.lastName}`.trim(), email: r.user.email, role: r.user.role });
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return out;
}

/* Staff and teachers the person may list. Module owners can list neither (backend gap), so
   `canList` is false for them and the picker falls back to known people and a pasted id. */
export function useEmployees() {
  const { can } = useAuth();
  const staff = can("users.staff.read");
  const teachers = can("users.teachers.read");
  const q = useQuery({
    queryKey: ["/users/employees-for-access", { staff, teachers }],
    enabled: staff || teachers,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const [s, t] = await Promise.all([
        staff ? listAll("/users/staff", signal) : Promise.resolve([]),
        teachers ? listAll("/users/teachers", signal) : Promise.resolve([])
      ]);
      const byId = new Map<string, Person>();
      for (const p of [...s, ...t]) byId.set(p.id, p);
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
  });
  return { people: q.data ?? [], canList: staff || teachers, isLoading: q.isLoading, error: q.error };
}

/* People named on loaded assignments, for owners who can't list employees */
export function usePeopleFrom(rows: { user: { id: string; firstName: string; lastName: string; email?: string; role?: string } }[] | undefined) {
  return useMemo(() => {
    const byId = new Map<string, Person>();
    for (const r of rows ?? [])
      byId.set(r.user.id, { id: r.user.id, name: `${r.user.firstName} ${r.user.lastName}`.trim(), email: r.user.email, role: r.user.role });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
}
