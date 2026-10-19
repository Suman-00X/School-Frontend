import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import PortalRedirectPage from "./pages/PortalRedirectPage";

/* The navigation's fixed links: /me/school[/<page>] opens the remembered (or first) child */
export const routes: RouteObject[] = [
  { path: "/me/school", element: <RequirePermission permission="portal.learning.students"><PortalRedirectPage /></RequirePermission> },
  { path: "/me/school/*", element: <RequirePermission permission="portal.learning.students"><PortalRedirectPage /></RequirePermission> }
];

export { PortalLayout } from "./components/PortalLayout";
