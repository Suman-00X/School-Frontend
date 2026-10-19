import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

/* MA-01 for Hostel: every change to hostels, rooms, beds and resources (owners only) */
export default function HostelActivityPage() {
  return (
    <Page>
      <PageIntro>Who changed what in hostels, rooms, bed allocations and resources.</PageIntro>
      <ActivityLog basePath="/hostel/activity" module="hostel" />
    </Page>
  );
}
