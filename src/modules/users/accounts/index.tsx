import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AccountsListPage from "./pages/AccountsListPage";
import AccountDetailPage from "./pages/AccountDetailPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/users", element: <RequirePermission permission="users.accounts.read"><AccountsListPage /></RequirePermission> },
  { path: "/users/:userId", element: <RequirePermission permission="users.accounts.read"><AccountDetailPage /></RequirePermission> }
];
