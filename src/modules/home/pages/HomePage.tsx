import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { LowAttendanceHighlight, MyDutiesCard, SubstitutionHighlight } from "@/modules/academics";
import { AttendanceWarning } from "@/modules/portal";
import { Page, PageHeader } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { OVERVIEW_PATH, type Overview } from "../api/overview";
import { GetStartedCard } from "../components/GetStartedCard";
import { OverviewKpis } from "../components/OverviewKpis";
import { QuickLinks } from "../components/QuickLinks";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/* The Get started card shows a step for each of these */
const SETUP_PERMISSIONS = [
  "administration.settings.update",
  "academics.academicYears.create",
  "academics.classes.create",
  "academics.sections.create",
  "users.teachers.create",
  "users.staff.create",
  "users.students.admit"
];

const longDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* SH-05 (first cut: overview KPIs, setup checklist, quick links; module widgets come later) */
export default function HomePage() {
  const { me, session, can, canAny } = useAuth();
  const showOverview = can("reports.dashboards.overview");
  /* Same query as the KPI row: the school's today, in its time zone, when we have it */
  const overview = useApiGet<Overview>(OVERVIEW_PATH, undefined, { enabled: showOverview });
  const firstName = me?.account.firstName ?? session?.user.firstName;

  return (
    <Page>
      <PageHeader title={firstName ? `${greeting()}, ${firstName}` : greeting()} subtitle={longDate(overview.data?.today ?? todayIso())} />
      <div className="stack">
        {/* Absent teachers' periods still to plan today (ADMIN, PRINCIPAL); gone once all are planned */}
        <SubstitutionHighlight />
        {/* Attendance for the year below the school's threshold: teachers' students, a family's children */}
        <LowAttendanceHighlight />
        <AttendanceWarning />
        {showOverview && <OverviewKpis />}
        <MyDutiesCard />
        {canAny(...SETUP_PERMISSIONS) ? (
          <div className="grid-2" style={{ alignItems: "start" }}>
            <GetStartedCard />
            <QuickLinks />
          </div>
        ) : (
          <QuickLinks />
        )}
      </div>
    </Page>
  );
}
