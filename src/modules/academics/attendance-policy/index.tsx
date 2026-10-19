import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import AttendancePolicyPage from "./pages/AttendancePolicyPage";

/* Inside Academics › Setup (see shared/components/SetupLayout). Its own folder, not attendance/,
   which holds the registers (another area of Academics). */
export const routes: RouteObject[] = [
  {
    path: "/academics/attendance/policy",
    element: (
      <RequirePermission permission="academics.attendance.read">
        <AttendancePolicyPage />
      </RequirePermission>
    )
  }
];
