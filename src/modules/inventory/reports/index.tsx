import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import InventoryReportsPage from "./pages/InventoryReportsPage";

/* inventory/reports (IN-05) */
export const routes: RouteObject[] = [
  { path: "/inventory/reports", element: <RequirePermission permission="inventory.reports.read"><InventoryReportsPage /></RequirePermission> }
];
