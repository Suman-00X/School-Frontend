/* HR-03 · Staff attendance: the daily register (grid editor) and a summary over a range */
import { useSearchParams } from "react-router-dom";
import { Page, Tabs, useTabParam, type TabItem } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { RegisterPanel } from "../components/RegisterPanel";
import { SummaryPanel } from "../components/SummaryPanel";

const TABS: TabItem[] = [
  { id: "register", label: "Daily register" },
  { id: "summary", label: "Summary" }
];

export default function StaffAttendancePage() {
  const [, setSearch] = useSearchParams();
  const [tab] = useTabParam(TABS);
  /* Each tab keeps its own filters in the URL */
  const switchTab = (id: string) => setSearch(id === TABS[0]!.id ? {} : { tab: id }, { replace: true });

  return (
    <Page>
      <PageIntro>
        {tab === "register"
          ? "Mark every employee for the day. Approved leave is marked on its own; payroll counts absences and unpaid leave as loss of pay."
          : "Days present per employee over a range. Days present = present + on duty + half of half days."}
      </PageIntro>
      <Tabs tabs={TABS} value={tab} onChange={switchTab} />
      {tab === "register" ? <RegisterPanel /> : <SummaryPanel />}
    </Page>
  );
}
