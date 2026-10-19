import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import { Alert, Button, Kpi, Skeleton } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { OVERVIEW_PATH, type Overview } from "../api/overview";

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

/* The headline numbers for ADMIN, PRINCIPAL and ACCOUNTANT (reports.dashboards.overview) */
export function OverviewKpis() {
  const { data, isLoading, error, refetch } = useApiGet<Overview>(OVERVIEW_PATH);

  if (error) {
    if (isApiError(error) && error.status === 403) return null;
    if (isApiError(error) && error.status === 422)
      return (
        <Alert tone="info" title="No academic year yet" action={<Link to="/academics/academic-years">Set one up</Link>}>
          {error.message}
        </Alert>
      );
    return (
      <Alert tone="warning" action={<Button size="sm" onClick={() => void refetch()}>Retry</Button>}>
        The school overview couldn't be loaded.
      </Alert>
    );
  }

  if (isLoading || !data)
    return (
      <div className="kpis">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="kpi" key={i}>
            <Skeleton width="50%" />
            <div style={{ marginTop: 10 }}>
              <Skeleton width="70%" height={22} />
            </div>
          </div>
        ))}
      </div>
    );

  const { headcounts: h, attendanceToday: a, fees: f } = data;
  return (
    <div className="kpis">
      <Kpi label="Students" value={h.students} hint={`${h.admissionsLast30Days} admitted in the last 30 days`} />
      <Kpi label="Teachers" value={h.teachers} hint={`${h.staff} staff · ${h.sections} sections`} />
      <Kpi
        label="Attendance today"
        value={pct(a.presentPercentage)}
        hint={a.sectionsTaken === 0 ? "Registers not taken yet" : `${a.sectionsTaken} of ${a.sectionsTotal} sections taken`}
      />
      <Kpi label="Fee collection rate" value={pct(f.collectionRate)} hint={f.collectionRate === null ? "Nothing billed yet" : undefined} />
      <Kpi label="Net collected this year" value={formatMoney(f.netCollectedThisYear, data.currency)} hint={data.academicYear.yearName} />
    </div>
  );
}
