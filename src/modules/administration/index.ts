import type { RouteObject } from "react-router-dom";
import { routes as settingsRoutes } from "./settings";
import { listRoutes as importListRoutes, routes as importRoutes } from "./imports";
import { routes as auditLogRoutes } from "./audit-logs";
import { routes as accessRoutes } from "./access";

export const routes: RouteObject[] = [...settingsRoutes, ...importRoutes, ...auditLogRoutes, ...accessRoutes];

/* Imports of students belong to User Management: its list is shown there */
export { importListRoutes };
