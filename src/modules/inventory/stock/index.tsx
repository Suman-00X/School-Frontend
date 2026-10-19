import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import MovementsPage from "./pages/MovementsPage";

/* inventory/stock: the ledger and recording movements (IN-04) */
export const routes: RouteObject[] = [
  { path: "/inventory/movements", element: <RequirePermission permission="inventory.stock.read"><MovementsPage /></RequirePermission> }
];
