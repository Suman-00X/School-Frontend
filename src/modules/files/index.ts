import type { RouteObject } from "react-router-dom";
import { routes as documentRoutes } from "./documents";
import { routes as activityRoutes } from "./activity";

/* Routes of the files module: documents (FL-01) and the module's activity log */
export const routes: RouteObject[] = [...documentRoutes, ...activityRoutes];
