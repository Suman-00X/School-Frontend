import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import HoldsPage from "./pages/HoldsPage";

/* LB-06 (the drawer has its own URL) */
export const routes: RouteObject[] = [
  { path: "/library/holds/:holdId?", element: <RequirePermission permission="library.holds.read"><HoldsPage /></RequirePermission> }
];
