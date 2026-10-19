import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { ActivityLog } from "@/common/components/activity-log";
import { Page, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";

/* AD-03. Two views of one log, so two in-page tabs (a side list would be heavier for two items).
   The header tab already says "Audit log": no title. */
export default function AuditLogPage() {
  const { can } = useAuth();
  const [, setSearch] = useSearchParams();
  const tabs: TabItem[] = [
    { id: "all", label: "All activity" },
    { id: "administration", label: "Administration activity", hidden: !can("administration.activity.read") }
  ];
  const [tab] = useTabParam(tabs);

  /* Both logs keep their filters in the URL: a new tab starts with none */
  const switchTab = (id: string) =>
    setSearch(id === tabs[0].id ? {} : { tab: id }, { replace: true });

  return (
    <Page>
      <PageIntro>Every change made in the school, newest first. Nothing here can be edited.</PageIntro>
      <Tabs tabs={tabs} value={tab} onChange={switchTab} />
      {tab === "all" ? (
        <ActivityLog key="all" basePath="/administration/audit-logs" showModuleFilter />
      ) : (
        <ActivityLog key="administration" basePath="/administration/activity" module="administration" />
      )}
    </Page>
  );
}
