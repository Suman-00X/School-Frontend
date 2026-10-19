/* AC-17 · Academics activity: every change in the academics module (MA-01) */
import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

export default function AcademicsActivityPage() {
  return (
    <Page>
      {/* The header tab already says "Activity": no title */}
      <PageIntro>Who changed what in academics: years, classes, timetables, attendance, exams, marks, results and homework.</PageIntro>
      <ActivityLog basePath="/academics/activity" module="academics" />
    </Page>
  );
}
