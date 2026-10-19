import { useQuery } from "@tanstack/react-query";
import { api } from "@/common/api";
import { fetchAllPages } from "@/modules/users/shared";
import type { AttendanceStatus } from "../../shared/utils/format";

export const COMPONENTS_PATH = "/hr/salary-components";
export const SALARIES_PATH = "/hr/employee-salaries";
export const RUNS_PATH = "/hr/payroll-runs";
export const PAYSLIPS_PATH = "/hr/payslips";

export const COMPONENT_KINDS = ["EARNING", "DEDUCTION"] as const;
export const CALCULATIONS = ["FIXED", "PERCENT_OF_BASIC"] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];
export type Calculation = (typeof CALCULATIONS)[number];

export type SalaryComponent = {
  id: string;
  code: string;
  name: string;
  kind: ComponentKind;
  calculation: Calculation;
  /* An amount (FIXED) or a percent of basic */
  defaultValue: number;
  description: string | null;
};

export type ComponentInput = Omit<SalaryComponent, "id" | "description"> & { description?: string };

export type SalaryLine = {
  id: string;
  componentId: string;
  value: number;
  component: Pick<SalaryComponent, "id" | "code" | "name" | "kind" | "calculation">;
};

export type SalaryRevision = {
  id: string;
  userId: string;
  /* Always the 1st of a month */
  effectiveFrom: string;
  monthlyBasic: number;
  lines: SalaryLine[];
  /* Masked: XXXXXXXX9012 */
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  panNumber: string | null;
  notes: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; role: string } | null;
};

export type SalaryInput = {
  userId: string;
  effectiveFrom: string;
  monthlyBasic: number;
  lines: { componentId: string; value?: number }[];
  bankAccountNumber?: string;
  bankIfsc?: string;
  panNumber?: string;
  notes?: string;
};

export type PayrollRun = {
  id: string;
  month: string;
  /* Only on single-run responses */
  monthLabel?: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "FINALIZED";
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  computedAt: string | null;
  finalizedAt: string | null;
  notes: string | null;
  createdAt: string;
  /* Only after a run or a recalculation */
  withoutSalary?: { userId: string; name: string }[];
};

export type PayLine = { code: string; name: string; kind: ComponentKind; calculation: Calculation; value: number; amount: number; componentId: string | null };

export type Payslip = {
  id: string;
  runId: string;
  userId: string;
  month: string;
  payslipNumber: string | null;
  employeeName: string;
  employeeCode: string | null;
  role: string;
  designation: string | null;
  daysInMonth: number;
  paidDays: number;
  lopDays: number;
  attendance: Record<AttendanceStatus, number>;
  monthlyBasic: number;
  earnings: PayLine[];
  deductions: PayLine[];
  totalEarnings: number;
  lopAmount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  bankAccountMasked: string | null;
  bankIfsc: string | null;
  panMasked: string | null;
  /* On GET /hr/payslips/:id */
  run?: { id: string; month: string; status: "DRAFT" | "FINALIZED"; finalizedAt: string | null };
};

export const createComponent = (body: ComponentInput) => api.post<SalaryComponent>(COMPONENTS_PATH, body);
export const updateComponent = ({ id, ...body }: Partial<ComponentInput> & { id: string }) => api.patch<SalaryComponent>(`${COMPONENTS_PATH}/${id}`, body);
export const removeComponent = (id: string) => api.delete<null>(`${COMPONENTS_PATH}/${id}`);

export const createSalary = (body: SalaryInput) => api.post<SalaryRevision>(SALARIES_PATH, body);

export const runPayroll = (body: { month: string; notes?: string }) => api.post<PayrollRun>(RUNS_PATH, body);
export const recalculateRun = (id: string) => api.post<PayrollRun>(`${RUNS_PATH}/${id}/recalculation`);
export const finalizeRun = (id: string) => api.post<PayrollRun>(`${RUNS_PATH}/${id}/finalization`);

export const downloadPayslip = (id: string) => api.download(`${PAYSLIPS_PATH}/${id}/pdf`, undefined, "payslip.pdf");

/* Every component (the list is short), for pickers and labels */
export function useAllComponents() {
  return useQuery({
    queryKey: [COMPONENTS_PATH, "all"],
    staleTime: 60_000,
    queryFn: async () => (await fetchAllPages<SalaryComponent>(COMPONENTS_PATH, {}, 500)).rows
  });
}

/* Every revision (no "current salary" endpoint: grouped per employee on the device) */
export function useAllSalaries(enabled = true) {
  return useQuery({
    queryKey: [SALARIES_PATH, "all"],
    enabled,
    queryFn: async () => (await fetchAllPages<SalaryRevision>(SALARIES_PATH, {}, 5000)).rows
  });
}

/* Every payslip of a run (the list has no search, so the run page searches on the device) */
export function useRunPayslips(runId: string | undefined) {
  return useQuery({
    queryKey: [RUNS_PATH, runId, "payslips", "all"],
    enabled: !!runId,
    queryFn: async () => (await fetchAllPages<Payslip>(`${RUNS_PATH}/${runId}/payslips`, {}, 5000)).rows
  });
}

/* Gross, deductions and net of a revision, as payroll computes them before loss of pay */
export function revisionTotals(basic: number, lines: { kind: ComponentKind; calculation: Calculation; value: number }[]) {
  let earnings = basic;
  let deductions = 0;
  for (const l of lines) {
    const amount = lineAmount(basic, l.calculation, l.value);
    if (l.kind === "EARNING") earnings += amount;
    else deductions += amount;
  }
  return { gross: round2(earnings), deductions: round2(deductions), net: round2(Math.max(0, earnings - deductions)) };
}

/* Same rounding as the server: percent of basic in paise, half up */
export const lineAmount = (basic: number, calculation: Calculation, value: number) =>
  calculation === "PERCENT_OF_BASIC" ? Math.round((Math.round(basic * 100) * value) / 100) / 100 : value;

const round2 = (n: number) => Math.round(n * 100) / 100;
