import { createElement } from "react";
import { Outlet, type RouteObject } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { SETUP_PATHS as P } from "../utils/paths";

/* Academics › Setup: what ADMIN and PRINCIPAL set up for the year, one side list.
   Each item is a page with its own title; everyone else reads the same pages. */
export function SetupLayout() {
  const { can, canAny } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            label: "School structure",
            items: [
              { label: "Academic years", to: P.academicYears, hidden: !can("academics.academicYears.read") },
              { label: "Classes & sections", to: P.classes, hidden: !can("academics.classes.read") },
              { label: "Subjects", to: P.subjects, hidden: !canAny("academics.subjects.read", "academics.sectionSubjects.read") },
              { label: "Teacher assignments", to: P.teacherAssignments, hidden: !can("academics.teacherAssignments.read") }
            ]
          },
          {
            label: "Calendar & rules",
            items: [
              { label: "Calendar", to: P.calendar, hidden: !can("academics.calendar.read") },
              {
                label: "Grading",
                to: P.grading,
                hidden: !canAny("academics.gradeScales.read", "academics.resultPolicies.read", "academics.assessmentSchemes.read")
              },
              { label: "Attendance policy", to: P.attendancePolicy, hidden: !can("academics.attendance.read") }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}

/* Puts setup pages inside the Setup side list (for the module's routes, which are plain .ts) */
export const setupArea = (children: RouteObject[]): RouteObject => ({ element: createElement(SetupLayout), children });
