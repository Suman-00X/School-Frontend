import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ImportsListPage from "./pages/ImportsListPage";
import ImportDetailPage from "./pages/ImportDetailPage";

/* List page: shown inside User Management (Admin), with its side list */
export const listRoutes: RouteObject[] = [
  { path: "/administration/imports", element: <RequirePermission permission="administration.imports.read"><ImportsListPage /></RequirePermission> }
];

/* Record and create pages: full width, with a drill-in header */
export const routes: RouteObject[] = [
  { path: "/administration/imports/:importId", element: <RequirePermission permission="administration.imports.read"><ImportDetailPage /></RequirePermission> }
];
