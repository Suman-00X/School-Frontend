import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import DiaryPage from "./pages/DiaryPage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  { path: "diary", element: <RequirePermission permission="portal.diary.read"><DiaryPage /></RequirePermission> }
];
