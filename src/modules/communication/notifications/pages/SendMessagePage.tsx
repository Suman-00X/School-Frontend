import { useState, type FormEvent } from "react";
import { MessageSquare, UserPlus } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Card, Field, FormActions, MultiSelect, Page, Select, Switch, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { useStudentOptions } from "@/modules/users";
import { useSectionOptions } from "@/modules/academics";
import { useEmployees } from "@/modules/administration";
import { PageIntro } from "../../shared/components/PageIntro";
import { ChannelPicker } from "../../shared/components/ChannelPicker";
import type { Channel } from "../../shared/utils/channels";
import "../components/notifications.css";

const MAX_RECIPIENTS = 500;
const TITLE_MAX = 200;
const BODY_MAX = 2000;

type Values = { title: string; body: string };

const sendMessage = (body: { userIds: string[]; studentIds: string[]; includeParents: boolean; title: string; body: string; channels: Channel[] }) =>
  api.post<{ recipients: number }>("/communication/messages", body);

/* Every active student enrolled in a section (the roster), for "Add a whole section" */
async function sectionStudentIds(sectionId: string) {
  const ids: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await api.get<{ studentId: string; status: string }[]>("/academics/enrollments", { sectionId, page, limit: 100 });
    for (const e of res.data) if (e.status === "ACTIVE") ids.push(e.studentId);
    if (!res.meta || page >= res.meta.totalPages) break;
  }
  return ids;
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* CO-02 · Send message: a direct message to chosen students (and their parents) and staff.
   Messages are type MESSAGE and land in each person's inbox; email and SMS are extra. */
