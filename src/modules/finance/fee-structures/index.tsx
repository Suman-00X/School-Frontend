import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import FeeStructuresPage from "./pages/FeeStructuresPage";
import FeeStructurePage from "./pages/FeeStructurePage";

/* The list, inside Finance › Setup (side list) */
export const routes: RouteObject[] = [
  { path: "/finance/fee-structures", element: <RequirePermission permission="finance.feeStructures.read"><FeeStructuresPage /></RequirePermission> }
];

/* One structure (and a new one): full width, with a drill-in header */
export const recordRoutes: RouteObject[] = [
  { path: "/finance/fee-structures/new", element: <RequirePermission permission="finance.feeStructures.manage"><FeeStructurePage /></RequirePermission> },
  { path: "/finance/fee-structures/:feeStructureId", element: <RequirePermission permission="finance.feeStructures.read"><FeeStructurePage /></RequirePermission> }
];

export { lateFeeLabel, type FeeStructure } from "./api/feeStructures";
