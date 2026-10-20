import { Sprout } from "lucide-react";
import { ApiError } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import { Badge, Card, DataTable, EmptyState, ErrorState, StatTile, StatTiles, type Column } from "@/common/ui";
import { hpcSectionPath, type HpcSection, type HpcSectionStudent } from "../api/holisticProgress";
import { HpcDrawer } from "./HpcDrawer";
import "../holistic.css";

const status = (s: HpcSectionStudent, subjects: number) =>
  s.complete ? (
    <Badge tone="success" dot>
      Complete
    </Badge>
  ) : s.updatedAt ? (
    <Badge tone="warning" dot>
      In progress
    </Badge>
  ) : (
    <Badge>{subjects ? "Not started" : "No subjects"}</Badge>
  );

/* AC-15 Holistic progress (when the NEP policy opts in): the section's cards for the exam,
   one drawer per student. 409 from the API (the class's stage is not covered) is shown as is. */
export function HolisticProgressPanel({
  examId,
  sectionId,
  studentId,
  onOpen
}: {
  examId: string;
  sectionId: string;
  studentId: string;
  onOpen: (studentId: string) => void;
}) {
  const sheet = useApiGet<HpcSection>(hpcSectionPath(examId, sectionId));
  const data = sheet.data;

  if (sheet.error) {
    return sheet.error instanceof ApiError && sheet.error.status === 409 ? (
      <Card>
        <EmptyState icon={<Sprout />} title="No Holistic Progress Card for this class" message={sheet.error.message} />
      </Card>
    ) : (
      <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
    );
  }

  const subjects = data?.subjects.length ?? 0;
  const columns: Column<HpcSectionStudent>[] = [
    { key: "roll", header: "Roll", width: 80, render: s => <span className="mono small nowrap">{s.rollNumber ?? "—"}</span> },
    { key: "name", header: "Student", render: s => `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() },
    {
      key: "subjects",
      header: "Subjects assessed",
      align: "center",
      render: s => (
        <span className={s.assessedSubjects === subjects && subjects ? undefined : "muted"}>
          {s.assessedSubjects} / {subjects}
        </span>
      )
    },
    { key: "reflections", header: "Reflections", align: "center", render: s => (s.reflections ? "Yes" : <span className="muted">—</span>) },
    { key: "status", header: "Status", render: s => status(s, subjects) }
  ];

  const ids = (data?.students ?? []).map(s => s.studentId);
  const next = ids[ids.indexOf(studentId) + 1];

  return (
    <div className="stack">
      <StatTiles>
        <StatTile label="Stage" value={data?.stage.label} hint={data ? data.stage.levels.map(l => l.label).join(" → ") : undefined} loading={sheet.isLoading} />
        <StatTile
          label="Complete"
          value={data ? `${data.summary.complete} / ${data.summary.students}` : undefined}
          hint="Every subject assessed and feedback written"
          meter={data && data.summary.students ? Math.round((data.summary.complete / data.summary.students) * 100) : null}
          meterTone="success"
          loading={sheet.isLoading}
        />
        <StatTile
          label="Started"
          value={data?.summary.started}
          hint={data ? (data.subjects.length ? `Subjects: ${data.subjects.map(s => s.subjectName).join(", ")}` : "No papers in this exam") : undefined}
          loading={sheet.isLoading}
        />
      </StatTiles>
      <Card flush title="Holistic Progress Cards" subtitle="Abilities per subject (awareness, sensitivity, creativity), self and peer assessment, and feedback. Click a student to fill in their card.">
        <DataTable
          rows={data?.students}
          columns={columns}
          rowKey={s => s.studentId}
          loading={sheet.isLoading}
          onRowClick={s => onOpen(s.studentId)}
          empty={<EmptyState icon={<Sprout />} title="No students in this section" />}
        />
      </Card>
      {studentId && <HpcDrawer key={studentId} examId={examId} studentId={studentId} onClose={() => onOpen("")} onNext={next ? () => onOpen(next) : undefined} />}
    </div>
  );
}
