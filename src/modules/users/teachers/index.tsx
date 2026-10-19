import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import TeachersListPage from "./pages/TeachersListPage";
import NewTeacherPage from "./pages/NewTeacherPage";
import TeacherDetailPage from "./pages/TeacherDetailPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/users/teachers", element: <RequirePermission permission="users.teachers.read"><TeachersListPage /></RequirePermission> },
  { path: "/users/teachers/new", element: <RequirePermission permission="users.teachers.create"><NewTeacherPage /></RequirePermission> },
  { path: "/users/teachers/:teacherId", element: <RequirePermission permission="users.teachers.read"><TeacherDetailPage /></RequirePermission> }
];
