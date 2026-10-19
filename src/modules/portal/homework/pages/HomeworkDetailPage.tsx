import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Send } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation, useForm } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  Card,
  DescriptionList,
  ErrorState,
  FileDrop,
  FormActions,
  Page,
  SkeletonBlock,
  Textarea,
  useToast
} from "@/common/ui";
import { formatBytes, formatDate, formatDateTime, todayIso } from "@/common/utils/format";
import { useMyStudents, studentFullName } from "../../shared/api/students";
import { NotLinked, PortalError } from "../../shared/components/PortalError";
import "../../shared/portal.css";
import {
  HOMEWORK_STATUS_LABELS,
  HOMEWORK_STATUS_TONES,
  SUBMISSION_ACCEPT,
  SUBMISSION_MAX_BYTES,
  homeworkFileLink,
  homeworkListPath,
  homeworkPath,
  submitHomework,
  type Homework,
  type StoredFile
} from "../api/homework";

/* PO-04 · Homework detail: the task and its files, then the submission panel. Students submit
   (text and/or one file) and resubmit until it is graded; parents see the same panel read-only. */
export default function HomeworkDetailPage() {
  const { studentId = "", homeworkId = "" } = useParams();
  const students = useMyStudents();
  const student = students.data?.find(s => s.id === studentId);
  const hw = useApiGet<Homework>(student ? homeworkPath(studentId, homeworkId) : null);
  const h = hw.data;

  const header = (
    <DrillHeader
      back={homeworkListPath(studentId)}
      backLabel="Back to homework"
      title={
        <span style={{ display: "inline-block", width: "min(360px, 50vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
          {h?.title ?? "Homework"}
        </span>
      }
    />
  );

  if (students.error || (students.data && !student) || hw.error)
    return (
      <Page>
        {header}
        {students.error ? (
          <ErrorState error={students.error} onRetry={() => void students.refetch()} />
        ) : !student ? (
          <NotLinked />
        ) : (
          <PortalError error={hw.error} onRetry={() => void hw.refetch()} />
        )}
      </Page>
    );

  return (
    <Page>
      {header}
      {!h || !student ? (
        <Card>
          <SkeletonBlock lines={6} />
        </Card>
      ) : (
        <>
          <Card
            title={h.title}
            subtitle={[h.subject?.subjectName, studentFullName(student)].filter(Boolean).join(" · ")}
            actions={
              <Badge tone={HOMEWORK_STATUS_TONES[h.myStatus]} dot>
                {HOMEWORK_STATUS_LABELS[h.myStatus]}
              </Badge>
            }
          >
            <div className="stack">
              <DescriptionList
                columns={3}
                items={[
                  { label: "Set on", value: formatDate(h.assignedOn) },
                  { label: "Due", value: <span className={h.dueDate < todayIso() && (h.myStatus === "NOT_SUBMITTED" || h.myStatus === "RETURNED") ? "po-danger" : undefined}>{formatDate(h.dueDate)}</span> },
                  { label: "Marks", value: h.maxMarks ? `Out of ${h.maxMarks}` : "Not marked" },
                  { label: "Late work", value: h.allowLateSubmission ? "Accepted (marked late)" : "Not accepted" }
                ]}
              />
              {h.description && <p style={{ whiteSpace: "pre-wrap" }}>{h.description}</p>}
              {!!h.attachments?.length && <FileList files={h.attachments} studentId={studentId} homeworkId={h.id} title="Files from the teacher" />}
            </div>
          </Card>
          <SubmissionPanel homework={h} studentId={studentId} />
        </>
      )}
    </Page>
  );
}

function FileList({ files, studentId, homeworkId, title }: { files: StoredFile[]; studentId: string; homeworkId: string; title: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (f: StoredFile) => {
    setBusy(f.id);
    /* Opened before the await so popup blockers treat it as the click's window */
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const res = await homeworkFileLink(studentId, homeworkId, f.id);
      if (tab) tab.location.href = res.data.url;
      else window.open(res.data.url, "_blank", "noopener");
    } catch (e) {
      tab?.close();
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="stack-sm">
      <div className="section-title">{title}</div>
      <ul className="po-lines">
        {files.map(f => (
          <li key={f.id}>
            <span className="row" style={{ minWidth: 0, flexWrap: "nowrap" }}>
              <Paperclip size={15} className="muted" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.fileName}>
                {f.fileName}
              </span>
              <span className="small muted nowrap">{formatBytes(f.size)}</span>
            </span>
            <Button size="sm" loading={busy === f.id} onClick={() => void open(f)}>
              Open
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubmissionPanel({ homework: h, studentId }: { homework: Homework; studentId: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const form = useForm({ content: "" });
  const [file, setFile] = useState<File | null>(null);
  const sub = h.mySubmission;
  const canSubmit = can("portal.homework.submit");
  const graded = h.myStatus === "GRADED";
  const pastDue = todayIso() > h.dueDate;
  const blocked = pastDue && !h.allowLateSubmission;

  const submit = useApiMutation(submitHomework, { invalidate: [homeworkListPath(studentId)] });

  const send = () => {
    form.setFormError(null);
    if (!form.values.content.trim() && !file) return form.setFormError("Send some text or attach a file.");
    submit.mutate(
      { homeworkId: h.id, content: form.values.content, file },
      {
        onSuccess: res => {
          toast.success(res.message);
          form.reset();
          setFile(null);
        },
        onError: e => {
          form.setServerErrors(e);
          /* Graded meanwhile: show the marks */
          if (isApiError(e) && e.status === 409) void qc.invalidateQueries({ queryKey: [homeworkPath(studentId, h.id)] });
        }
      }
    );
  };

  return (
    <Card
      title={graded ? "Marks and feedback" : sub ? "Your submission" : "Submit your work"}
      subtitle={sub ? `Sent ${formatDateTime(sub.submittedAt)}${sub.isLate ? " · late" : ""}` : canSubmit ? undefined : "Only the student can submit"}
    >
      <div className="stack">
        {graded && sub && (
          <DescriptionList
            columns={2}
            items={[
              { label: "Marks", value: sub.marksAwarded !== null ? `${sub.marksAwarded}${h.maxMarks ? ` / ${h.maxMarks}` : ""}` : "—" },
              { label: "Graded", value: formatDateTime(sub.gradedAt) },
              { label: "Feedback", value: sub.feedback, wide: true }
            ]}
          />
        )}
        {h.myStatus === "RETURNED" && (
          <div className="stack-sm">
            <div className="row">
              <Badge tone="warning" dot>
                Returned
              </Badge>
              <span className="small muted">The teacher asked for changes. Please submit again.</span>
            </div>
            {sub?.feedback && <p style={{ whiteSpace: "pre-wrap" }}>{sub.feedback}</p>}
          </div>
        )}
        {sub?.content && (
          <div className="stack-sm">
            <div className="section-title">What was sent</div>
            <p style={{ whiteSpace: "pre-wrap" }}>{sub.content}</p>
          </div>
        )}
        {!!sub?.attachments?.length && <FileList files={sub.attachments} studentId={studentId} homeworkId={h.id} title="Files sent" />}
        {!sub && !canSubmit && <p className="muted">Nothing submitted yet.</p>}

        {canSubmit && !graded && (
          <>
            <Textarea
              label={sub ? "New answer" : "Answer"}
              rows={5}
              maxLength={10_000}
              placeholder="Type your answer, or attach a file below"
              hint={form.values.content.length > 9_000 ? `${10_000 - form.values.content.length} characters left` : "Optional when you attach a file"}
              disabled={blocked}
              {...form.text("content")}
            />
            {/* Kept mounted while blocked, so the panel keeps its height */}
            <div style={blocked ? { pointerEvents: "none", opacity: 0.55 } : undefined} aria-disabled={blocked || undefined}>
              <FileDrop
                accept={SUBMISSION_ACCEPT}
                maxBytes={SUBMISSION_MAX_BYTES}
                file={file}
                onFile={setFile}
                onReject={m => form.setFormError(m)}
                hint="PDF, Word, Excel, PowerPoint, text or an image, up to 10 MB"
              />
            </div>
            <FormActions error={form.formError ?? (blocked ? "The due date has passed." : pastDue ? <span className="po-warning">This will be marked late.</span> : null)}>
              <Button variant="primary" icon={<Send />} loading={submit.isPending} disabled={blocked} onClick={send}>
                {sub ? "Resubmit" : "Submit"}
              </Button>
            </FormActions>
          </>
        )}
      </div>
    </Card>
  );
}
