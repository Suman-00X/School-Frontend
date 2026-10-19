import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

/* MA-01 for Transport: every change to vehicles, routes, stops and seats (owners only) */
export default function TransportActivityPage() {
  return (
    <Page>
      <PageIntro>Who changed what in vehicles, routes, stops and seat assignments.</PageIntro>
      <ActivityLog basePath="/transport/activity" module="transport" />
    </Page>
  );
}
