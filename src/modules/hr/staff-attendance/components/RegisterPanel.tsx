import { useMemo, useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight, UserCheck } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation, useListParams } from "@/common/hooks";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormActions,
  GridEditor,
  SearchInput,
  SkeletonBlock,
  StatTile,
  StatTiles,
  Switch,
  TextInput,
  useConfirm,
  useToast,
  type GridChoice,
  type GridRow
} from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { matchesSearch } from "@/modules/users/shared";
import {
  addDays,
  ATTENDANCE_LABELS,
  ATTENDANCE_SHORT,
  ATTENDANCE_STATUSES,
  CLOSURE_LABELS,
  clock,
  TIMED_STATUSES,
  type AttendanceStatus
} from "../../shared/utils/format";
import { recordAttendance, STAFF_ATTENDANCE_PATH, type MarkInput, type Register, type RegisterRow } from "../api/staffAttendance";
import "../../shared/hr.css";

const TONES: Record<AttendanceStatus, GridChoice["tone"]> = { PRESENT: "success", ABSENT: "danger", HALF_DAY: "warning", LEAVE: "info", ON_DUTY: "primary" };

const CHOICES: GridChoice[] = ATTENDANCE_STATUSES.map(s => ({
  value: s,
  label: ATTENDANCE_LABELS[s],
  short: ATTENDANCE_SHORT[s].label,
  key: ATTENDANCE_SHORT[s].key,
  tone: TONES[s]
}));

type Mark = { status: AttendanceStatus | null; checkIn: string; checkOut: string; remarks: string };

const markOf = (r: RegisterRow): Mark => ({ status: r.status, checkIn: clock(r.checkIn), checkOut: clock(r.checkOut), remarks: r.remarks ?? "" });

const same = (a: Mark, b: Mark) => a.status === b.status && a.checkIn === b.checkIn && a.checkOut === b.checkOut && a.remarks.trim() === b.remarks.trim();

const COL = "STATUS";

type Session = { key: string; edits: Record<string, Mark>; rowErrors: Record<string, string>; formError: string | null; overridden: string[] };
const freshSession = (key: string): Session => ({ key, edits: {}, rowErrors: {}, formError: null, overridden: [] });

const FIELD_NAMES: Record<string, string> = { status: "Status", checkIn: "Check-in", checkOut: "Check-out", remarks: "Remarks" };

