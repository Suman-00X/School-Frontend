import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import StaffListPage from "./pages/StaffListPage";
import NewStaffPage from "./pages/NewStaffPage";
import StaffDetailPage from "./pages/StaffDetailPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/users/staff", element: <RequirePermission permission="users.staff.read"><StaffListPage /></RequirePermission> },
  { path: "/users/staff/new", element: <RequirePermission permission="users.staff.create"><NewStaffPage /></RequirePermission> },
  { path: "/users/staff/:staffId", element: <RequirePermission permission="users.staff.read"><StaffDetailPage /></RequirePermission> }
];
