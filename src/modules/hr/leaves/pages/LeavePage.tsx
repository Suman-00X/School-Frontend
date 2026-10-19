/* HR-04 · Leave requests and balances: the approval queue, and one employee's balances */
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { Page, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { BalancesPanel } from "../components/BalancesPanel";
import { RequestsPanel } from "../components/RequestsPanel";

export default function LeavePage() {
  const { can } = useAuth();
  const [search, setSearch] = useSearchParams();
  const tabs: TabItem[] = [
    { id: "requests", label: "Requests", hidden: !can("hr.leaveRequests.read") },
    { id: "balances", label: "Balances", hidden: !can("hr.leaveBalances.read") }
  ];
  const [tab] = useTabParam(tabs);
  const first = tabs.find(t => !t.hidden)?.id;

  /* Each tab keeps its filters in the URL; the employee carries over */
  const switchTab = (id: string) => {
    const next = new URLSearchParams();
    const userId = search.get("userId");
    if (userId) next.set("userId", userId);
    if (id !== first) next.set("tab", id);
    setSearch(next, { replace: true });
  };

  return (
    <Page>
      <PageIntro>
        {tab === "requests"
          ? "Staff apply for leave themselves. Approve or reject what is waiting; approved days are marked on the staff register."
          : "Balances per calendar year: the quota, minus approved and pending days."}
      </PageIntro>
      <Tabs tabs={tabs} value={tab} onChange={switchTab} />
      {tab === "requests" ? <RequestsPanel /> : <BalancesPanel />}
    </Page>
  );
}
