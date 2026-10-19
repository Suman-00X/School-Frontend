import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import ParentsListPage from "./pages/ParentsListPage";
import NewParentPage from "./pages/NewParentPage";

/* List and create pages: shown inside User Management (Admin), with its side list */
export const listRoutes: RouteObject[] = [
  { path: "/users/parents", element: <RequirePermission permission="users.parents.read"><ParentsListPage /></RequirePermission> },
  { path: "/users/parents/new", element: <RequirePermission permission="users.parents.create"><NewParentPage /></RequirePermission> }
];

/* A parent opens in a drawer on the list: no record page */
export const routes: RouteObject[] = [];

/* Used by the students submodule (admission, profile) */
export { createParent, useAllParents, type Parent, type ParentProfileBody } from "./api/parents";
export { ParentPicker } from "./components/ParentPicker";
export { ParentProfileFields } from "./components/ParentProfileFields";
export * from "./utils/profile";
