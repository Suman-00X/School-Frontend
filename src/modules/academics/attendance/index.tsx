import { type RouteObject } from "react-router-dom";
import { RequirePermission } from "@/common/auth";
import { AttendanceLayout } from "./components/AttendanceLayout";
import CoverPage from "./pages/CoverPage";
import MissingRegistersPage from "./pages/MissingRegistersPage";
import RegisterPage from "./pages/RegisterPage";

/* Routes inside the signed-in app shell. The "Attendance" header tab is a side list of
   sections; the attendance policy (/academics/attendance/policy) belongs to Setup. */
export const routes: RouteObject[] = [
  {
    path: "/academics/attendance",
    element: (
      <RequirePermission permission={["academics.attendance.read", "academics.attendance.readMissingRegisters"]}>
        <AttendanceLayout />
      </RequirePermission>
    ),
    children: [
      { index: true, element: <RequirePermission permission="academics.attendance.read"><RegisterPage /></RequirePermission> },
      { path: "cover", element: <RequirePermission permission={["academics.attendance.record", "academics.attendance.read"]}><CoverPage /></RequirePermission> },
      { path: "missing-registers", element: <RequirePermission permission="academics.attendance.readMissingRegisters"><MissingRegistersPage /></RequirePermission> }
    ]
  }
];
