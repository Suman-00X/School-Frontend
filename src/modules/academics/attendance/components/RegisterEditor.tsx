import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Coffee, Lock } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Badge, Button, Card, EmptyState, ErrorState, FooterStatus, GridEditor, roleLabel, Select, SkeletonBlock, TextInput, useToast, type GridRow } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import {
  ATTENDANCE_INVALIDATE,
  recordAttendance,
  REGISTER_PATH,
  STATUS_CHOICES,
  useLockRules,
  type AttendanceStatus,
  type RecordInput,
  type RegisterDay,
  type RegisterKind
} from "../api/attendance";
import "./attendance.css";

type Mark = { status: AttendanceStatus | null; remarks: string };

const studentName = (s: { firstName?: string; lastName?: string }) => [s.firstName, s.lastName].filter(Boolean).join(" ") || "Student";

/* AC-09 one register: the section's students with one-tap statuses (keyboard: P A L H E),
   a remark each, "Mark all present", and Save. Locked registers are read-only, except for
   the policy's override roles, who must give a reason. Period registers carry the subject
   taught (the timetable's unless a substitute taught another). */
export function RegisterEditor({
  sectionId,
  date,
  kind,
  periodNumber = 0,
  title,
  canRecord,
  subjects,
  defaultSubjectId,
  onSaved
}: {
  sectionId: string;
  date: string;
  kind: RegisterKind;
  periodNumber?: number;
  title: string;
  /* The person may take this register (permission and teaching scope) */
  canRecord: boolean;
  /* Subject choices for a period register */
  subjects?: { id: string; subjectName: string }[];
  /* The subject timetabled then */
  defaultSubjectId?: string | null;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const { session } = useAuth();
  const lock = useLockRules();
  const query = { sectionId, date, kind, ...(kind === "PERIOD" && { periodNumber }) };
  const reg = useApiGet<RegisterDay>(REGISTER_PATH, query);
  const save = useApiMutation(recordAttendance, { invalidate: [...ATTENDANCE_INVALIDATE, "/academics/attendance/cover"] });
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [dirty, setDirty] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [note, setNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const data = reg.data;
  const registerId = `${sectionId}|${date}|${kind}|${periodNumber}`;

  /* Load the saved marks when a register opens, and on later loads unless there are unsaved changes */
  const loaded = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!data) return;
    if (loaded.current === registerId && dirtyRef.current) return;
    loaded.current = registerId;
    setMarks(Object.fromEntries(data.students.map(s => [s.studentId, { status: s.status, remarks: s.remarks ?? "" }])));
    setDirty(false);
    setRowErrors({});
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, registerId]);

  useEffect(() => {
    setSubjectId(defaultSubjectId ?? "");
    setNote("");
    setOverrideReason("");
  }, [registerId, defaultSubjectId]);

  const students = useMemo(() => data?.students ?? [], [data]);
  const sessionKind = kind === "FORENOON" || kind === "AFTERNOON";
  const locked = !!data?.locked;
  const editable = canRecord && !data?.free && (!locked || lock.canOverride);
  const marked = students.filter(s => marks[s.studentId]?.status).length;

  const set = (studentId: string, status: string | null) => {
    setMarks(m => ({ ...m, [studentId]: { status: status as AttendanceStatus | null, remarks: m[studentId]?.remarks ?? "" } }));
    setDirty(true);
    setRowErrors(e => (e[studentId] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== studentId)) : e));
  };
  const setRemark = (studentId: string, remarks: string) => {
    setMarks(m => ({ ...m, [studentId]: { status: m[studentId]?.status ?? null, remarks } }));
    setDirty(true);
  };
  const markRestPresent = () => {
    setMarks(m => Object.fromEntries(students.map(s => [s.studentId, { remarks: m[s.studentId]?.remarks ?? "", status: m[s.studentId]?.status ?? "PRESENT" }])));
    setDirty(true);
  };

  const submit = () => {
    setError(null);
    if (!marked) return setError("Mark at least one student.");
    if (locked && !overrideReason.trim()) return setError("This register is locked: give the reason for the change.");
    const body: RecordInput = {
      sectionId,
      date,
      kind,
      records: students
        .filter(s => marks[s.studentId]?.status)
        .map(s => ({ studentId: s.studentId, status: marks[s.studentId]!.status!, ...(marks[s.studentId]!.remarks.trim() && { remarks: marks[s.studentId]!.remarks.trim() }) }))
    };
    if (kind === "PERIOD") {
      body.periodNumber = periodNumber;
      /* Always sent when known: a retake keeps a substitute's own subject */
      if (subjectId) body.subjectId = subjectId;
      else if (!defaultSubjectId) return setError("Pick the subject taught.");
    }
    if (note.trim()) body.remarks = note.trim();
    if (locked) body.overrideReason = overrideReason.trim();
    save.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        if (res.data.summary.unmarked > 0) toast.warning(`${res.data.summary.unmarked} student(s) not marked in this register.`);
        setDirty(false);
        onSaved?.();
      },
      onError: err => {
        if (isApiError(err) && err.isValidation) {
          /* records.3.status → that student's row */
          const byRow: Record<string, string> = {};
          const rest: string[] = [];
          const sent = body.records;
          for (const d of err.details) {
            const m = /^records\.(\d+)\./.exec(d.field);
            const row = m ? sent[Number(m[1])] : undefined;
            if (row) byRow[row.studentId] ??= d.message;
            else rest.push(d.field ? `${d.field} ${d.message}` : d.message);
          }
          setRowErrors(byRow);
          setError(rest.join("; ") || "Some rows need a look.");
        } else setError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
      }
    });
  };

  if (reg.error) return <Card><ErrorState error={reg.error} onRetry={() => void reg.refetch()} /></Card>;

  const status = !data ? (
    " "
  ) : data.free ? (
    <span>Free period</span>
  ) : (
    <span className="row" style={{ gap: 6 }}>
      {data.taken ? (
        <span>
          Taken {formatDateTime(data.takenAt)}
          {data.takenBy && data.takenBy === session?.user.id ? " by you" : ""}
        </span>
      ) : (
        <span>Not taken yet</span>
      )}
      {data.substitute && <Badge tone="info">Substitute</Badge>}
      {locked && (
        <Badge tone="warning">
          <Lock size={12} /> Locked after {formatDate(data.editableUntil)}
        </Badge>
      )}
      {data.lockOverride && <Badge>Changed after lock: {data.lockOverride.reason}</Badge>}
    </span>
  );

  const rows: GridRow[] = students.map(s => ({
    id: s.studentId,
    label: studentName(s),
    sub: s.rollNumber ? `Roll ${s.rollNumber}` : "No roll number",
    error: rowErrors[s.studentId]
  }));

  return (
    <Card
      flush
      title={title}
      subtitle={status}
      actions={
        editable &&
        students.length > 0 && (
          <Button size="sm" icon={<CheckCheck />} onClick={markRestPresent} disabled={marked === students.length}>
            {marked ? "Mark the rest present" : "Mark all present"}
          </Button>
        )
      }
    >
      {!data ? (
        <div style={{ padding: 18 }}>
          <SkeletonBlock lines={6} />
        </div>
      ) : data.free ? (
        <EmptyState
          icon={<Coffee />}
          title="Free period"
          message={`${data.free.reason}. A free period has no register and counts in nobody's attendance.`}
          actions={<Link to="/academics/attendance/cover?tab=free" className="btn btn-sm">See free periods</Link>}
        />
      ) : students.length === 0 ? (
        <EmptyState title="No students in this section" message="Students appear here once they are enrolled." />
      ) : (
        <>
          <GridEditor
            aria-label={title}
            rows={rows}
            columns={[{ key: "status", label: "Status" }]}
            choices={STATUS_CHOICES}
            hiddenChoices={sessionKind ? ["HALF_DAY"] : []}
            value={rowId => marks[rowId]?.status ?? null}
            onChange={editable ? (rowId, _col, value) => set(rowId, value) : undefined}
            rowHeader="Student"
            /* The API only adds or changes marks, so a taken register's marks can't be cleared */
            allowClear={!data.taken}
            extraColumns={[
              {
                key: "remarks",
                header: "Remark",
                width: 220,
                render: row =>
                  editable ? (
                    <input
                      className="input input-sm reg-remark"
                      value={marks[row.id]?.remarks ?? ""}
                      maxLength={300}
                      placeholder="Optional"
                      aria-label="Remark"
                      onChange={e => setRemark(row.id, e.target.value)}
                    />
                  ) : (
                    <span className="small muted">{marks[row.id]?.remarks || "—"}</span>
                  )
              }
            ]}
          />
          {editable && (
            <div className="reg-footer">
              <div className="reg-fields">
                {kind === "PERIOD" && (
                  <Select
                    label="Subject taught"
                    className="select-sm"
                    value={subjectId}
                    onChange={e => setSubjectId(e.target.value)}
                    options={(subjects ?? []).map(s => ({ value: s.id, label: s.subjectName }))}
                    placeholder="Pick the subject"
                    required={!defaultSubjectId}
                    hint={defaultSubjectId ? "From the timetable; change it if another subject was taught" : "Nothing is timetabled then: pick the subject"}
                    error={undefined}
                  />
                )}
                <TextInput label="Note for this register" className="input-sm" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Optional" error={undefined} />
                {locked && (
                  <TextInput
                    label="Reason for change"
                    required
                    className="input-sm"
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    maxLength={500}
                    placeholder="Why a locked register is changed"
                    hint={`Locked after ${formatDate(data.editableUntil)}`}
                    error={undefined}
                  />
                )}
              </div>
              <div className="form-actions-bar">
                <FooterStatus>{error}</FooterStatus>
                <div className="row">
                  <span className="small muted nowrap">
                    {marked} of {students.length} marked
                  </span>
                  <Button variant="primary" loading={save.isPending} onClick={submit} disabled={!dirty && data.taken}>
                    {data.taken ? "Save changes" : "Save register"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {!editable && canRecord && locked && (
            <div className="reg-note small muted">
              <Lock size={13} /> Locked after {formatDate(data.editableUntil)}. Only {lock.policy?.overrideRoles.map(roleLabel).join(" or ") || "an administrator"} can change it now.
            </div>
          )}
        </>
      )}
    </Card>
  );
}
