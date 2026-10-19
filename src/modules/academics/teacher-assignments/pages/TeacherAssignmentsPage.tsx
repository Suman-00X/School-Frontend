/* AC-04 · Teacher assignments (Academics › Setup) */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Repeat, Trash2, UserRound } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Kpi, Menu, MenuItem, Page, PageHeader, PersonCell, Select, Skeleton, Tabs, useConfirm, useToast } from "@/common/ui";
import { useTeacherOptions } from "../../classes/api/sections";
import { SectionSelect, sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { fetchAll } from "../../shared/api/fetchAll";
import { useSectionSubjects, type SectionSubject } from "../../section-subjects/api/sectionSubjects";
import {
  removeAssignment,
  TEACHER_ASSIGNMENTS_PATH,
  teacherName,
  type TeacherAssignment,
  type TeacherTimetableSummary
} from "../api/teacherAssignments";
import { AssignTeacherDialog } from "../components/AssignTeacherDialog";
import "../../shared/components/setup.css";

type DialogState = { sectionId?: string; subjectId?: string; teacherId?: string; change?: TeacherAssignment; taken?: string[] };

export default function TeacherAssignmentsPage() {
  const { can } = useAuth();
  const { selected: year, readOnly } = useAcademicYear();
  const { params, setParams } = useListParams({ view: "section", section: "", teacher: "" });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  /* Assigning needs the teacher list, which only ADMIN, PRINCIPAL and STAFF can read */
  const canAssign = can("academics.teacherAssignments.create") && can("users.teachers.read") && !readOnly;
  const canRemove = can("academics.teacherAssignments.remove") && !readOnly;
  const view = params.view === "teacher" ? "teacher" : "section";

  return (
    <Page>
      <PageHeader
        title="Teacher assignments"
        subtitle={`Who teaches each subject in each section, for ${year?.yearName ?? "the year chosen in the header"}. To change a teacher, the old assignment is removed and a new one added.`}
        actions={
          canAssign && (
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => setDialog(view === "section" ? { sectionId: params.section || undefined } : { teacherId: params.teacher || undefined })}
            >
              Assign a teacher
            </Button>
          )
        }
      />
      <Tabs
        tabs={[
          { id: "section", label: "By section" },
          { id: "teacher", label: "By teacher" }
        ]}
        value={view}
        onChange={id => setParams({ view: id })}
      />
      {view === "section" ? (
        <BySection
          sectionId={params.section}
          onSection={id => setParams({ section: id })}
          canAssign={canAssign}
          canRemove={canRemove}
          onDialog={setDialog}
        />
      ) : (
        <ByTeacher teacherId={params.teacher} onTeacher={id => setParams({ teacher: id })} canAssign={canAssign} canRemove={canRemove} onDialog={setDialog} />
      )}
      {dialog && <AssignTeacherDialog {...dialog} onClose={() => setDialog(null)} />}
    </Page>
  );
}

