import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import TeachersListPage from "./pages/TeachersListPage";
import NewTeacherPage from "./pages/NewTeacherPage";
import TeacherDetailPage from "./pages/TeacherDetailPage";

/* List and create pages: shown inside User Management (Admin), with its side list */
export const listRoutes: RouteObject[] = [
  { path: "/users/teachers", element: <RequirePermission permission="users.teachers.read"><TeachersListPage /></RequirePermission> },
  { path: "/users/teachers/new", element: <RequirePermission permission="users.teachers.create"><NewTeacherPage /></RequirePermission> }
];

/* Record pages: full width, with a drill-in header */
export const routes: RouteObject[] = [
  { path: "/users/teachers/:teacherId", element: <RequirePermission permission="users.teachers.read"><TeacherDetailPage /></RequirePermission> }
];
