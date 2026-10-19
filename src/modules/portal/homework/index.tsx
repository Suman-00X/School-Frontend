import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import HomeworkListPage from "./pages/HomeworkListPage";
import HomeworkDetailPage from "./pages/HomeworkDetailPage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  { path: "homework", element: <RequirePermission permission="portal.homework.read"><HomeworkListPage /></RequirePermission> }
];

/* One homework: full width, with a drill-in header */
export const routes: RouteObject[] = [
  { path: "/me/students/:studentId/homework/:homeworkId", element: <RequirePermission permission="portal.homework.read"><HomeworkDetailPage /></RequirePermission> }
];
