import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { ATTENDANCE_PAGES as P } from "../api/paths";

/* Academics › Attendance: the register, covering periods, registers nobody took, and the
   leave parents ask for their children.
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
              { label: "Missing registers", to: P.missing, hidden: !can("academics.attendance.readMissingRegisters") },
              { label: "Leave requests", to: P.leave, hidden: !can("academics.studentLeaves.read") }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
