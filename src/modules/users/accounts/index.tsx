import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AccountsListPage from "./pages/AccountsListPage";
import AccountDetailPage from "./pages/AccountDetailPage";

/* List page: shown inside User Management (Admin), with its side list */
export const listRoutes: RouteObject[] = [
  { path: "/users", element: <RequirePermission permission="users.accounts.read"><AccountsListPage /></RequirePermission> }
];

/* Record and create pages: full width, with a drill-in header */
export const routes: RouteObject[] = [
  { path: "/users/:userId", element: <RequirePermission permission="users.accounts.read"><AccountDetailPage /></RequirePermission> }
];
