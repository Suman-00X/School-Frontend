import { Navigate, type RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ReportsPage from "./pages/ReportsPage";

/* LB-08 */
export const routes: RouteObject[] = [
  { path: "/library/reports", element: <Navigate to="/library/reports/current-loans" replace /> },
  { path: "/library/reports/:report", element: <RequirePermission permission="library.reports.read"><ReportsPage /></RequirePermission> }
];
