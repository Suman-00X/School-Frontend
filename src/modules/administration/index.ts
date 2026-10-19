import type { RouteObject } from "react-router-dom";
import { routes as settingsRoutes } from "./settings";
import { routes as importRoutes } from "./imports";
import { routes as auditLogRoutes } from "./audit-logs";
import { routes as accessRoutes } from "./access";

export const routes: RouteObject[] = [...settingsRoutes, ...importRoutes, ...auditLogRoutes, ...accessRoutes];
