import type { RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import LeavePage from "./pages/LeavePage";
import LeaveTypesPage from "./pages/LeaveTypesPage";

/* hr/leaves: leave types (HR-01), requests and balances (HR-04) */
export const routes: RouteObject[] = [
  { path: "/hr/leave-types", element: <RequirePermission permission="hr.leaveTypes.manage"><LeaveTypesPage /></RequirePermission> },
  {
    path: "/hr/leave-requests",
    element: (
      <RequirePermission permission={["hr.leaveRequests.read", "hr.leaveBalances.read"]}>
        <LeavePage />
      </RequirePermission>
    )
  }
];
