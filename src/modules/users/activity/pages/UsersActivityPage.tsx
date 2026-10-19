import { ActivityLog } from "@/common/components/activity-log";
import { Page, PageHeader } from "@/common/ui";

/* MA-01 for the People module: every change to accounts, students, parents, teachers and staff */
export default function UsersActivityPage() {
  return (
    <Page>
      <PageHeader title="Activity" subtitle="Who changed what in people's records and accounts." />
      <ActivityLog basePath="/users/activity" module="users" />
    </Page>
  );
}
