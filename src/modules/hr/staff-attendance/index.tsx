import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import StaffAttendancePage from "./pages/StaffAttendancePage";

/* hr/staff-attendance: the daily register and the summary (HR-03) */
export const routes: RouteObject[] = [
  { path: "/hr/staff-attendance", element: <RequirePermission permission="hr.staffAttendance.read"><StaffAttendancePage /></RequirePermission> }
];
