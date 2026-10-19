import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import InventoryActivityPage from "./pages/InventoryActivityPage";

/* inventory activity log (MA-01): owners and ADMIN only */
export const routes: RouteObject[] = [
  { path: "/inventory/activity", element: <RequirePermission permission="inventory.activity.read"><InventoryActivityPage /></RequirePermission> }
];
