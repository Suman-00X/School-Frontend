/* MA-01 · HR activity: every change made in HR (leave, attendance, salaries, payroll) */
import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

export default function HrActivityPage() {
  return (
    <Page>
      <PageIntro>Who changed what in HR, newest first. Staff attendance saves are found by the action “Mark staff attendance” and the date.</PageIntro>
      <ActivityLog basePath="/hr/activity" module="hr" />
    </Page>
  );
}
