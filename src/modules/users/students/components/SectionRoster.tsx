import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Badge, DataTable, EmptyState, PersonCell, Select, StatusBadge } from "@/common/ui";
import { enumLabel } from "@/common/utils/format";
import { sectionLabel, useClasses, useRoster, useSections } from "../api/placement";

/* "Browse by section": class → section → the enrollment roster of the header's year */
export function SectionRoster({
  classId,
  sectionId,
  page,
  onChange,
  onPageChange
}: {
  classId: string;
  sectionId: string;
  page: number;
  onChange: (change: { classId?: string; sectionId?: string }) => void;
  onPageChange: (page: number) => void;
}) {
  const navigate = useNavigate();
  const { selected: year } = useAcademicYear();
  const classes = useClasses();
  const sections = useSections(classId || null, undefined, !!classId);
  const roster = useRoster(sectionId, page);

  return (
    <>
      <div className="filter-bar">
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
        {year && <span className="small muted" style={{ alignSelf: "flex-end", paddingBottom: 8 }}>Year {year.yearName}</span>}
      </div>
      {sectionId ? (
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
      ) : (
        <EmptyState icon={<Layers />} title="Choose a class and section" message="The roster shows who is enrolled in the section this year." />
      )}
    </>
  );
}
