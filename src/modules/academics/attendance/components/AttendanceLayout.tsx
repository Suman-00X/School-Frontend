import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { ATTENDANCE_PAGES as P } from "../api/paths";

/* Academics › Attendance: the register, covering periods, and registers nobody took.
   The attendance policy lives under Setup. */
export function AttendanceLayout() {
  const { can, canAny } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            items: [
              { label: "Register", to: P.register, end: true, hidden: !can("academics.attendance.read") },
              { label: "Cover & substitute", to: P.cover, hidden: !canAny("academics.attendance.record", "academics.attendance.read") },
              { label: "Missing registers", to: P.missing, hidden: !can("academics.attendance.readMissingRegisters") }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