export default function SendMessagePage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const form = useForm<Values>({ title: "", body: "" });
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [includeParents, setIncludeParents] = useState(true);
  const [channels, setChannels] = useState<Channel[]>(["IN_APP"]);
  const [sectionId, setSectionId] = useState("");
  const [adding, setAdding] = useState(false);

  const students = useStudentOptions();
  const sections = useSectionOptions(can("academics.enrollments.read"));
  const employees = useEmployees();
  const send = useApiMutation(sendMessage);

  const picked = studentIds.length + userIds.length;
  const { values, errors } = form;

  const addSection = async () => {
    if (!sectionId) return;
    setAdding(true);
    try {
      const ids = await sectionStudentIds(sectionId);
      const next = [...new Set([...studentIds, ...ids])];
      const added = next.length - studentIds.length;
      if (next.length > MAX_RECIPIENTS) {
        toast.warning(`At most ${MAX_RECIPIENTS} students per message. For larger groups, use an announcement.`);
        return;
      }
      setStudentIds(next);
      form.setErrors(e => ({ ...e, recipients: "" }));
      setSectionId("");
      toast.success(added ? `${plural(added, "student")} added` : "Everyone in that section is already picked");
    } catch (e) {
      toast.error(e);
    } finally {
      setAdding(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.title.trim()) e.title = "Give the message a title";
    if (!values.body.trim()) e.body = "Write the message";
    if (!picked) e.recipients = "Pick at least one student or staff member";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const who = [
      studentIds.length && `${plural(studentIds.length, "student")}${includeParents ? " and their parents" : ""}`,
      userIds.length && plural(userIds.length, "staff member or teacher", "staff members and teachers")
    ]
      .filter(Boolean)
      .join(", ");
    const ok = await confirm({
      title: `Send “${values.title.trim()}”?`,
      message: `It goes to ${who}, in their inbox${channels.includes("EMAIL") ? ", by email" : ""}${channels.includes("SMS") ? " and by SMS" : ""}. A sent message can't be recalled.`,
      confirmLabel: "Send",
      tone: "primary"
    });
    if (!ok) return;
    send.mutate(
      { userIds, studentIds, includeParents, title: values.title.trim(), body: values.body.trim(), channels },
      {
        onSuccess: res => {
          toast.success(res.message);
          form.reset();
          setStudentIds([]);
          setUserIds([]);
          setChannels(["IN_APP"]);
          setIncludeParents(true);
        },
        onError: err => form.setServerErrors(err, { userIds: "recipients", studentIds: "recipients" })
      }
    );
  };

  const peopleHint = !employees.canList
    ? "You can't list staff or teachers, so pick students only."
    : !can("users.staff.read")
      ? "Teachers only: office staff aren't listed for your role."
      : `Up to ${MAX_RECIPIENTS} people`;

  return (
    <Page>
      <PageIntro>A direct message to chosen students, their parents and staff. For the whole school or a class, write an announcement.</PageIntro>
      <form onSubmit={e => void submit(e)} noValidate>
        <div className="message-layout">
          <div className="stack">
            <Card title="Recipients" subtitle={picked ? `${plural(studentIds.length, "student")} · ${plural(userIds.length, "staff member", "staff members")}` : "Nobody picked yet"}>
              <div className="stack">
                <MultiSelect
                  label="Students (and their parents)"
                  options={students.options}
                  value={studentIds}
                  onChange={next => {
                    setStudentIds(next);
                    form.setErrors(e => ({ ...e, recipients: "" }));
                  }}
                  searchable
                  max={MAX_RECIPIENTS}
                  noun="students"
                  disabled={!students.allowed}
                  placeholder={!students.allowed ? "You can't list students" : students.isLoading ? "Loading students…" : "Search by name or admission number"}
                  hint={`Up to ${MAX_RECIPIENTS} students`}
                  error={errors.recipients || undefined}
                />
                {sections.allowed && (
                  <Field label="Add a whole section" hint="Adds every student enrolled in it this year">
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Select
                          aria-label="Section"
                          value={sectionId}
                          options={sections.options}
                          placeholder={sections.isLoading ? "Loading sections…" : "Pick a section"}
                          onChange={e => setSectionId(e.target.value)}
                        />
                      </div>
                      <Button icon={<UserPlus />} loading={adding} disabled={!sectionId} onClick={() => void addSection()}>
                        Add
                      </Button>
                    </div>
                  </Field>
                )}
                <Field hint={includeParents ? "Each student's linked parents get it too." : "Only the students get it."}>
                  <Switch label="Also send to their parents" checked={includeParents} onChange={setIncludeParents} />
                </Field>
                <MultiSelect
                  label="Staff and teachers"
                  options={employees.people.map(p => ({ value: p.id, label: p.name, description: p.email }))}
                  value={userIds}
                  onChange={next => {
                    setUserIds(next);
                    form.setErrors(e => ({ ...e, recipients: "" }));
                  }}
                  searchable
                  max={MAX_RECIPIENTS}
                  noun="people"
                  disabled={!employees.canList}
                  placeholder={!employees.canList ? "Not available for your role" : employees.isLoading ? "Loading staff and teachers…" : "Search by name or email"}
                  hint={peopleHint}
                />
              </div>
            </Card>
            <Card title="Message">
              <div className="stack">
                <TextInput label="Title" required maxLength={TITLE_MAX} placeholder="e.g. Parent-teacher meeting on Saturday" {...form.text("title")} />
                <Textarea
                  label="Message"
                  required
                  rows={7}
                  maxLength={BODY_MAX}
                  hint={`${values.body.length} / ${BODY_MAX} characters`}
                  {...form.text("body")}
                />
                <ChannelPicker value={channels} onChange={setChannels} />
              </div>
            </Card>
            <FormActions error={form.formError}>
              <Button type="submit" variant="primary" loading={send.isPending} disabled={!picked}>
                {picked ? `Send to ${plural(picked, "recipient")}${studentIds.length && includeParents ? " + parents" : ""}` : "Send"}
              </Button>
            </FormActions>
          </div>
          <MessagePreview title={values.title} body={values.body} />
        </div>
      </form>
    </Page>
  );
}

/* As the inbox will show it: the row, then the full text when opened */
function MessagePreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="message-preview">
      <Card title="Preview" subtitle="How it looks in the inbox">
        <div className="stack">
          <ul className="notif-list" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <li className="notif-row is-unread">
              <div className="notif-main" style={{ cursor: "default" }}>
                <span className="notif-dot" />
                <span className="notif-icon" aria-hidden="true">
                  <MessageSquare />
                </span>
                <span className="notif-text">
                  <span className="notif-title">{title.trim() || "Message title"}</span>
                  <span className="notif-body">{body.trim().split("\n")[0] || "The first line of the message"}</span>
                  <span className="notif-meta">Message · just now</span>
                </span>
              </div>
            </li>
          </ul>
          <p className="notif-full-body" style={{ minHeight: 80, color: body.trim() ? undefined : "var(--text-3)" }}>
            {body.trim() || "The full message appears here when it is opened."}
          </p>
        </div>
      </Card>
    </div>
  );
}
