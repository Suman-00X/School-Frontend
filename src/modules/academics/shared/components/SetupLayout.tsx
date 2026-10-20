import { createElement } from "react";
import { Outlet, type RouteObject } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import { SETUP_PATHS as P } from "../utils/paths";

/* Academics › Setup: what ADMIN and PRINCIPAL set up for the year, one side list: Curriculum (what
   each section is taught and by whom), the one-time structure, the school week, and the rules.
   Each item is a page with its own title; everyone else reads the same pages. */
export function SetupLayout() {
  const { can, canAny } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          /* A page of its own, first and shown as a heading: its tabs hold each section's subjects and teachers, and each teacher's */
          { label: "Curriculum", to: P.curriculum, hidden: !canAny("academics.sectionSubjects.read", "academics.teacherAssignments.read"), items: [] },
          {
            label: "School structure",
            items: [
              { label: "Academic years", to: P.academicYears, hidden: !can("academics.academicYears.read") },
              { label: "Classes & sections", to: P.classes, hidden: !can("academics.classes.read") },
              { label: "Subjects", to: P.subjects, hidden: !can("academics.subjects.read") }
            ]
          },
          {
            label: "Calendar",
            items: [
              { label: "Periods", to: P.periods, hidden: !can("academics.timetable.read") },
              { label: "Timetables", to: P.timetable, hidden: !can("academics.timetable.read") },
              { label: "School calendar", to: P.calendar, hidden: !can("academics.calendar.read") }
            ]
          },
          {
            label: "Policy",
            items: [
              { label: "Roll numbers", to: P.rollNumbers, hidden: !can("academics.enrollments.readPolicy") },
              { label: "Attendance", to: P.attendancePolicy, hidden: !can("academics.attendance.read") },
              { label: "Exam eligibility", to: P.examEligibility, hidden: !can("academics.examEligibility.readPolicy") },
              { label: "Subject codes", to: P.subjectCodes, hidden: !can("academics.subjectCodes.read") },
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
