import { Outlet } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { SideNavLayout } from "@/common/layout/SideNav";
import { Page } from "@/common/ui";
import "../exams.css";

/* Academics › Exams & results: exams and papers (AC-13), marks entry (AC-14), report cards and
   publishing (AC-15). One exam's page is a drill-in page outside this area. */
export function ExamsResultsLayout() {
  const { can } = useAuth();
  return (
    <Page>
      <SideNavLayout
        groups={[
          {
            items: [
              {
                label: "Exams",
                to: "/academics/exams",
                end: true,
                hidden: !can("academics.exams.read")
              },
              {
                label: "Marks entry",
                to: "/academics/marks",
                hidden: !can("academics.marks.record")
              },
              {
                label: "Report cards & publishing",
                to: "/academics/results",
                hidden: !can("academics.reportCards.read") && !can("academics.assessmentSchemes.read")
              }
            ]
          }
        ]}
      >
        <Outlet />
      </SideNavLayout>
    </Page>
  );
}
