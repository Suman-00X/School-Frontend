import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { SETUP_READERS } from "../policy";
import RulesPage from "./pages/RulesPage";

/* LB-01 Circulation rules tab; inside Library › Setup */
export const setupRoutes: RouteObject[] = [
  { path: "/library/circulation-rules", element: <RequirePermission permission={SETUP_READERS}><RulesPage /></RequirePermission> }
];
