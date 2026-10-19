import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import HrActivityPage from "./pages/HrActivityPage";

/* hr activity log (MA-01): owners and ADMIN only */
export const routes: RouteObject[] = [
  { path: "/hr/activity", element: <RequirePermission permission="hr.activity.read"><HrActivityPage /></RequirePermission> }
];
