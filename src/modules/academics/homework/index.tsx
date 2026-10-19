import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import HomeworkDetailPage from "./pages/HomeworkDetailPage";
import HomeworkListPage from "./pages/HomeworkListPage";

/* Routes inside the signed-in app shell */
export const routes: RouteObject[] = [
  { path: "/academics/homework", element: <RequirePermission permission="academics.homework.read"><HomeworkListPage /></RequirePermission> },
  { path: "/academics/homework/:homeworkId", element: <RequirePermission permission="academics.homework.read"><HomeworkDetailPage /></RequirePermission> }
];
