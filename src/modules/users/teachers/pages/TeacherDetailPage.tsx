import { useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, CalendarDays, ExternalLink, Mail, Pencil, Phone } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList, useApiMutation, useForm } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  DescriptionList,
  Drawer,
  EmptyState,
  ErrorState,
  Page,
  SkeletonBlock,
  TextInput,
  useTabParam,
  useToast,
  type TabItem
} from "@/common/ui";
import { enumLabel, formatDate, fullName } from "@/common/utils/format";
import { InviteButton } from "@/modules/auth";
import { DrillName, EMPLOYMENT_KEYS, EMPLOYMENT_TEXT_KEYS, EmploymentFields, RecordHeader, employmentFrom, patchFrom } from "@/modules/users/shared";
import {
  updateTeacher,
  useTeacher,
  type SectionRef,
  type Teacher,
  type TeacherAssignment,
  type TeacherTimetable
} from "../api/teachers";
import { experienceError } from "../utils/teacher";

/* PE-05 · Teacher detail: drill-in header (name, Profile / Assignments / Timetable), a header
   card with the key facts and actions, then the open tab */
export default function TeacherDetailPage() {
  const { teacherId = "" } = useParams();
  const { can } = useAuth();
  const teacher = useTeacher(teacherId);
  const [editing, setEditing] = useState(false);

  const tabs: TabItem[] = [
    { id: "profile", label: "Profile" },
    { id: "assignments", label: "Assignments", hidden: !can("academics.teacherAssignments.read") },
    { id: "timetable", label: "Timetable", hidden: !can("academics.timetable.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);

  const t = teacher.data;
  const name = t ? fullName(t.user) : "";
  const header = <DrillHeader back="/users/teachers" backLabel="Back to teachers" title={<DrillName name={name} />} tabs={tabs} value={tab} onChange={setTab} />;

  if (teacher.error || (!teacher.isLoading && !t))
    return (
      <Page>
        {header}
        <ErrorState error={teacher.error} onRetry={() => void teacher.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      <RecordHeader
        loading={!t}
        name={name}
        facts={
          t && (
            <>
              <Badge tone="primary">
                <span className="mono">{t.employeeCode}</span>
              </Badge>
              {t.employmentType && <Badge>{enumLabel(t.employmentType)}</Badge>}
            </>
          )
        }
        contact={
          t && (
            <>
              <span className="row" style={{ gap: 4 }}>
                <Mail size={14} /> {t.user.email}
              </span>
              {t.user.phone && (
                <span className="row" style={{ gap: 4 }}>
                  <Phone size={14} /> {t.user.phone}
                </span>
              )}
            </>
          )
        }
        actions={
          <>
            <InviteButton userIds={t ? [t.user.id] : []} names={t ? { [t.user.id]: name } : {}} />
            {can("users.accounts.read") && (
              <ButtonLink icon={<ExternalLink />} to={t ? `/users/${t.user.id}` : "#"}>
                Account
              </ButtonLink>
            )}
            {can("users.teachers.update") && (
              <Button icon={<Pencil />} disabled={!t} onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            )}
          </>
        }
      />
      {!t ? (
        <SkeletonBlock lines={8} />
      ) : (
        <>
          {tab === "profile" && (
            <Card title="Profile">
              <DescriptionList
                columns={3}
                items={[
                  { label: "Employee code", value: <span className="mono">{t.employeeCode}</span> },
                  { label: "Email", value: t.user.email },
                  { label: "Phone", value: t.user.phone },
                  { label: "Qualification", value: t.qualification },
                  { label: "Experience", value: t.experienceYears !== null ? `${t.experienceYears} year${t.experienceYears === 1 ? "" : "s"}` : null },
                  { label: "Joined", value: formatDate(t.joiningDate) },
                  { label: "Employment type", value: enumLabel(t.employmentType) },
                  { label: "Blood group", value: t.bloodGroup },
                  { label: "Notes", value: t.description, wide: true }
                ]}
              />
              {can("users.accounts.update") && (
                <div className="small muted" style={{ marginTop: 12 }}>
                  Name, email and phone are on the account: edit them from <ButtonLink variant="link" to={`/users/${t.user.id}`}>the account page</ButtonLink>.
                </div>
              )}
            </Card>
          )}
          {tab === "assignments" && <AssignmentsPanel teacherId={t.id} />}
          {tab === "timetable" && <TimetablePanel teacherId={t.id} />}
          <EditTeacherDrawer teacher={t} open={editing} onClose={() => setEditing(false)} />
        </>
      )}
    </Page>
  );
}

function AssignmentsPanel({ teacherId }: { teacherId: string }) {
  const { can } = useAuth();
  const list = useApiList<TeacherAssignment>("/academics/teacher-assignments", { teacherId, limit: 100 });
  /* Sections give the class name and who is class teacher or deputy */
  const sections = useApiList<SectionRef>("/academics/sections", { limit: 100 }, { enabled: can("academics.sections.read") });
  const byId = new Map((sections.rows ?? []).map(s => [s.id, s]));
  const sectionName = (id: string, fallback: string) => {
    const s = byId.get(id);
    return s?.class?.className ? `${s.class.className}-${s.sectionName}` : fallback;
  };
  const duty = (id: string) => {
    const s = byId.get(id);
    if (s?.classTeacherId === teacherId) return <Badge tone="primary">Class teacher</Badge>;
    if (s?.deputyClassTeacherId === teacherId) return <Badge tone="info">Deputy</Badge>;
    return null;
  };
  const taught = new Set((list.rows ?? []).map(a => a.sectionId));
  const otherDuties = (sections.rows ?? []).filter(
    s => !taught.has(s.id) && (s.classTeacherId === teacherId || s.deputyClassTeacherId === teacherId)
  );

  return (
    <Card
      flush
      title="Assignments"
      subtitle="Subjects taught in the selected academic year"
      actions={
        <ButtonLink size="sm" variant="ghost" icon={<ExternalLink />} to="/academics/teacher-assignments">
          Open in Academics
        </ButtonLink>
      }
    >
      <DataTable
        rows={list.rows}
        rowKey={a => a.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        columns={[
          {
            key: "subject",
            header: "Subject",
            render: a => (
              <span>
                {a.subject.subjectName} <span className="muted mono small">{a.subject.subjectCode}</span>
              </span>
            )
          },
          { key: "section", header: "Section", render: a => sectionName(a.sectionId, a.section.sectionName) },
          { key: "duty", header: "", render: a => duty(a.sectionId) }
        ]}
        empty={<EmptyState icon={<BookOpen />} title="No subjects assigned this year" />}
      />
      {otherDuties.length > 0 && (
        <div className="row" style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
          {otherDuties.map(s => (
            <span key={s.id} className="row">
              {duty(s.id)} {sectionName(s.id, s.sectionName)}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function TimetablePanel({ teacherId }: { teacherId: string }) {
  const grid = useApiGet<TeacherTimetable>(`/academics/timetable/teachers/${teacherId}`);
  const g = grid.data;
  return (
    <Card
      flush
      title="Timetable"
      subtitle={g ? `${g.weeklyLessons} lesson${g.weeklyLessons === 1 ? "" : "s"} a week` : "The selected academic year"}
    >
      {grid.isLoading && (
        <div style={{ padding: 18 }}>
          <SkeletonBlock lines={4} />
        </div>
      )}
      {grid.error && <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />}
      {g && (g.periods.length === 0 || g.weeklyLessons === 0) && (
        <EmptyState icon={<CalendarDays />} title="No lessons on the timetable" message="Lessons appear here once the timetable is built." />
      )}
      {g && g.periods.length > 0 && g.weeklyLessons > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Period</th>
                {g.days.map(d => (
                  <th key={d.weekday}>{d.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.periods.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 550 }}>{p.name}</div>
                    <div className="small muted nowrap">
                      {p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)}
                    </div>
                  </td>
                  {g.days.map(d => {
                    const slot = d.slots.find(s => s.period.id === p.id);
                    return (
                      <td key={d.weekday}>
                        {p.isBreak ? (
                          <span className="muted small">Break</span>
                        ) : slot ? (
                          <div>
                            <div style={{ fontWeight: 550 }}>{slot.subject?.subjectName ?? "Lesson"}</div>
                            <div className="small muted">
                              {slot.section?.name}
                              {slot.room ? ` · ${slot.room}` : ""}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* Profile fields only; name and contact are edited on the account (AD-06) */
function EditTeacherDrawer({ teacher, open, onClose }: { teacher: Teacher; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const original = { ...employmentFrom(teacher), experienceYears: teacher.experienceYears?.toString() ?? "" };
  const form = useForm(original);
  const save = useApiMutation((body: Record<string, string | number>) => updateTeacher(teacher.id, body), { invalidate: ["/users"] });

  const close = () => {
    form.reset(original);
    onClose();
  };

  const submit = async () => {
    const { body, errors } = patchFrom(original, form.values, EMPLOYMENT_TEXT_KEYS);
    const exp = experienceError(form.values.experienceYears);
    if (exp) errors.experienceYears = exp;
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    if (!Object.keys(body).length) return close();
    try {
      const res = await save.mutateAsync({
        ...body,
        ...(body.experienceYears !== undefined && { experienceYears: Number(body.experienceYears) })
      });
      toast.success(res.message);
      onClose();
    } catch (e) {
      form.setServerErrors(e, Object.fromEntries([...EMPLOYMENT_KEYS, "experienceYears"].map(k => [k, k])));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Edit profile"
      subtitle={`${fullName(teacher.user)} · ${teacher.employeeCode}`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => void submit()}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <EmploymentFields form={form} />
        <div className="form-grid">
          <TextInput label="Experience (years)" type="number" min={0} max={60} step={1} {...form.text("experienceYears")} />
        </div>
      </form>
    </Drawer>
  );
}