/* HR-03 Daily register: every active employee for one day; mark, then save the changed rows */
export function RegisterPanel() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const today = todayIso();
  const { params, setParam } = useListParams({ date: today });
  const date = params.date > today ? today : params.date;
  const register = useApiGet<Register>(`${STAFF_ATTENDANCE_PATH}/register`, { date });
  const save = useApiMutation(recordAttendance, { invalidate: [STAFF_ATTENDANCE_PATH] });

  const [search, setSearch] = useState("");
  const [unmarkedOnly, setUnmarkedOnly] = useState(false);

  const data = register.data;
  const rows = useMemo(() => data?.employees ?? [], [data]);
  const original = useMemo(() => Object.fromEntries(rows.map(r => [r.userId, markOf(r)])), [rows]);

  /* The editing session belongs to one load of one day: a new day, or fresh data after saving,
     starts a clean one (no effect needed: a session for another load is simply ignored) */
  const dataKey = `${date}:${register.dataUpdatedAt}`;
  const [stored, setStored] = useState<Session>(() => freshSession(dataKey));
  const session = stored.key === dataKey ? stored : freshSession(dataKey);
  const patch = (fn: (s: Session) => Partial<Session>) =>
    setStored(prev => {
      const base = prev.key === dataKey ? prev : freshSession(dataKey);
      return { ...base, ...fn(base) };
    });
  const { rowErrors, formError } = session;
  const draft = useMemo<Record<string, Mark>>(() => ({ ...original, ...session.edits }), [original, session.edits]);
  const setFormError = (formError: string | null) => patch(() => ({ formError }));
  const setRowErrors = (rowErrors: Record<string, string>) => patch(() => ({ rowErrors }));

  const closed = !!data?.closure;
  const editable = can("hr.staffAttendance.record") && !closed && !!data;
  const changed = rows.filter(r => draft[r.userId] && !same(draft[r.userId]!, original[r.userId]!));
  const dirty = changed.length > 0;

  const changeDate = async (next: string) => {
    if (!next || next === date) return;
    if (dirty && !(await confirm({ title: "Discard unsaved marks?", message: `${changed.length} change${changed.length === 1 ? "" : "s"} on ${formatDate(date)} will be lost.`, confirmLabel: "Discard" })))
      return;
    setParam("date", next > today ? today : next);
  };

  const update = (userId: string, change: Partial<Mark>) =>
    patch(s => {
      const rowErrors = { ...s.rowErrors };
      delete rowErrors[userId];
      return { edits: { ...s.edits, [userId]: { ...(s.edits[userId] ?? original[userId]!), ...change } }, rowErrors };
    });

  const setStatus = async (userId: string, status: string | null) => {
    const row = rows.find(r => r.userId === userId);
    if (!row) return;
    /* Clearing goes back to the saved mark (a mark can't be removed, only changed) */
    if (status === null) return update(userId, original[userId]!);
    if (row.leaveRequestId && status !== row.status && !session.overridden.includes(userId)) {
      const ok = await confirm({
        title: `Replace ${row.name}'s leave mark?`,
        message: `This day was marked by an approved leave request (${row.remarks ?? "leave"}). Marking it by hand replaces that mark; the request itself stays approved.`,
        confirmLabel: "Replace mark",
        tone: "primary"
      });
      if (!ok) return;
      patch(s => ({ overridden: [...s.overridden, userId] }));
    }
    const timed = TIMED_STATUSES.includes(status as AttendanceStatus);
    update(userId, { status: status as AttendanceStatus, ...(timed ? {} : { checkIn: "", checkOut: "" }) });
  };

  const markAllPresent = () =>
    patch(s => {
      const edits = { ...s.edits };
      for (const r of rows) {
        const m = edits[r.userId] ?? original[r.userId]!;
        if (!m.status) edits[r.userId] = { ...m, status: "PRESENT" };
      }
      return { edits };
    });

  const discard = () => setStored(freshSession(dataKey));

  const validate = () => {
    const errors: Record<string, string> = {};
    for (const r of changed) {
      const m = draft[r.userId]!;
      if (!m.status) errors[r.userId] = "Pick a status";
      else if (m.checkIn && m.checkOut && m.checkOut < m.checkIn) errors[r.userId] = "Check-out is before check-in";
    }
    setRowErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = () => {
    setFormError(null);
    if (!validate()) return setFormError("Fix the rows marked in red.");
    const records: MarkInput[] = changed.map(r => {
      const m = draft[r.userId]!;
      const out: MarkInput = { userId: r.userId, status: m.status! };
      if (m.checkIn) out.checkIn = m.checkIn;
      if (m.checkOut) out.checkOut = m.checkOut;
      if (m.remarks.trim()) out.remarks = m.remarks.trim();
      return out;
    });
    save.mutate(
      { date, records },
      {
        onSuccess: res => toast.success(res.message),
        onError: err => {
          /* records.3.checkOut -> the fourth row sent */
          if (isApiError(err) && err.isValidation) {
            const errors: Record<string, string> = {};
            for (const d of err.details) {
              const m = /^records\.(\d+)\.?(\w*)/.exec(d.field);
              const sent = m ? records[Number(m[1])] : undefined;
              if (sent) errors[sent.userId] ??= `${FIELD_NAMES[m![2]] ?? ""} ${d.message}`.trim();
            }
            setRowErrors(errors);
            setFormError(Object.keys(errors).length ? "Fix the rows marked in red." : err.message);
          } else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  /* Counts as they will be after saving */
  const counts = useMemo(() => {
    const c = Object.fromEntries(ATTENDANCE_STATUSES.map(s => [s, 0])) as Record<AttendanceStatus, number>;
    for (const r of rows) {
      const s = draft[r.userId]?.status;
      if (s) c[s]++;
    }
    return c;
  }, [rows, draft]);
  const marked = Object.values(counts).reduce((a, b) => a + b, 0);

  const visible = rows.filter(r => (!unmarkedOnly || !r.status) && (!search.trim() || matchesSearch(search, r.name, r.employeeCode, r.designation, r.department)));

  const gridRows: GridRow[] = visible.map(r => ({
    id: r.userId,
    label: (
      <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        {r.name}
        {r.leaveRequestId && <Badge tone="info">From leave</Badge>}
      </span>
    ),
    sub: [r.employeeCode, r.designation, r.department].filter(Boolean).join(" · "),
    error: rowErrors[r.userId]
  }));

  const timeInput = (row: GridRow, key: "checkIn" | "checkOut") => {
    const m = draft[row.id];
    const timed = !!m?.status && TIMED_STATUSES.includes(m.status);
    return (
      <TextInput
        type="time"
        className="hr-time"
        aria-label={`${key === "checkIn" ? "Check-in" : "Check-out"} for ${rows.find(r => r.userId === row.id)?.name ?? ""}`}
        value={m?.[key] ?? ""}
        disabled={!editable || !timed}
        onChange={e => update(row.id, { [key]: e.target.value })}
      />
    );
  };

  const statusLine = !data ? (
    " "
  ) : closed ? (
    <span style={{ color: "var(--warning-text)" }}>
      {CLOSURE_LABELS[data.closure!] ?? "School closed"}: attendance can't be recorded on this day.
    </span>
  ) : (
    `${formatDate(date)} · saved: ${data.summary.marked} of ${data.summary.employees} marked${!can("hr.staffAttendance.record") ? " · view only" : ""}`
  );

  return (
    <div className="stack">
      <StatTiles>
        <StatTile label="Employees" value={rows.length} hint="Active staff and teachers" loading={register.isLoading} />
        <StatTile label="Marked" value={marked} hint={`${rows.length - marked} unmarked`} meter={rows.length ? (marked / rows.length) * 100 : 0} loading={register.isLoading} />
        <StatTile label="Present" value={counts.PRESENT + counts.ON_DUTY} hint={`${counts.ON_DUTY} on duty`} loading={register.isLoading} />
        <StatTile label="Absent" value={counts.ABSENT} hint={`${counts.HALF_DAY} half day`} hintTone={counts.ABSENT ? "bad" : undefined} loading={register.isLoading} />
        <StatTile label="On leave" value={counts.LEAVE} hint="Approved leave or marked by hand" loading={register.isLoading} />
      </StatTiles>

      <Card flush>
        <div className="hr-toolbar">
          <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <Button size="sm" variant="ghost" icon={<ChevronLeft />} aria-label="Previous day" onClick={() => void changeDate(addDays(date, -1))} />
            <TextInput type="date" className="input-sm" aria-label="Date" value={date} max={today} onChange={e => void changeDate(e.target.value)} />
            <Button size="sm" variant="ghost" icon={<ChevronRight />} aria-label="Next day" disabled={date >= today} onClick={() => void changeDate(addDays(date, 1))} />
          </div>
          <SearchInput placeholder="Search name or code" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search employees" />
          <Switch label="Unmarked only" checked={unmarkedOnly} onChange={setUnmarkedOnly} />
          <div style={{ marginLeft: "auto" }}>
            {can("hr.staffAttendance.record") && (
              <Button size="sm" icon={<UserCheck />} disabled={!editable || marked === rows.length} onClick={markAllPresent}>
                Mark all unmarked as present
              </Button>
            )}
          </div>
        </div>
        <div className="hr-toolbar small muted hr-status-line" style={{ paddingTop: 6, paddingBottom: 6 }}>
          {statusLine}
        </div>
        {register.error ? (
          <ErrorState error={register.error} onRetry={() => void register.refetch()} />
        ) : !data ? (
          <div style={{ padding: 16 }}>
            <SkeletonBlock lines={8} />
          </div>
        ) : !rows.length ? (
          <div className="table-empty">
            <EmptyState icon={<CalendarX2 />} title="No active employees" message="Staff and teachers with active accounts appear here." />
          </div>
        ) : !visible.length ? (
          <div className="table-empty">
            <EmptyState icon={<CalendarX2 />} title={unmarkedOnly && !search.trim() ? "Everyone was marked" : "Nobody matches"} />
          </div>
        ) : (
          <div className="hr-register">
            <GridEditor
              aria-label={`Staff attendance for ${formatDate(date)}`}
              rows={gridRows}
              columns={[{ key: COL, label: "Status" }]}
              choices={CHOICES}
              value={id => draft[id]?.status ?? null}
              onChange={editable ? (id, _col, v) => void setStatus(id, v) : undefined}
              readOnly={!editable}
              allowClear
              rowHeader="Employee"
              extraColumns={[
                { key: "in", header: "Check-in", render: r => timeInput(r, "checkIn") },
                { key: "out", header: "Check-out", render: r => timeInput(r, "checkOut") },
                {
                  key: "remarks",
                  header: "Remarks",
                  render: r => (
                    <TextInput
                      className="hr-remarks"
                      aria-label="Remarks"
                      maxLength={300}
                      value={draft[r.id]?.remarks ?? ""}
                      disabled={!editable}
                      onChange={e => update(r.id, { remarks: e.target.value })}
                    />
                  )
                }
              ]}
            />
          </div>
        )}
        {editable && (
          <div style={{ padding: "0 14px" }}>
            <FormActions error={formError}>
              <span className="small muted">{dirty ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes"}</span>
              <Button disabled={!dirty || save.isPending} onClick={discard}>
                Discard
              </Button>
              <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={submit}>
                Save register
              </Button>
            </FormActions>
          </div>
        )}
      </Card>
    </div>
  );
}
