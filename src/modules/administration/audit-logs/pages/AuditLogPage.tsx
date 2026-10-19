import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { ActivityLog } from "@/common/components/activity-log";
import { Page, PageHeader, Tabs, useTabParam, type TabItem } from "@/common/ui";

/* AD-03 */
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
      <PageHeader title="Audit log" subtitle="Every change made in the school, newest first. Nothing here can be edited." />
      <Tabs tabs={tabs} value={tab} onChange={switchTab} />
      {tab === "all" ? (
        <ActivityLog key="all" basePath="/administration/audit-logs" showModuleFilter />
      ) : (
        <ActivityLog key="administration" basePath="/administration/activity" module="administration" />
      )}
    </Page>
  );
}
