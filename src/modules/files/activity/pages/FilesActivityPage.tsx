import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

/* MA-01 for Files: documents uploaded and deleted */
export default function FilesActivityPage() {
  return (
    <Page>
      <PageIntro>Who uploaded or deleted documents, and when.</PageIntro>
      <ActivityLog basePath="/files/activity" module="files" />
    </Page>
  );
}
