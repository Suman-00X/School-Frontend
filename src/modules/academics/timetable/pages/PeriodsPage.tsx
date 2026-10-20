/* AC-07 · Periods (Academics › Setup › Calendar): the bell schedule, the periods and breaks of
   the school day that timetable lessons are placed in */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Plus } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, PageHeader } from "@/common/ui";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { hhmm, PERIODS_PATH, type Period } from "../api/timetable";
import { PeriodDrawer } from "../components/PeriodDrawer";

export default function PeriodsPage() {
  const { selected: year } = useAcademicYear();
  return (
    <Page>
      <PageHeader
        title="Periods"
        subtitle={
          <>
            The periods and breaks of the school day in {year?.yearName ?? "the year chosen in the header"}. Lessons are placed in them on{" "}
            <Link to={SETUP_PATHS.timetable}>Timetables</Link>.
          </>
        }
      />
      <BellSchedule />
    </Page>
  );
}

function BellSchedule() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const list = useApiList<Period>(PERIODS_PATH, { limit: 100 });
  const [drawer, setDrawer] = useState<{ period: Period | null } | null>(null);
  const canEdit = can("academics.timetable.manage") && !readOnly;
  const rows = [...(list.rows ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const addButton = canEdit && (
    <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setDrawer({ period: null })}>
      Add period
    </Button>
  );

  return (
    <Card flush title="Bell schedule" subtitle={list.rows ? `${rows.filter(p => !p.isBreak).length} lesson periods, ${rows.filter(p => p.isBreak).length} breaks` : " "} actions={addButton}>
      <DataTable
        rows={list.rows ? rows : undefined}
        rowKey={p => p.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        onRowClick={p => setDrawer({ period: p })}
        empty={<EmptyState icon={<Clock />} title="No periods yet" message="Add the periods and breaks of the school day; lessons are placed in them." actions={addButton} />}
        columns={[
          { key: "periodNumber", header: "No.", width: 60, render: p => <span className="mono">{p.periodNumber}</span> },
          {
            key: "name",
            header: "Name",
            render: p => (
              <span className="row">
                <strong>{p.name}</strong>
                {p.isBreak && <Badge>Break</Badge>}
              </span>
            )
          },
          { key: "time", header: "Time", render: p => <span className="nowrap">{hhmm(p.startTime)}–{hhmm(p.endTime)}</span> },
          {
            key: "length",
            header: "Length",
            align: "right",
            render: p => {
              const [sh, sm] = hhmm(p.startTime).split(":").map(Number);
              const [eh, em] = hhmm(p.endTime).split(":").map(Number);
              return `${eh! * 60 + em! - (sh! * 60 + sm!)} min`;
            }
          }
        ]}
      />
      <PeriodDrawer open={!!drawer} period={drawer?.period ?? null} periods={list.rows ?? []} canEdit={canEdit} onClose={() => setDrawer(null)} />
    </Card>
  );
}
