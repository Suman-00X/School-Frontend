import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import FinanceActivityPage from "./pages/FinanceActivityPage";

/* Finance › Activity (header tab) */
export const routes: RouteObject[] = [
  { path: "/finance/activity", element: <RequirePermission permission="finance.activity.read"><FinanceActivityPage /></RequirePermission> }
];
