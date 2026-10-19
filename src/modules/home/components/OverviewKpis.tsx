import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import { Button, Kpi } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { OVERVIEW_PATH, type Overview } from "../api/overview";
import "./home.css";

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

const LABELS = ["Students", "Teachers", "Attendance today", "Fee collection rate", "Net collected this year"];

/* An inline grey bar: sits on a text line, so a loading tile is exactly as tall as a loaded one */
const Bar = ({ width }: { width: number | string }) => <span className="skeleton home-bar" style={{ width }} />;

/* The headline numbers for ADMIN, PRINCIPAL and ACCOUNTANT (reports.dashboards.overview).
   Every state (loading, loaded, no year, failed) is the same row of five tiles of the same height. */
export function OverviewKpis() {
  const { data, isLoading, error, refetch } = useApiGet<Overview>(OVERVIEW_PATH);

  if (error) {
    if (isApiError(error) && error.status === 403) return null;
    const noYear = isApiError(error) && error.status === 422;
    return (
      <div className="kpis home-kpis">
        <div className="kpi home-kpi-notice">
          <div className="kpi-label">{noYear ? "No academic year yet" : "School overview"}</div>
          <div className="home-kpi-notice-body">
            <span className="home-kpi-notice-text" title={noYear ? error.message : undefined}>
              {noYear ? error.message : "The school overview couldn't be loaded."}
            </span>
            {noYear ? (
              <Link to="/academics/academic-years">Set one up</Link>
            ) : (
              <Button size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !data)
    return (
      <div className="kpis home-kpis" aria-busy="true">
        {LABELS.map(label => (
          <Kpi key={label} label={label} value={<Bar width="45%" />} hint={<Bar width="75%" />} />
        ))}
      </div>
    );

  const { headcounts: h, attendanceToday: a, fees: f } = data;
  return (
    <div className="kpis home-kpis">
      <Kpi label="Students" value={h.students} hint={`${h.admissionsLast30Days} admitted in the last 30 days`} />
      <Kpi label="Teachers" value={h.teachers} hint={`${h.staff} staff · ${h.sections} sections`} />
      <Kpi
        label="Attendance today"
        value={pct(a.presentPercentage)}
        hint={a.sectionsTaken === 0 ? "Registers not taken yet" : `${a.sectionsTaken} of ${a.sectionsTotal} sections taken`}
      />
      <Kpi label="Fee collection rate" value={pct(f.collectionRate)} hint={f.collectionRate === null ? "Nothing billed yet" : "Of what was billed"} />
      <Kpi label="Net collected this year" value={formatMoney(f.netCollectedThisYear, data.currency)} hint={data.academicYear.yearName} />
    </div>
  );
}
