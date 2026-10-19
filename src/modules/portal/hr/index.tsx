import { Navigate, type RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import MyAttendancePage from "./pages/MyAttendancePage";
import MyLeavePage from "./pages/MyLeavePage";
import MyPayslipsPage from "./pages/MyPayslipsPage";

/* Every employee's own attendance, leave and payslips */
export const routes: RouteObject[] = [
  { path: "/hr/me", element: <Navigate to="/hr/me/leave" replace /> },
  { path: "/hr/me/attendance", element: <RequirePermission permission="hr.staffAttendance.readOwn"><MyAttendancePage /></RequirePermission> },
  { path: "/hr/me/leave", element: <RequirePermission permission={["hr.leaveRequests.readOwn", "hr.leaveBalances.readOwn"]}><MyLeavePage /></RequirePermission> },
  { path: "/hr/me/payslips", element: <RequirePermission permission="hr.payslips.readOwn"><MyPayslipsPage /></RequirePermission> }
];
