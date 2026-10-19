import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import UsersActivityPage from "./pages/UsersActivityPage";

/* Routes inside the signed-in app shell. A static segment outranks /users/:userId in React Router. */
export const routes: RouteObject[] = [
  { path: "/users/activity", element: <RequirePermission permission="users.activity.read"><UsersActivityPage /></RequirePermission> }
];
