import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import DashboardsPage from "./pages/DashboardsPage";

const KEYS = ["reports.dashboards.overview", "reports.dashboards.attendance", "reports.dashboards.fees", "reports.dashboards.academics"];

/* Routes inside the signed-in app shell; /reports/dashboards opens the first tab the person may see */
export const routes: RouteObject[] = [
  { path: "/reports/dashboards", element: <RequirePermission permission={KEYS}><DashboardsPage /></RequirePermission> },
  { path: "/reports/dashboards/:tab", element: <RequirePermission permission={KEYS}><DashboardsPage /></RequirePermission> }
];
