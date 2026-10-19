import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import UsersActivityPage from "./pages/UsersActivityPage";

/* A static segment outranks /users/:userId in React Router */
/* List page: shown inside User Management (Admin), with its side list */
export const listRoutes: RouteObject[] = [
  { path: "/users/activity", element: <RequirePermission permission="users.activity.read"><UsersActivityPage /></RequirePermission> }
];

export const routes: RouteObject[] = [];
