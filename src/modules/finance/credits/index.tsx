import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import StudentAccountPage from "./pages/StudentAccountPage";

/* A student's finance account (drill-in from invoices, the counter, payments, refunds, the profile) */
export const routes: RouteObject[] = [
  { path: "/finance/students/:studentId", element: <RequirePermission permission="finance.invoices.read"><StudentAccountPage /></RequirePermission> }
];

export { StudentAccountLink } from "./components/StudentAccountLink";
