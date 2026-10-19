/* MA-01 · Inventory activity: every change made in the store (items, vendors, stock movements) */
import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

export default function InventoryActivityPage() {
  return (
    <Page>
      <PageIntro>Who changed what in the store, newest first. A stock movement is filed under the movement, not the item.</PageIntro>
      <ActivityLog basePath="/inventory/activity" module="inventory" />
    </Page>
  );
}
