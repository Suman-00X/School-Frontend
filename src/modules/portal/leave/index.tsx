import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import LeavePage from "./pages/LeavePage";

/* Inside the portal layout */
export const childRoutes: RouteObject[] = [
  { path: "leave", element: <RequirePermission permission="portal.leaveRequests.read"><LeavePage /></RequirePermission> }
];
