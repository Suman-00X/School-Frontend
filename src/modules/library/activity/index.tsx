import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import LibraryActivityPage from "./pages/LibraryActivityPage";

/* Shown inside Library › Setup (side list) */
export const setupRoutes: RouteObject[] = [
  { path: "/library/activity", element: <RequirePermission permission="library.activity.read"><LibraryActivityPage /></RequirePermission> }
];
