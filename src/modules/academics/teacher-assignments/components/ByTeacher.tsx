/* AC-04 · Teacher assignments, "Teacher" tab of Academics › Setup › Curriculum: one teacher's
   subjects in each section; the Curriculum tab assigns them section by section */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Repeat, Trash2, UserRound } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Kpi, Menu, MenuItem, Select, Skeleton, useConfirm, useToast } from "@/common/ui";
import { useTeacherOptions } from "../../classes/api/sections";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { fetchAll } from "../../shared/api/fetchAll";
import { removeAssignment, TEACHER_ASSIGNMENTS_PATH, teacherName, type TeacherAssignment, type TeacherTimetableSummary } from "../api/teacherAssignments";
import type { AssignTeacherDialog } from "./AssignTeacherDialog";
import "../../shared/components/setup.css";

/* What the assign dialog is opened with */
export type AssignDialogState = Omit<Parameters<typeof AssignTeacherDialog>[0], "onClose">;

export function useRemoveAssignment() {
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

export function AssignmentMenu({ a, canAssign, canRemove, onChange, onRemove }: { a: TeacherAssignment; canAssign: boolean; canRemove: boolean; onChange: () => void; onRemove: () => void }) {
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

/* Every assignment the person may see, for the teacher picker of those who can't list teachers */
function useAllAssignments(enabled: boolean) {
  return useQuery({
    queryKey: [TEACHER_ASSIGNMENTS_PATH, { all: true }],
    enabled,
    staleTime: 60_000,
    queryFn: () => fetchAll<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH)
  });
}

export function ByTeacher({
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
  onDialog: (d: AssignDialogState) => void;
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
  const askRemove = useRemoveAssignment();
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
                render: a => <AssignmentMenu a={a} canAssign={canAssign} canRemove={canRemove} onChange={() => onDialog({ change: a })} onRemove={() => void askRemove(a)} />
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
