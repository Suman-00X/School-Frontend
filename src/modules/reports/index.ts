import type { RouteObject } from "react-router-dom";
import { routes as dashboardRoutes } from "./dashboards";
import { routes as exportRoutes } from "./exports";

/* Routes of the reports module: dashboards (RP-01) and exports (RP-02) */
export const routes: RouteObject[] = [...dashboardRoutes, ...exportRoutes];
