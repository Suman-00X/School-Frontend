import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import PayrollRunDetailPage from "./pages/PayrollRunDetailPage";
import PayrollRunsPage from "./pages/PayrollRunsPage";
import PayslipPage from "./pages/PayslipPage";
import SalaryRedirect from "./pages/SalaryRedirect";
import SalarySetupPage from "./pages/SalarySetupPage";

/* hr/payroll: salary setup (HR-02), payroll runs (HR-05) and payslips (HR-06) */
export const routes: RouteObject[] = [
  { path: "/hr/salary", element: <RequirePermission permission={["hr.employeeSalaries.read", "hr.salaryComponents.read"]}><SalaryRedirect /></RequirePermission> },
  { path: "/hr/employee-salaries", element: <RequirePermission permission="hr.employeeSalaries.read"><SalarySetupPage view="salaries" /></RequirePermission> },
  { path: "/hr/salary-components", element: <RequirePermission permission="hr.salaryComponents.read"><SalarySetupPage view="components" /></RequirePermission> },
  { path: "/hr/payroll-runs", element: <RequirePermission permission="hr.payrollRuns.read"><PayrollRunsPage /></RequirePermission> },
  { path: "/hr/payroll-runs/:runId", element: <RequirePermission permission="hr.payrollRuns.read"><PayrollRunDetailPage /></RequirePermission> },
  { path: "/hr/payslips/:payslipId", element: <RequirePermission permission="hr.payslips.read"><PayslipPage /></RequirePermission> }
];

