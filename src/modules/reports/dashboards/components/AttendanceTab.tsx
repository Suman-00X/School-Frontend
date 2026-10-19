import { useNavigate } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useDebounce, useListParams } from "@/common/hooks";
import { BarList, Card, ColumnChart, DataTable, EmptyState, LineChart, TextInput, Badge } from "@/common/ui";
import { enumLabel, formatDate } from "@/common/utils/format";
import { DASHBOARDS_PATH, pct, shortDate, type AttendanceReport } from "../api/dashboards";
import { ChartCard, DashboardError, MiniTable } from "./ChartCard";

const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000) + 1;

/* RP-01 Attendance: the daily trend, sections from lowest to highest, students below a threshold */
export function AttendanceTab() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { params, setParam } = useListParams({ from: "", to: "", threshold: "", minDays: "" });
  const query = useDebounce(
    {
      from: params.from || undefined,
      to: params.to || undefined,
      threshold: params.threshold || undefined,
      minDays: params.minDays || undefined
    },
    400
  );
  const q = useApiGet<AttendanceReport>(`${DASHBOARDS_PATH}/attendance`, query, { key: [`${DASHBOARDS_PATH}/attendance`, query] });
  const d = q.data;
  const loading = !d && !q.error;

  const lows = d?.trend.filter(t => t.percentage !== null).map(t => t.percentage!) ?? [];
  const floor = lows.length ? Math.max(0, Math.floor((Math.min(...lows) - 5) / 10) * 10) : 0;
  const sections = [...(d?.bySection ?? [])].sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101));
  const threshold = d?.threshold ?? 75;

  const filters = (
    <Card flush>
      <div className="filter-bar">
        <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
        <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        <TextInput
          label="Below (%)"
          type="number"
          min={1}
          max={100}
          className="input-sm input-num"
          placeholder="75"
          value={params.threshold}
          onChange={e => setParam("threshold", e.target.value)}
        />
        <TextInput
          label="At least (days)"
          type="number"
          min={1}
          max={365}
          className="input-sm input-num"
          placeholder="5"
          value={params.minDays}
          onChange={e => setParam("minDays", e.target.value)}
        />
        <span className="small muted" style={{ paddingBottom: 8 }}>
          {d ? `${formatDate(d.from)} – ${formatDate(d.to)}` : " "}
        </span>
      </div>
    </Card>
  );

  if (q.error)
    return (
      <div className="stack">
        {filters}
        <DashboardError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );

  const modes = d?.modes ?? [];
  const total = d ? daysBetween(d.from, d.to) : 1;

  return (
    <div className="stack" style={{ opacity: q.isFetching && d ? 0.7 : 1, transition: "opacity .15s" }}>
      {filters}
      <div className="dash-grid">
        <div className="span-2">
          <ChartCard
            title="Daily attendance"
            subtitle="Students present, as a share of those on the register"
            loading={loading}
            minHeight={300}
            legend={
              /* The school's attendance mode over the range (one band; segments when it changed) */
              <div className="mode-band" aria-label="Attendance mode">
                {modes.length === 0 ? (
                  <span style={{ flex: 1 }}>No attendance mode set</span>
                ) : (
                  modes.map(m => (
                    <span key={m.from} style={{ flex: daysBetween(m.from, m.to) / total }} title={`${enumLabel(m.mode)} from ${formatDate(m.from)} to ${formatDate(m.to)}`}>
                      {enumLabel(m.mode)} · {shortDate(m.from)} – {shortDate(m.to)}
                    </span>
                  ))
                )}
              </div>
            }
            chart={
              <LineChart
                ariaLabel="Daily attendance percentage"
                height={250}
                area
                domain={[floor, 100]}
                formatTick={v => `${v}%`}
                formatValue={v => `${v}%`}
                series={[{ key: "percentage", label: "present" }]}
                data={(d?.trend ?? []).map(t => ({ x: t.date, label: shortDate(t.date), values: { percentage: t.percentage }, note: `${t.absent} absent` }))}
                empty="No registers taken in this range"
              />
            }
            table={<MiniTable head={["Day", "Present", "Absent"]} rows={(d?.trend ?? []).map(t => [formatDate(t.date), pct(t.percentage), t.absent])} />}
          />
        </div>
        <div className="span-2">
          <ChartCard
            title="Absent students per day"
            loading={loading}
            minHeight={180}
            chart={
              <ColumnChart
                ariaLabel="Absent students per day"
                height={170}
                series={[{ key: "absent", label: "absent", color: "var(--chart-2)" }]}
                data={(d?.trend ?? []).map(t => ({ label: shortDate(t.date), values: { absent: t.absent } }))}
                formatTick={v => (Number.isInteger(v) ? String(v) : "")}
                empty="No registers taken in this range"
              />
            }
          />
        </div>
        <ChartCard
          title="By section"
          subtitle={`Lowest first · the dashed line is ${threshold}%`}
          loading={loading}
          minHeight={220}
          chart={
            <BarList
              ariaLabel="Attendance by section"
              max={100}
              mark={{ value: threshold, label: `${threshold}%` }}
              items={sections.map(s => ({
                key: s.sectionId,
                label: s.section,
                value: s.percentage,
                display: pct(s.percentage),
                note: [`${s.daysRecorded} days recorded`, s.periodPercentage !== null ? `${s.periodPercentage}% of periods attended` : null].filter(Boolean).join(" · "),
                color: s.percentage !== null && s.percentage < threshold ? "var(--chart-2)" : undefined
              }))}
              empty="No sections recorded attendance"
            />
          }
          table={
            <MiniTable
              head={["Section", "Present", "Periods", "Days"]}
              rows={sections.map(s => [s.section, pct(s.percentage), s.periodPercentage === null ? "—" : `${s.periodPercentage}%`, s.daysRecorded])}
            />
          }
        />
        <Card
          flush
          title="Below the threshold"
          subtitle={d ? `Under ${threshold}% with at least ${params.minDays || 5} days on the register` : " "}
          actions={d && <Badge tone={d.lowAttendance.length ? "warning" : "success"}>{d.lowAttendance.length}</Badge>}
        >
          <DataTable
            rows={d?.lowAttendance}
            loading={loading}
            rowKey={s => s.studentId}
            onRowClick={can("users.students.read") ? s => navigate(`/users/students/${s.studentId}?tab=attendance`) : undefined}
            columns={[
              { key: "name", header: "Student", render: s => `${s.firstName} ${s.lastName}` },
              { key: "section", header: "Section" },
              { key: "percentage", header: "Present", align: "right", render: s => <strong>{pct(s.percentage)}</strong> }
            ]}
            empty={<EmptyState icon={<UserCheck />} title="Nobody is below the threshold" />}
          />
        </Card>
      </div>
    </div>
  );
}
