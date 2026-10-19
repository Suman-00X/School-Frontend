import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ConcessionsPage from "./pages/ConcessionsPage";
import ConcessionGrantsPage from "./pages/ConcessionGrantsPage";

/* Inside Finance › Setup (side list) */
export const routes: RouteObject[] = [
  { path: "/finance/concessions", element: <RequirePermission permission="finance.concessions.read"><ConcessionsPage /></RequirePermission> },
  { path: "/finance/concession-grants", element: <RequirePermission permission="finance.concessions.read"><ConcessionGrantsPage /></RequirePermission> }
];

/* For the student account (FI-11): grant one student a concession */
export { GrantDialog } from "./components/GrantDialog";
export { valueLabel as concessionValueLabel, CATEGORY_LABELS as CONCESSION_CATEGORY_LABELS, type Grant as ConcessionGrant } from "./api/concessions";
