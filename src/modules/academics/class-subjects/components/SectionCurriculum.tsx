/* AC-03 + AC-04, the Curriculum tab of Academics › Setup › Curriculum: a class, then one of its
   sections, with each subject the section is taught, its teacher and classes a week */
import { useState, type FormEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { BookOpen, MoreHorizontal, Plus, Repeat, Settings2, Trash2, UserMinus } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiList, useApiMutation } from "@/common/hooks";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Menu,
  MenuItem,
  PersonCell,
  RadioGroup,
  Select,
  TextInput,
  Textarea,
  useConfirm,
  useToast
} from "@/common/ui";
import { useTeacherOptions } from "../../classes/api/sections";
import { ClassSectionPicker, type ClassSectionPick } from "../../shared/components/ClassSectionPicker";
import { sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { SETUP_PATHS } from "../../shared/utils/paths";
import { useSubjectOptions } from "../../subjects/api/subjects";
import {
  addSectionSubject,
  removeSectionSubject,
  SECTION_SUBJECTS_PATH,
  useSectionSubjects,
  type SectionSubject
} from "../../section-subjects/api/sectionSubjects";
import { assignTeacher, TEACHER_ASSIGNMENTS_PATH, teacherName, type TeacherAssignment } from "../../teacher-assignments/api/teacherAssignments";
import { AssignTeacherDialog } from "../../teacher-assignments/components/AssignTeacherDialog";
import { useRemoveAssignment, type AssignDialogState } from "../../teacher-assignments/components/ByTeacher";
import { addClassSubject, CLASS_SUBJECTS_PATH, removeClassSubject, useClassSubjects, type ClassSubject } from "../api/classSubjects";
import { ClassSubjectDialog } from "./ClassSubjectDialog";
import "./classSubjects.css";

const INVALIDATE = [SECTION_SUBJECTS_PATH, CLASS_SUBJECTS_PATH, TEACHER_ASSIGNMENTS_PATH];

type Row = { subject: SectionSubject; classSubject?: ClassSubject; assignment?: TeacherAssignment };

export function SectionCurriculum({ pick, onPick }: { pick: ClassSectionPick; onPick: (classId: string, sectionId: string) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year, readOnly } = useAcademicYear();
  const { byId } = useSectionOptions();
  const { sectionId, classId } = pick;
  const section = byId.get(sectionId);
  const label = section ? sectionTitle(section) : "this section";
  const className = pick.className ?? "the class";
  const yearName = year?.yearName ?? "this year";

  const seesTeachers = can("academics.teacherAssignments.read");
  const subjects = useSectionSubjects(sectionId || null);
  const classSubjects = useClassSubjects(can("academics.classSubjects.read") ? classId : null);
  const assignments = useApiList<TeacherAssignment>(TEACHER_ASSIGNMENTS_PATH, { sectionId, limit: 100 }, { enabled: !!sectionId && seesTeachers });

  const [assign, setAssign] = useState<AssignDialogState | null>(null);
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState<ClassSubject | null>(null);
  const askRemoveTeacher = useRemoveAssignment();
  const takeOff = useApiMutation(removeSectionSubject, { invalidate: INVALIDATE });
  const removeFromClass = useApiMutation(removeClassSubject, { invalidate: INVALIDATE });

  /* Assigning needs the teacher list, which only ADMIN, PRINCIPAL and STAFF can read */
  const canAssign = can("academics.teacherAssignments.create") && can("users.teachers.read") && !readOnly;
  const canRemoveTeacher = can("academics.teacherAssignments.remove") && !readOnly;
  const canAdd = can("academics.sectionSubjects.create") && !readOnly;
  const canTakeOff = can("academics.sectionSubjects.remove") && !readOnly;
  const canEditClass = can("academics.classSubjects.update") && !readOnly;
  const canRemoveFromClass = can("academics.classSubjects.remove") && !readOnly;

  const rows: Row[] | undefined =
    subjects.rows && (!seesTeachers || assignments.rows)
      ? subjects.rows.map(s => ({
          subject: s,
          classSubject: classSubjects.rows?.find(c => c.subjectId === s.subjectId),
          assignment: assignments.rows?.find(a => a.subjectId === s.subjectId)
        }))
      : undefined;
  const taken = (assignments.rows ?? []).map(a => `${a.sectionId}:${a.subjectId}`);
  const weekly = (rows ?? []).reduce((n, r) => n + (r.subject.weeklyNoOfClasses ?? 0), 0);
  const unassigned = rows?.filter(r => !r.assignment).length ?? 0;
  const summary = rows
    ? [
        `${rows.length} subject${rows.length === 1 ? "" : "s"}`,
        `${weekly} classes a week`,
        seesTeachers && rows.length > 0 && (unassigned ? `${unassigned} without a teacher` : "every subject has a teacher")
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const askTakeOff = async (r: Row) => {
    const name = r.subject.subject.subjectName;
    const ok = await confirm({
      title: `Take ${name} off ${label}?`,
      message: `${label} stops having ${name} in ${yearName}${r.classSubject && !r.classSubject.isOptional ? "; the class's other sections keep it" : ""}. Its timetable lessons and teacher assignment for it may need changing too.`,
      confirmLabel: "Take it off"
    });
    if (ok) takeOff.mutate(r.subject.id, { onSuccess: () => toast.success(`${name} taken off ${label}`), onError: err => toast.error(err) });
  };

  const askRemoveFromClass = async (row: ClassSubject) => {
    const taught = row.sections.filter(s => s.sectionSubjectId).map(s => s.sectionName);
    const ok = await confirm({
      title: `Remove ${row.subject.subjectName} from ${className}?`,
      message: `It is taken off every section of ${className}${taught.length ? ` (${taught.join(", ")})` : ""} for ${yearName}. Their timetable lessons and teacher assignments for it may need changing too.`,
      confirmLabel: "Remove from class"
    });
    if (ok) removeFromClass.mutate(row.id, { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) });
  };

  const menuFor = (r: Row) => {
    const a = r.assignment;
    const items = [
      a && canAssign && canRemoveTeacher && { key: "change", icon: <Repeat />, label: "Change teacher", run: () => setAssign({ change: a }) },
      a && canRemoveTeacher && { key: "unassign", icon: <UserMinus />, label: "Remove teacher", run: () => void askRemoveTeacher(a) },
      r.classSubject && canEditClass && { key: "settings", icon: <Settings2 />, label: `Settings for ${className}`, run: () => setSettings(r.classSubject!) },
      canTakeOff && {
        key: "takeoff",
        icon: <Trash2 />,
        label: `Take off ${section?.sectionName ? `section ${section.sectionName}` : "this section"}`,
        danger: true,
        run: () => void askTakeOff(r)
      },
      r.classSubject &&
        canRemoveFromClass && {
          key: "class",
          icon: <Trash2 />,
          label: `Remove from ${className}`,
          danger: true,
          run: () => void askRemoveFromClass(r.classSubject!)
        }
    ].filter(Boolean) as { key: string; icon: ReactElement; label: string; danger?: boolean; run: () => void }[];
    if (!items.length) return null;
    return (
      <div className="row-actions">
        <Menu
          trigger={toggle => (
            <Button
              size="sm"
              variant="ghost"
              icon={<MoreHorizontal />}
              onClick={toggle}
              aria-label={`Actions for ${r.subject.subject.subjectName}`}
              title="More"
            />
          )}
        >
          {close =>
            items.map(i => (
              <MenuItem
                key={i.key}
                icon={i.icon}
                danger={i.danger}
                onClick={() => {
                  close();
                  i.run();
                }}
              >
                {i.label}
              </MenuItem>
            ))
          }
        </Menu>
      </div>
    );
  };

  return (
    <Card flush>
      <div className="filter-bar">
        <ClassSectionPicker pick={pick} onPick={onPick} />
        {/* Reserved: the summary arriving doesn't move the bar */}
        <span className="small muted" style={{ alignSelf: "center", minHeight: 20 }}>
          {summary}
        </span>
        {sectionId && canAdd && (
          <div style={{ marginLeft: "auto" }}>
            <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
              Add subject
            </Button>
          </div>
        )}
      </div>
      {!sectionId ? (
        pick.classId && !pick.isLoading ? (
          <EmptyState icon={<BookOpen />} title={`${className} has no sections in ${yearName}`} message="Add them on Classes & sections first." />
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title="Pick a class"
            message="Then a section: its subjects, who teaches each one and how many classes a week appear here."
          />
        )
      ) : (
        <DataTable
          rows={rows}
          rowKey={r => r.subject.id}
          loading={subjects.isLoading || (seesTeachers && assignments.isLoading)}
          error={subjects.error ?? assignments.error}
          onRetry={() => {
            void subjects.refetch();
            void assignments.refetch();
          }}
          empty={
            <EmptyState
              icon={<BookOpen />}
              title={`No subjects in ${label} yet`}
              message="Add the subjects this section is taught, then who teaches each one."
              actions={
                canAdd && (
                  <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
                    Add subject
                  </Button>
                )
              }
            />
          }
          columns={[
            {
              key: "subject",
              header: "Subject",
              render: r => (
                <div>
                  <span className="class-subject-name">
                    <strong style={{ fontWeight: 550 }}>{r.subject.subject.subjectName}</strong>
                    {r.classSubject?.isOptional && <Badge tone="info">Optional</Badge>}
                  </span>
                  {r.subject.description && <div className="small muted">{r.subject.description}</div>}
                </div>
              )
            },
            { key: "code", header: "Code", width: 110, render: r => <span className="mono">{r.classSubject?.code ?? r.subject.subject.subjectCode}</span> },
            ...(seesTeachers
              ? [
                  {
                    key: "teacher",
                    header: "Teacher",
                    render: (r: Row) =>
                      r.assignment ? (
                        <PersonCell name={teacherName(r.assignment.teacher)} sub={r.assignment.teacher.employeeCode} />
                      ) : canAssign ? (
                        <Button size="sm" icon={<Plus />} onClick={() => setAssign({ sectionId, subjectId: r.subject.subjectId, taken })}>
                          Assign
                        </Button>
                      ) : (
                        <Badge tone="warning">Unassigned</Badge>
                      )
                  }
                ]
              : []),
            {
              key: "weekly",
              header: "A week",
              align: "right" as const,
              width: 90,
              render: r => r.subject.weeklyNoOfClasses ?? <span className="muted">—</span>
            },
            { key: "actions", header: "", align: "right" as const, width: 56, render: menuFor }
          ]}
        />
      )}
      {assign && <AssignTeacherDialog {...assign} onClose={() => setAssign(null)} />}
      {settings && <ClassSubjectDialog row={settings} className={className} onClose={() => setSettings(null)} />}
      {adding && section && (
        <AddSubjectDialog
          sectionId={sectionId}
          classId={classId}
          label={label}
          className={className}
          inSection={(subjects.rows ?? []).map(s => s.subjectId)}
          classSubjects={classSubjects.rows ?? []}
          canAssign={canAssign}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  );
}

type Reach = "section" | "class";

/* Give the section a subject, and its teacher if known. A subject its class doesn't have yet can go
   to this section only (optional in the class) or to every section of the class (required). */
function AddSubjectDialog({
  sectionId,
  classId,
  label,
  className,
  inSection,
  classSubjects,
  canAssign,
  onClose
}: {
  sectionId: string;
  classId: string;
  label: string;
  className: string;
  inSection: string[];
  classSubjects: ClassSubject[];
  canAssign: boolean;
  onClose: () => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const school = useSubjectOptions();
  const teachers = useTeacherOptions();
  const [subjectId, setSubjectId] = useState("");
  const [reach, setReach] = useState<Reach>("section");
  const [weekly, setWeekly] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addToSection = useApiMutation(addSectionSubject, { invalidate: INVALIDATE });
  const addToClass = useApiMutation(addClassSubject, { invalidate: INVALIDATE });
  const assign = useApiMutation(assignTeacher, { invalidate: INVALIDATE });

  const inClass = new Map(classSubjects.map(c => [c.subjectId, c]));
  /* The school's subjects; someone who can't read them picks from the class's */
  const options = (
    school.allowed
      ? school.subjects.map(s => ({ id: s.id, name: s.subjectName, code: s.subjectCode }))
      : classSubjects.map(c => ({ id: c.subjectId, name: c.subject.subjectName, code: c.subject.subjectCode }))
  )
    .filter(s => !inSection.includes(s.id))
    .map(s => {
      const c = inClass.get(s.id);
      return { value: s.id, label: s.name, description: c ? `${s.code} · ${c.isOptional ? "optional" : "required"} in ${className}` : s.code };
    });
  const newToClass = !!subjectId && !inClass.has(subjectId);
  const canReachClass = can("academics.classSubjects.create");
  const subjectsLink = can("academics.subjects.create") ? <Link to={SETUP_PATHS.subjects}>Subjects</Link> : "Subjects";

  const pickSubject = (value: string) => {
    setSubjectId(value);
    setErrors(({ subjectId: _drop, ...rest }) => rest);
    const c = inClass.get(value);
    if (c?.weeklyNoOfClasses && !weekly) setWeekly(String(c.weeklyNoOfClasses));
    /* A new subject follows its default on the Subjects page */
    const s = school.byId.get(value);
    setReach(!c && s && !s.isOptional && canReachClass ? "class" : "section");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!subjectId) errs.subjectId = "Pick a subject";
    const n = weekly.trim() ? Number(weekly) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 50)) errs.weeklyNoOfClasses = "A whole number from 1 to 50";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    const copied = { ...(n !== null ? { weeklyNoOfClasses: n } : {}), ...(description.trim() ? { description: description.trim() } : {}) };
    setSaving(true);
    try {
      const res =
        newToClass && reach === "class"
          ? await addToClass.mutateAsync({ classId, subjectId, isOptional: false, ...copied })
          : await addToSection.mutateAsync({ sectionId, subjectId, ...copied });
      let message = res.message;
      if (teacherId) {
        const name = teachers.options.find(o => o.value === teacherId)?.label ?? "The teacher";
        try {
          await assign.mutateAsync({ sectionId, subjectId, teacherId });
          message = `${message}; ${name} teaches it in ${label}`;
        } catch (err) {
          toast.error(`Subject added, but ${name} could not be assigned: ${isApiError(err) ? err.message : "please try again"}`);
          onClose();
          return;
        }
      }
      toast.success(message);
      onClose();
    } catch (err) {
      if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
      else if (isApiError(err) && err.status === 409) setErrors({ subjectId: err.message });
      setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Add a subject to ${label}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="section-subject-form" variant="primary" loading={saving}>
            Add subject
          </Button>
        </>
      }
    >
      <form id="section-subject-form" className="stack" onSubmit={e => void submit(e)} noValidate>
        <Select
          label="Subject"
          required
          searchable
          options={options}
          value={subjectId}
          placeholder={school.isLoading ? "Loading subjects…" : options.length ? "Pick a subject" : "No subjects left to add"}
          hint={<>The school&apos;s subjects. Missing one? Add it on {subjectsLink} first.</>}
          error={errors.subjectId}
          onChange={e => pickSubject(e.target.value)}
        />
        {newToClass && canReachClass && (
          <Field label="Give it to">
            <RadioGroup<Reach>
              aria-label="Which sections"
              value={reach}
              onChange={setReach}
              options={[
                { value: "section", label: `Only ${label}`, description: `Optional in ${className}; give it to other sections later` },
                { value: "class", label: `Every section of ${className}`, description: "Required: also sections added later; one can be taken off" }
              ]}
            />
          </Field>
        )}
        <TextInput
          label="Classes a week"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          placeholder="5"
          hint="Optional; the timetable shows it as a target"
          value={weekly}
          error={errors.weeklyNoOfClasses}
          onChange={e => setWeekly(e.target.value)}
        />
        {canAssign && (
          <Select
            label="Teacher"
            searchable
            options={teachers.options}
            value={teacherId}
            placeholder={teachers.isLoading ? "Loading teachers…" : "Pick a teacher"}
            hint={`Optional; who teaches it in ${label}`}
            onChange={e => setTeacherId(e.target.value)}
          />
        )}
        <Textarea label="Note" rows={2} maxLength={1000} value={description} error={errors.description} onChange={e => setDescription(e.target.value)} />
      </form>
    </Dialog>
  );
}