function useRemove() {
  const toast = useToast();
  const confirm = useConfirm();
  const { byId } = useSectionOptions();
  const remove = useApiMutation(removeAssignment, { invalidate: [TEACHER_ASSIGNMENTS_PATH] });
  return async (a: TeacherAssignment) => {
    const s = byId.get(a.sectionId);
    const where = s ? sectionTitle(s) : `section ${a.section.sectionName}`;
    const ok = await confirm({
      title: `Remove ${teacherName(a.teacher)} from ${a.subject.subjectName}?`,
      message: `${teacherName(a.teacher)} stops teaching ${a.subject.subjectName} in ${where}. The subject shows as unassigned until someone else is assigned.`,
      confirmLabel: "Remove"
    });
    if (ok) remove.mutate(a.id, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };
}

function RowMenu({ a, canAssign, canRemove, onChange, onRemove }: { a: TeacherAssignment; canAssign: boolean; canRemove: boolean; onChange: () => void; onRemove: () => void }) {
  if (!canAssign && !canRemove) return null;
  return (
    <div className="row-actions" onClick={e => e.stopPropagation()}>
      <Menu trigger={toggle => <Button size="sm" variant="ghost" icon={<MoreHorizontal />} onClick={toggle} aria-label={`Actions for ${a.subject.subjectName}`} title="More" />}>
        {close => (
          <>
            {canAssign && canRemove && (
              <MenuItem
                icon={<Repeat />}
                onClick={() => {
                  close();
                  onChange();
                }}
              >
                Change teacher
              </MenuItem>
            )}
            {canRemove && (
              <MenuItem
                icon={<Trash2 />}
                danger
                onClick={() => {
                  close();
                  onRemove();
                }}
              >
                Remove
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </div>
  );
}

/* One row per section subject, with its teacher or "Unassigned" */
function BySection({
  sectionId,
  onSection,
  canAssign,
  canRemove,
  onDialog
}: {
  sectionId: string;
  onSection: (id: string) => void;
  canAssign: boolean;
  canRemove: boolean;
  onDialog: (d: DialogState) => void;
}) {
  const { byId } = useSectionOptions();
  const subjects = useSectionSubjects(sectionId || null);
  const assignments = useApiList<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH, { sectionId, limit: 100 }, { enabled: !!sectionId });
  const askRemove = useRemove();
  const section = byId.get(sectionId);

  type Row = { subject: SectionSubject; assignment?: TeacherAssignment };
  const rows: Row[] | undefined =
    subjects.rows && assignments.rows ? subjects.rows.map(s => ({ subject: s, assignment: assignments.rows!.find(a => a.subjectId === s.subjectId) })) : undefined;
  const taken = (assignments.rows ?? []).map(a => `${a.sectionId}:${a.subjectId}`);
  const unassigned = rows?.filter(r => !r.assignment).length ?? 0;

  return (
    <Card flush>
      <div className="filter-bar">
        <SectionSelect value={sectionId} onChange={e => onSection(e.target.value)} placeholder="Pick a section" />
        {/* Reserved: the count arriving doesn't move the bar */}
        <span className="small muted" style={{ alignSelf: "center", minHeight: 20 }}>
          {rows && section ? (unassigned ? `${unassigned} of ${rows.length} subjects have no teacher` : `Every subject of ${sectionTitle(section)} has a teacher`) : ""}
        </span>
      </div>
      {!sectionId ? (
        <EmptyState icon={<UserRound />} title="Pick a section" message="Each of its subjects is listed with the teacher who teaches it, or as unassigned." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={r => r.subject.id}
          loading={subjects.isLoading || assignments.isLoading}
          error={subjects.error ?? assignments.error}
          onRetry={() => {
            void subjects.refetch();
            void assignments.refetch();
          }}
          empty={<EmptyState title="This section has no subjects yet" message="Add its subjects on the Subjects page first, then assign their teachers here." />}
          columns={[
            {
              key: "subject",
              header: "Subject",
              render: r => (
                <div>
                  <div style={{ fontWeight: 550 }}>{r.subject.subject.subjectName}</div>
                  <div className="small muted mono">{r.subject.subject.subjectCode}</div>
                </div>
              )
            },
            {
              key: "teacher",
              header: "Teacher",
              render: r =>
                r.assignment ? (
                  <PersonCell name={teacherName(r.assignment.teacher)} sub={r.assignment.teacher.employeeCode} />
                ) : canAssign ? (
                  <Button size="sm" icon={<Plus />} onClick={() => onDialog({ sectionId, subjectId: r.subject.subjectId, taken })}>
                    Assign
                  </Button>
                ) : (
                  <Badge tone="warning">Unassigned</Badge>
                )
            },
            { key: "weekly", header: "A week", align: "right", width: 90, render: r => r.subject.weeklyNoOfClasses ?? <span className="muted">—</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 56,
              render: r =>
                r.assignment && (
                  <RowMenu
                    a={r.assignment}
                    canAssign={canAssign}
                    canRemove={canRemove}
                    onChange={() => onDialog({ change: r.assignment })}
                    onRemove={() => void askRemove(r.assignment!)}
                  />
                )
            }
          ]}
        />
      )}
    </Card>
  );
}

/* Every assignment the person may see, for the teacher picker of those who can't list teachers */
function useAllAssignments(enabled: boolean) {
  return useQuery({
    queryKey: [TEACHER_ASSIGNMENTS_PATH, { all: true }],
    enabled,
    staleTime: 60_000,
    queryFn: () => fetchAll<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH)
  });
}

function ByTeacher({
  teacherId,
  onTeacher,
  canAssign,
  canRemove,
  onDialog
}: {
  teacherId: string;
  onTeacher: (id: string) => void;
  canAssign: boolean;
  canRemove: boolean;
  onDialog: (d: DialogState) => void;
}) {
  const { can } = useAuth();
  const teachers = useTeacherOptions();
  const { byId } = useSectionOptions();
  /* Teachers can't list teachers: pick from the people in the assignments they can see */
  const all = useAllAssignments(!teachers.enabled);
  const options = useMemo(() => {
    if (teachers.enabled) return teachers.options;
    const seen = new Map<string, { value: string; label: string; description: string }>();
    for (const a of all.data ?? []) seen.set(a.teacherId, { value: a.teacherId, label: teacherName(a.teacher), description: a.teacher.employeeCode });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [teachers.enabled, teachers.options, all.data]);

  const list = useApiList<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH, { teacherId, limit: 100 }, { enabled: !!teacherId });
  const lessons = useQuery({
    queryKey: ["/academics/timetable/teachers", teacherId],
    enabled: !!teacherId && can("academics.timetable.read"),
    retry: false,
    queryFn: async () => (await api.get<TeacherTimetableSummary>(`/academics/timetable/teachers/${teacherId}`)).data
  });
  const askRemove = useRemove();
  const rows = list.rows
    ? [...list.rows].sort((a, b) => (byId.get(a.sectionId)?.class?.classOrder ?? 0) - (byId.get(b.sectionId)?.class?.classOrder ?? 0) || a.section.sectionName.localeCompare(b.section.sectionName))
    : undefined;
  const sectionCount = new Set((rows ?? []).map(r => r.sectionId)).size;

  return (
    <div className="stack">
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Teacher"
            searchable
            options={options}
            value={teacherId}
            placeholder={teachers.isLoading || all.isLoading ? "Loading teachers…" : "Pick a teacher"}
            onChange={e => onTeacher(e.target.value)}
            fieldClassName="filter-wide"
          />
        </div>
        {!teacherId ? (
          <EmptyState icon={<UserRound />} title="Pick a teacher" message="Their subjects and sections this year, and how many lessons a week they teach." />
        ) : (
          <DataTable
            rows={rows}
            rowKey={a => a.id}
            loading={list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            empty={
              <EmptyState
                title="No assignments this year"
                message="This teacher doesn't teach any subject in a section yet."
                actions={
                  canAssign && (
                    <Button variant="primary" icon={<Plus />} onClick={() => onDialog({ teacherId })}>
                      Assign a subject
                    </Button>
                  )
                }
              />
            }
            columns={[
              {
                key: "section",
                header: "Section",
                render: a => {
                  const s = byId.get(a.sectionId);
                  return <strong style={{ fontWeight: 550 }}>{s ? sectionTitle(s) : a.section.sectionName}</strong>;
                }
              },
              { key: "subject", header: "Subject", render: a => `${a.subject.subjectName}` },
              { key: "code", header: "Code", render: a => <span className="mono muted">{a.subject.subjectCode}</span> },
              { key: "description", header: "Note", render: a => <span className="muted">{a.description || "—"}</span> },
              {
                key: "actions",
                header: "",
                align: "right",
                width: 56,
                render: a => <RowMenu a={a} canAssign={canAssign} canRemove={canRemove} onChange={() => onDialog({ change: a })} onRemove={() => void askRemove(a)} />
              }
            ]}
          />
        )}
      </Card>
      {teacherId && (
        <div className="kpis">
          <Kpi label="Subjects taught" value={rows ? rows.length : <Skeleton width={40} height={24} />} />
          <Kpi label="Sections" value={rows ? sectionCount : <Skeleton width={40} height={24} />} />
          <Kpi
            label="Lessons a week"
            value={lessons.data ? lessons.data.weeklyLessons : lessons.isLoading ? <Skeleton width={40} height={24} /> : "—"}
            hint={!can("academics.timetable.read") || lessons.error ? "Timetable not available" : "From the timetable"}
          />
        </div>
      )}
    </div>
  );
}
