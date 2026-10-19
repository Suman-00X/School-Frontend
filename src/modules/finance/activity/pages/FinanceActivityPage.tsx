/* FI-14 · Finance activity: who did what in finance (MA-01, administrators only) */
import { ActivityLog } from "@/common/components/activity-log";
import { Page } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

export default function FinanceActivityPage() {
  return (
    <Page>
      <PageIntro>Every change in finance: invoices issued and cancelled, payments, refunds and their approvals, ledger entries and setup.</PageIntro>
      <ActivityLog basePath="/finance/activity" module="finance" />
    </Page>
  );
}
