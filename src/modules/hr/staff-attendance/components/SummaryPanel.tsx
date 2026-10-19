import { useMemo } from "react";
import { Download, Users } from "lucide-react";
import { saveBlob } from "@/common/api";
import { useApiGet, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, PersonCell, TextInput, type Column } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { EmployeeSelect } from "../../shared/components/EmployeeSelect";
import { firstOfMonth } from "../../shared/utils/format";
import { STAFF_ATTENDANCE_PATH, type Summary, type SummaryRow } from "../api/staffAttendance";
import "../../shared/hr.css";

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* HR-03 Summary: per-employee totals over a range (default: this month up to today) */
export function SummaryPanel() {
  const today = todayIso();
  const { params, setParam } = useListParams({ from: firstOfMonth(today), to: today, userId: "" });
  const rangeProblem = params.to < params.from ? "The end is before the start" : null;
  const summary = useApiGet<Summary>(rangeProblem ? null : `${STAFF_ATTENDANCE_PATH}/summary`, {
    from: params.from,
    to: params.to,
    userId: params.userId || undefined
  });
  const data = summary.data;
  const working = data?.workingDays ?? 0;

  const known = useMemo(() => (data?.employees ?? []).map(e => ({ userId: e.userId, name: e.name, role: e.role, employeeCode: e.employeeCode, designation: e.designation })), [data]);

  const exportCsv = () => {
    if (!data) return;
    const head = ["Employee", "Code", "Designation", "Department", "Present", "On duty", "Half day", "Leave", "Absent", "Marked", "Days present", "Working days"];
    const lines = data.employees.map(e =>
      [e.name, e.employeeCode, e.designation, e.department, e.counts.PRESENT, e.counts.ON_DUTY, e.counts.HALF_DAY, e.counts.LEAVE, e.counts.ABSENT, e.marked, e.daysPresent, data.workingDays]
        .map(csvCell)
        .join(",")
    );
    saveBlob(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }), `staff-attendance-${data.from}-to-${data.to}.csv`);
  };

  const n = (v: number) => <span className="hr-num">{v}</span>;
  const columns: Column<SummaryRow>[] = [
    { key: "name", header: "Employee", render: e => <PersonCell name={e.name} sub={[e.employeeCode, e.designation].filter(Boolean).join(" · ")} /> },
    { key: "present", header: "Present", align: "right", render: e => n(e.counts.PRESENT) },
    { key: "duty", header: "On duty", align: "right", render: e => n(e.counts.ON_DUTY) },
    { key: "half", header: "Half day", align: "right", render: e => n(e.counts.HALF_DAY) },
    { key: "leave", header: "Leave", align: "right", render: e => n(e.counts.LEAVE) },
    { key: "absent", header: "Absent", align: "right", render: e => (e.counts.ABSENT ? <strong className="hr-num" style={{ color: "var(--danger-text)" }}>{e.counts.ABSENT}</strong> : n(0)) },
    { key: "marked", header: "Marked", align: "right", render: e => n(e.marked) },
    { key: "days", header: "Days present", align: "right", render: e => <strong className="hr-num">{e.daysPresent}</strong> },
    {
      key: "bar",
      header: "",
      width: 150,
      render: e => (
        <div className="hr-bar" title={`${e.daysPresent} of ${working} working days`}>
          <span className="is-used" style={{ width: `${working ? Math.min(100, (e.daysPresent / working) * 100) : 0}%` }} />
        </div>
      )
    }
  ];

  return (
    <Card flush>
      <div className="filter-bar">
        <TextInput label="From" type="date" className="input-sm" value={params.from} max={today} onChange={e => e.target.value && setParam("from", e.target.value)} />
        <TextInput label="To" type="date" className="input-sm" value={params.to} max={today} min={params.from} onChange={e => e.target.value && setParam("to", e.target.value)} />
        <EmployeeSelect label="Employee" className="select-sm" value={params.userId} known={known} onChange={id => setParam("userId", id)} />
        <div className="row" style={{ marginLeft: "auto", alignSelf: "flex-end", gap: 12 }}>
          <span className="small muted nowrap">{data ? `Working days: ${data.workingDays}` : " "}</span>
          <Button size="sm" icon={<Download />} disabled={!data?.employees.length} onClick={exportCsv}>
            CSV
          </Button>
        </div>
      </div>
      <DataTable
        rows={rangeProblem ? [] : data?.employees}
        rowKey={e => e.userId}
        loading={summary.isLoading}
        error={summary.error}
        onRetry={() => void summary.refetch()}
        columns={columns}
        empty={<EmptyState icon={<Users />} title={rangeProblem ?? "No employees to show"} />}
      />
    </Card>
  );
}
