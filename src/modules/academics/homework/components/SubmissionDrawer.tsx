import { useEffect, useState } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { gradeSubmission, HOMEWORK_PATH, SUBMISSION_LABELS, type Submissions } from "../api/homework";

type Student = Submissions["students"][number];

const TONES = { NOT_SUBMITTED: "neutral", SUBMITTED: "info", LATE: "warning", GRADED: "success", RETURNED: "danger" } as const;

export function SubmissionBadge({ status }: { status: Student["status"] }) {
  return (
    <Badge tone={TONES[status]} dot>
      {SUBMISSION_LABELS[status]}
    </Badge>
  );
}

/* AC-16 review drawer: what the student handed in, then marks (up to maxMarks) and feedback,
   and Grade or Return for resubmission */
export function SubmissionDrawer({
  homeworkId,
  maxMarks,
  student,
  canGrade,
  onClose
}: {
  homeworkId: string;
  maxMarks: number | null;
  student: Student | null;
  canGrade: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState<{ marks?: string; form?: string }>({});
  const grade = useApiMutation(gradeSubmission, { invalidate: [HOMEWORK_PATH] });
  const s = student?.submission ?? null;

  useEffect(() => {
    setMarks(s?.marksAwarded === null || s?.marksAwarded === undefined ? "" : String(s.marksAwarded));
    setFeedback(s?.feedback ?? "");
    setErrors({});
  }, [s?.id, s?.marksAwarded, s?.feedback]);

  if (!student) return null;
  const name = [student.firstName, student.lastName].filter(Boolean).join(" ") || "Student";

  const send = (status: "GRADED" | "RETURNED") => {
    setErrors({});
    if (!s) return;
    const body: Parameters<typeof gradeSubmission>[0] = { id: homeworkId, submissionId: s.id, status };
    if (maxMarks !== null && marks !== "") {
      const n = Number(marks);
      if (!(n >= 0) || n > maxMarks) return setErrors({ marks: `From 0 to ${maxMarks}` });
      body.marksAwarded = n;
    }
    if (status === "GRADED" && maxMarks !== null && marks === "") return setErrors({ marks: "Give the marks, or return it for resubmission" });
    if (feedback.trim()) body.feedback = feedback.trim();
    if (status === "RETURNED" && !feedback.trim()) return setErrors({ form: "Say what to fix in the feedback before returning it." });
    grade.mutate(body, {
      onSuccess: res => {
        toast.success(`${res.message}: ${name}`);
        onClose();
      },
      onError: err => {
        if (isApiError(err) && /marksAwarded|not marked/i.test(err.message)) setErrors({ marks: err.message });
        else setErrors({ form: isApiError(err) ? err.message : "Something went wrong. Please try again." });
      }
    });
  };

  const busy = grade.isPending ? grade.variables?.status : null;
  return (
    <Drawer
      open
      onClose={onClose}
      title={name}
      subtitle={
        <span className="row" style={{ gap: 6 }}>
          {student.rollNumber && <span>Roll {student.rollNumber}</span>}
          <SubmissionBadge status={student.status} />
        </span>
      }
      footerStatus={errors.form}
      footer={
        canGrade &&
        s && (
          <>
            <Button onClick={() => send("RETURNED")} loading={busy === "RETURNED"} disabled={!!busy}>
              Return for resubmission
            </Button>
            <Button variant="primary" onClick={() => send("GRADED")} loading={busy === "GRADED"} disabled={!!busy}>
              {s.status === "GRADED" ? "Save grade" : "Grade"}
            </Button>
          </>
        )
      }
    >
      {!s ? (
        <p className="muted">Nothing handed in yet.</p>
      ) : (
        <div className="stack">
          <DescriptionList
            columns={2}
            items={[
              { label: "Handed in", value: `${formatDateTime(s.submittedAt)}${s.isLate ? " (late)" : ""}` },
              { label: "Graded", value: s.gradedAt ? formatDateTime(s.gradedAt) : null }
            ]}
          />
          <div>
            <div className="section-title" style={{ marginBottom: 6 }}>
              Answer
            </div>
            {s.content ? <p style={{ whiteSpace: "pre-wrap" }}>{s.content}</p> : <p className="muted">No text: the student attached a file.</p>}
            <p className="small muted">Files the student attached can't be opened here yet: the staff list of submissions doesn't include them.</p>
          </div>
          {canGrade ? (
            <>
              {maxMarks !== null && (
                <TextInput
                  label={`Marks (out of ${maxMarks})`}
                  type="number"
                  min={0}
                  max={maxMarks}
                  step="any"
                  value={marks}
                  onChange={e => setMarks(e.target.value)}
                  error={errors.marks}
                  hint="Optional when returning it"
                />
              )}
              <Textarea label="Feedback" rows={4} maxLength={2000} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="What went well, what to fix" error={undefined} />
            </>
          ) : (
            <DescriptionList
              columns={1}
              items={[
                { label: "Marks", value: s.marksAwarded !== null ? `${s.marksAwarded}${maxMarks !== null ? ` / ${maxMarks}` : ""}` : null, hidden: maxMarks === null },
                { label: "Feedback", value: s.feedback }
              ]}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
