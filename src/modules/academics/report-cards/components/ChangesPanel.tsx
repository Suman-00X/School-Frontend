import { useState } from "react";
import { GitCompare } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, Select, StatTile, StatTiles, type Column } from "@/common/ui";
import { RESULT_LABELS, sourcePaths, studentFullName, type ChangeStatus, type Comparison, type Publication, type Source } from "../api/reportCards";

const STATUS_LABELS: Record<ChangeStatus, string> = {
  CHANGED: "Changed",
  UNCHANGED: "Unchanged",
  NOT_PUBLISHED: "Not in the published version",
  NO_LONGER_LISTED: "No longer in the results"
};
const STATUS_TONES = { CHANGED: "warning", UNCHANGED: "neutral", NOT_PUBLISHED: "info", NO_LONGER_LISTED: "danger" } as const;

const FIELD_LABELS: Record<string, string> = {
  result: "Result",
  percentage: "Percentage",
  grade: "Grade",
  gpa: "GPA",
  cgpa: "CGPA",
  totalObtained: "Total",
  graceTotal: "Grace",
  rank: "Rank",
  classRank: "Class rank",
  status: "status",
  marksObtained: "marks",
  graceMarks: "grace",
  gradePoint: "grade point",
  passed: "passed",
  counted: "counted"
};

/* "MAT.marksObtained" -> "MAT marks" */
const fieldLabel = (field: string) => {
  const [a, b] = field.split(".");
  return b ? `${a} ${FIELD_LABELS[b] ?? b}` : (FIELD_LABELS[a!] ?? a!);
};
const VALUE_LABELS: Record<string, string> = {
  ...RESULT_LABELS,
  NOT_RECORDED: "not entered",
  PRESENT: "present",
  GRADED: "graded",
  ABSENT: "absent",
  EXEMPT: "exempt"
};
const show = (v: unknown) =>
  v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "string" ? (VALUE_LABELS[v] ?? v) : String(v);

type Row = Comparison["students"][number];

/* AC-15 Changes since publishing: live results against a published version, student by student */
export function ChangesPanel({ source, sectionId, versions }: { source: Source; sectionId: string; versions: Publication[] }) {
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<ChangeStatus | "">("CHANGED");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const enabled = versions.length > 0;
  const cmp = useApiGet<Comparison>(enabled ? sourcePaths(source).comparison : null, {
    sectionId: sectionId || undefined,
    version: version || undefined
  });
  const data = cmp.data;
  const rows = (data?.students ?? []).filter(s => !status || s.status === status);

  if (!enabled)
    return (
      <Card>
        <EmptyState
          icon={<GitCompare />}
          title="Nothing published to compare with"
          message="Once results are published, changes made to marks afterwards show up here."
        />
      </Card>
    );
  if (cmp.error) return <ErrorState error={cmp.error} onRetry={() => void cmp.refetch()} />;

  const toggle = (id: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns: Column<Row>[] = [
    { key: "name", header: "Student", render: s => <span className="nowrap">{studentFullName(s)}</span> },
    { key: "section", header: "Section", render: s => <span className="nowrap">{s.section}</span> },
    {
      key: "status",
      header: "Status",
      render: s => (
        <Badge tone={STATUS_TONES[s.status]} dot>
          {STATUS_LABELS[s.status]}
        </Badge>
      )
    },
    {
      key: "changes",
      header: "Published → now",
      render: s => {
        if (!s.changes.length) return <span className="muted">—</span>;
        const expanded = open.has(s.studentId);
        const list = expanded ? s.changes : s.changes.slice(0, 2);
        return (
          <div className="rc-changes">
            {list.map(c => (
              <div key={c.field} className="small">
                <span className="muted">{fieldLabel(c.field)}:</span> {show(c.published)} → <strong>{show(c.live)}</strong>
              </div>
            ))}
            {s.changes.length > 2 && (
              <Button size="sm" variant="link" onClick={() => toggle(s.studentId)}>
                {expanded ? "Show less" : `${s.changes.length - 2} more`}
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  const sm = data?.summary;
  return (
    <div className="stack">
      <StatTiles>
        <StatTile
          label="Changed"
          loading={!sm}
          value={sm?.changed}
          hint="Differ from the published card"
          hintTone={sm?.changed ? "warn" : undefined}
        />
        <StatTile label="Unchanged" loading={!sm} value={sm?.unchanged} hint={sm ? `of ${sm.students} students` : undefined} />
        <StatTile label="Not published" loading={!sm} value={sm?.notPublished} hint="New since that version" />
        <StatTile label="No longer listed" loading={!sm} value={sm?.noLongerListed} hint="Published, now gone" />
      </StatTiles>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Compare with"
            className="select-sm"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="The version on the portal"
            options={versions.map(v => ({
              value: String(v.version),
              label: `Version ${v.version}`,
              description: v.status === "CURRENT" ? "On the portal" : v.status === "WITHDRAWN" ? "Withdrawn" : "Replaced"
            }))}
          />
          <Select
            label="Show"
            className="select-sm"
            value={status}
            onChange={e => setStatus(e.target.value as ChangeStatus | "")}
            placeholder="Every student"
            options={(Object.keys(STATUS_LABELS) as ChangeStatus[]).map(s => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data ? rows : undefined}
          rowKey={s => s.studentId}
          loading={cmp.isLoading}
          empty={
            <EmptyState
              icon={<GitCompare />}
              title={status === "CHANGED" ? "Nothing has changed since publishing." : "No students match."}
              message={status === "CHANGED" ? "The live results match the published report cards." : undefined}
            />
          }
        />
      </Card>
    </div>
  );
}
