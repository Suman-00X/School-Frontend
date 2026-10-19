import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import FeeHeadsPage from "./pages/FeeHeadsPage";

/* Inside Finance › Setup (side list) */
export const routes: RouteObject[] = [
  { path: "/finance/fee-heads", element: <RequirePermission permission="finance.feeHeads.read"><FeeHeadsPage /></RequirePermission> }
];

export { useFeeHeadOptions, type FeeHead } from "./api/feeHeads";
