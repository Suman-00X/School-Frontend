import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import StockChecksPage from "./pages/StockChecksPage";
import StockCheckPage from "./pages/StockCheckPage";

/* LB-07 */
export const routes: RouteObject[] = [
  { path: "/library/stock-checks", element: <RequirePermission permission="library.stockChecks.read"><StockChecksPage /></RequirePermission> },
  { path: "/library/stock-checks/:stockCheckId", element: <RequirePermission permission="library.stockChecks.read"><StockCheckPage /></RequirePermission> }
];
