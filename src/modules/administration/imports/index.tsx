import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ImportsListPage from "./pages/ImportsListPage";
import ImportDetailPage from "./pages/ImportDetailPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/administration/imports", element: <RequirePermission permission="administration.imports.read"><ImportsListPage /></RequirePermission> },
  { path: "/administration/imports/:importId", element: <RequirePermission permission="administration.imports.read"><ImportDetailPage /></RequirePermission> }
];
