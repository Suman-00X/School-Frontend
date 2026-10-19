import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

/* MA-01 for Communication: announcements written, edited, published and deleted, and messages sent */
export default function CommunicationActivityPage() {
  return (
    <Page>
      <PageIntro>Who wrote, published or deleted announcements, and who sent messages.</PageIntro>
      <ActivityLog basePath="/communication/activity" module="communication" />
    </Page>
  );
}
