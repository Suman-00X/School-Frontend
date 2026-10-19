import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import InstallmentPlansPage from "./pages/InstallmentPlansPage";
import PlanAssignmentsPage from "./pages/PlanAssignmentsPage";

/* Inside Finance › Setup (side list) */
export const routes: RouteObject[] = [
  { path: "/finance/installment-plans", element: <RequirePermission permission="finance.installmentPlans.read"><InstallmentPlansPage /></RequirePermission> },
  { path: "/finance/plan-assignments", element: <RequirePermission permission="finance.installmentPlans.read"><PlanAssignmentsPage /></RequirePermission> }
];

/* For the other finance submodules (fee structures, student account) */
export { usePlanOptions, installmentsLabel, type InstallmentPlan } from "./api/installmentPlans";
export { AssignPlanDialog } from "./components/AssignPlanDialog";
export { PlanTimeline } from "./components/PlanTimeline";
