import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import SettlementsPage from "./pages/SettlementsPage";

/* Shown inside Finance › Payments (its side list): see payments/index.tsx */
export const areaRoutes: RouteObject[] = [
  { path: "/finance/settlements", element: <RequirePermission permission="finance.settlements.read"><SettlementsPage /></RequirePermission> }
];
