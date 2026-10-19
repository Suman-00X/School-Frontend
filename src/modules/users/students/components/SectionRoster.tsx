import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Badge, DataTable, EmptyState, PersonCell, Select, StatusBadge } from "@/common/ui";
import { enumLabel } from "@/common/utils/format";
import { sectionLabel, useClasses, useRoster, useSections } from "../api/placement";

/* "Browse by section": class → section → the enrollment roster of the header's year.
   The pickers sit in the list's filter bar all the time (hidden while browsing everyone), so
   switching views swaps the table below in place and never inserts a row above it. */
export function SectionPickers({
  visible,
  classId,
  sectionId,
  onChange
}: {
  visible: boolean;
  classId: string;
  sectionId: string;
  onChange: (change: { classId?: string; sectionId?: string }) => void;
}) {
  const { selected: year } = useAcademicYear();
  const classes = useClasses(visible);
  const sections = useSections(classId || null, undefined, visible && !!classId);

  return (
    <div className="row" style={{ gap: 10, alignItems: "flex-end", visibility: visible ? undefined : "hidden" }} aria-hidden={!visible || undefined}>
      <Select
        label="Class"
        className="select-sm"
        value={classId}
        placeholder={classes.isLoading ? "Loading…" : "Choose a class"}
        options={(classes.data ?? []).map(c => ({ value: c.id, label: c.className }))}
        onChange={e => onChange({ classId: e.target.value, sectionId: "" })}
      />
      <Select
        label="Section"
        className="select-sm"
        value={sectionId}
        disabled={!classId}
        placeholder={classId && sections.data?.rows.length === 0 ? "No sections this year" : "Choose a section"}
        options={(sections.data?.rows ?? []).map(s => ({ value: s.id, label: sectionLabel(s, classes.data) }))}
        onChange={e => onChange({ sectionId: e.target.value })}
      />
      <span className="small muted" style={{ paddingBottom: 7, minWidth: 90 }}>
        {year && `Year ${year.yearName}`}
      </span>
    </div>
  );
}

export function SectionRosterTable({ sectionId, page, onPageChange }: { sectionId: string; page: number; onPageChange: (page: number) => void }) {
  const navigate = useNavigate();
  const roster = useRoster(sectionId, page);

  if (!sectionId)
    return (
      <div className="table-empty">
        <EmptyState icon={<Layers />} title="Choose a class and section" message="The roster shows who is enrolled in the section this year." />
      </div>
    );
  return (
    <DataTable
      rows={roster.rows}
      rowKey={e => e.id}
      loading={roster.isLoading}
      error={roster.error}
      onRetry={() => void roster.refetch()}
      meta={roster.meta}
      onPageChange={onPageChange}
      onRowClick={e => navigate(`/users/students/${e.studentId}`)}
      columns={[
        { key: "rollNumber", header: "Roll no.", width: 110, render: e => <span className="mono">{e.rollNumber}</span> },
        {
          key: "student",
          header: "Student",
          render: e => (
            <PersonCell
              name={e.student ? `${e.student.user.firstName} ${e.student.user.lastName}` : "Student"}
              sub={e.student && [e.student.studentCode, e.student.admissionNumber].join(" · ")}
            />
          )
        },
        { key: "admissionType", header: "Admission", render: e => <Badge>{enumLabel(e.admissionType)}</Badge> },
        { key: "status", header: "Status", render: e => <StatusBadge status={e.status} /> }
      ]}
      empty={<EmptyState icon={<Layers />} title="No students in this section" message="Nobody is enrolled in it for this year." />}
    />
  );
}
