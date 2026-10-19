import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import LateFeeRulesPage from "./pages/LateFeeRulesPage";

/* Inside Finance › Setup (side list) */
export const routes: RouteObject[] = [
  { path: "/finance/late-fee-rules", element: <RequirePermission permission="finance.lateFeeRules.read"><LateFeeRulesPage /></RequirePermission> }
];

export { useRuleOptions, slabsSummary, type LateFeeRule } from "./api/lateFeeRules";
