import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { todayIso } from "@/common/utils/format";
import { fetchAllPages } from "@/modules/users/shared";

/* An employee as HR knows them */
export type Employee = {
  userId: string;
  name: string;
  email?: string | null;
  role?: string | null;
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
};

type SalaryUser = { user: { id: string; firstName: string; lastName: string; role: string } };

const byName = (a: Employee, b: Employee) => a.name.localeCompare(b.name);

/* Every active employee HR may pick from. There is no HR employee directory (backend gap), so:
   - with hr.staffAttendance.read: the day's staff register (every active employee, with codes)
   - else with hr.employeeSalaries.read: the people who already have a salary revision
   `complete` is false in the last case: someone without a salary can't be found. */
export function useHrEmployees() {
  const { can } = useAuth();
  const viaRegister = can("hr.staffAttendance.read");
  const viaSalaries = !viaRegister && can("hr.employeeSalaries.read");

  const register = useQuery({
    queryKey: ["/hr/staff-attendance/register", "directory"],
    enabled: viaRegister,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      (await api.get<{ employees: Employee[] }>("/hr/staff-attendance/register", { date: todayIso() }, { signal })).data.employees
  });

  const salaries = useQuery({
    /* Same key and rows as the salaries page's list (payroll's useAllSalaries) */
    queryKey: ["/hr/employee-salaries", "all"],
    enabled: viaSalaries,
    queryFn: async () => (await fetchAllPages<SalaryUser>("/hr/employee-salaries", {}, 5000)).rows
  });

  const employees = useMemo<Employee[]>(() => {
    if (viaRegister)
      return (register.data ?? []).map(e => ({
        userId: e.userId,
        name: e.name,
        email: e.email,
        role: e.role,
        employeeCode: e.employeeCode,
        designation: e.designation,
        department: e.department
      }));
    const seen = new Map<string, Employee>();
    for (const r of salaries.data ?? [])
      if (!seen.has(r.user.id)) seen.set(r.user.id, { userId: r.user.id, name: `${r.user.firstName} ${r.user.lastName}`.trim(), role: r.user.role });
    return [...seen.values()].sort(byName);
  }, [viaRegister, register.data, salaries.data]);

  return {
    employees,
    complete: viaRegister,
    isLoading: viaRegister ? register.isLoading : viaSalaries ? salaries.isLoading : false
  };
}

