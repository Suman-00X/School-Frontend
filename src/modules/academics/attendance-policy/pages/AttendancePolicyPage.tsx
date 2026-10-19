/* AC-08 · Attendance policy (Academics › Setup) */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Button, Card, Checkbox, ErrorState, Field, FormActions, Page, PageHeader, RadioGroup, Skeleton, TextInput, useConfirm, useToast } from "@/common/ui";
import { formatDate, relativeTime, todayIso } from "@/common/utils/format";
import {
  ATTENDANCE_POLICY_PATH,
  MODES,
  modeLabel,
  modeOn,
  updateAttendancePolicy,
  type AttendanceMode,
  type AttendancePolicy,
  type AttendancePolicyChanges
} from "../api/attendancePolicy";
import "../../shared/components/setup.css";

const tomorrowOf = (today: string) => {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const sentenceOf = (m: AttendanceMode) => MODES.find(x => x.value === m)?.sentence ?? "";

/* Settings form in two cards: the attendance mode (changed from a date on) and the lock rules.
   Only ADMIN edits; everyone else sees the same cards disabled. */
export default function AttendancePolicyPage() {
  const { can } = useAuth();
  const canEdit = can("academics.attendance.managePolicy");
  const policy = useApiGet<AttendancePolicy>(ATTENDANCE_POLICY_PATH);

  return (
    <Page>
      <PageHeader
        title="Attendance policy"
        subtitle={
          (canEdit ? "How registers are taken across the school and how long they stay editable" : "How registers are taken and how long they stay editable. Only an administrator can change this.") +
          (policy.data ? ` · updated ${relativeTime(policy.data.updatedAt)}` : "")
        }
      />
      {policy.error ? (
        <ErrorState error={policy.error} onRetry={() => void policy.refetch()} />
      ) : (
        <div className="policy-layout">
          <ModeCard policy={policy.data} canEdit={canEdit} />
          <RulesCard policy={policy.data} canEdit={canEdit} />
        </div>
      )}
    </Page>
  );
}

function ModeCard({ policy, canEdit }: { policy?: AttendancePolicy; canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const save = useApiMutation(updateAttendancePolicy, { invalidate: [ATTENDANCE_POLICY_PATH, "/academics/attendance"] });
  const tomorrow = tomorrowOf(todayIso());
  const [from, setFrom] = useState(tomorrow);
  const [picked, setPicked] = useState<AttendanceMode | "">("");
  const [error, setError] = useState<string | null>(null);

  /* What the chosen day would have without a change: the radio starts there */
  const before = policy ? modeOn(policy, from) : null;
  const mode = picked || before || "";
  const scheduled = useMemo(() => [...(policy?.scheduled ?? [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)), [policy]);
  const changed = !!policy && !!mode && mode !== before;

  const schedule = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!policy || !mode || !changed) return;
    if (!from || from < tomorrow) {
      setError(`A new mode can start tomorrow (${formatDate(tomorrow)}) at the earliest.`);
      return;
    }
    const later = scheduled.filter(s => s.effectiveFrom > from);
    const ok = await confirm({
      title: `Take attendance ${modeLabel(mode as AttendanceMode).toLowerCase()} from ${formatDate(from)}?`,
      message: `From ${formatDate(from)} every class ${sentenceOf(mode as AttendanceMode)}. Registers already taken keep their meaning.${
        later.length ? ` ${later.length === 1 ? "The change scheduled" : `The ${later.length} changes scheduled`} after that date ${later.length === 1 ? "is" : "are"} cancelled.` : ""
      }`,
      confirmLabel: "Schedule change",
      tone: "primary"
    });
    if (!ok) return;
    save.mutate(
      { mode: mode as AttendanceMode, modeEffectiveFrom: from },
      {
        onSuccess: res => {
          toast.success(res.message);
          setPicked("");
        },
        onError: err => setError(errorMessage(err))
      }
    );
  };

  /* Cancelling: choose, from that date, the mode in force the day before (later changes go too) */
  const cancel = async (index: number) => {
    const s = scheduled[index];
    const previous = index > 0 ? scheduled[index - 1].mode : policy!.mode;
    const later = scheduled.length - index - 1;
    const ok = await confirm({
      title: `Cancel the change on ${formatDate(s.effectiveFrom)}?`,
      message: `Attendance stays ${modeLabel(previous).toLowerCase()} after ${formatDate(s.effectiveFrom)}.${later ? ` ${later === 1 ? "The change after it is" : `The ${later} changes after it are`} cancelled too.` : ""}`,
      confirmLabel: "Cancel change"
    });
    if (ok)
      save.mutate(
        { mode: previous, modeEffectiveFrom: s.effectiveFrom },
        { onSuccess: () => toast.success(`The change on ${formatDate(s.effectiveFrom)} is cancelled`), onError: err => toast.error(err) }
      );
  };

  return (
    <Card title="Mode" subtitle={policy ? `Today: ${modeLabel(policy.mode).toLowerCase()}. The same for every class.` : <Skeleton width={220} height={12} />}>
      <form className="stack" onSubmit={e => void schedule(e)} noValidate>
        <RadioGroup
          aria-label="Attendance mode"
          options={MODES.map(m => ({ value: m.value, label: m.label, description: m.description }))}
          value={mode}
          disabled={!canEdit || !policy || save.isPending}
          onChange={setPicked}
        />
        {canEdit && (
          <>
            <TextInput
              label="Starts on"
              type="date"
              min={tomorrow}
              value={from}
              hint="Tomorrow at the earliest, so registers already taken never change meaning"
              fieldClassName="policy-date"
              onChange={e => {
                setFrom(e.target.value);
                setPicked("");
              }}
            />
            <FormActions error={error}>
              <Button type="submit" variant="primary" icon={<CalendarClock />} loading={save.isPending} disabled={!changed}>
                Schedule change
              </Button>
            </FormActions>
          </>
        )}
        <div className="policy-scheduled">
          <div className="section-title">Scheduled changes</div>
          {!policy ? (
            <Skeleton width="60%" />
          ) : scheduled.length ? (
            <ul className="policy-changes">
              {scheduled.map((s, i) => (
                <li key={s.effectiveFrom}>
                  <span>
                    From <strong>{formatDate(s.effectiveFrom)}</strong>: {modeLabel(s.mode).toLowerCase()}
                  </span>
                  {canEdit && (
                    <Button size="sm" variant="link" onClick={() => void cancel(i)} disabled={save.isPending}>
                      Cancel
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              None. Attendance stays {modeLabel(policy.mode).toLowerCase()}.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

type Rules = { editWindowDays: string; principalOverrides: boolean; periodPresenceThreshold: string };

const rulesOf = (p?: AttendancePolicy): Rules => ({
  editWindowDays: p ? String(p.editWindowDays) : "",
  principalOverrides: !!p?.overrideRoles.includes("PRINCIPAL"),
  periodPresenceThreshold: p ? String(p.periodPresenceThreshold) : ""
});

function RulesCard({ policy, canEdit }: { policy?: AttendancePolicy; canEdit: boolean }) {
  const toast = useToast();
  const save = useApiMutation(updateAttendancePolicy, { invalidate: [ATTENDANCE_POLICY_PATH] });
  const [values, setValues] = useState<Rules>(() => rulesOf(policy));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const original = rulesOf(policy);

  /* New data (a save, a refetch): adopt it unless there are unsaved edits */
  const key = policy ? `${policy.id}:${policy.updatedAt}` : "";
  const [seen, setSeen] = useState(key);
  useEffect(() => {
    if (key !== seen) {
      setValues(rulesOf(policy));
      setSeen(key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const periodWise = !!policy && (policy.mode === "PERIOD_WISE" || policy.scheduled.some(s => s.mode === "PERIOD_WISE"));
  const disabled = !canEdit || !policy || save.isPending;

  const changes: AttendancePolicyChanges = {};
  if (policy) {
    if (values.editWindowDays !== original.editWindowDays) changes.editWindowDays = Number(values.editWindowDays);
    if (values.principalOverrides !== original.principalOverrides) changes.overrideRoles = values.principalOverrides ? ["ADMIN", "PRINCIPAL"] : ["ADMIN"];
    if (values.periodPresenceThreshold !== original.periodPresenceThreshold) changes.periodPresenceThreshold = Number(values.periodPresenceThreshold);
  }
  const dirty = Object.keys(changes).length > 0;

  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => {
    setValues(x => ({ ...x, [k]: v }));
    setErrors(({ [k]: _drop, ...rest }) => rest);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const days = Number(values.editWindowDays);
    if (values.editWindowDays.trim() === "" || !Number.isInteger(days) || days < 0 || days > 365) errs.editWindowDays = "A whole number of days from 0 to 365";
    const pct = Number(values.periodPresenceThreshold);
    if (values.periodPresenceThreshold.trim() === "" || !Number.isInteger(pct) || pct < 1 || pct > 100) errs.periodPresenceThreshold = "A whole number from 1 to 100";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setFormError(null);
    save.mutate(changes, {
      onSuccess: res => toast.success(res.message),
      onError: err => {
        if (isApiError(err) && err.isValidation) setErrors(err.fieldErrors());
        setFormError(errorMessage(err));
      }
    });
  };

  const days = Number(values.editWindowDays);
  const windowHint =
    values.editWindowDays.trim() !== "" && Number.isInteger(days) && days >= 0
      ? days === 0
        ? "Registers lock at the end of their day"
        : `A register can be changed until ${days} day${days === 1 ? "" : "s"} after its date, then it locks`
      : "Registers lock this many days after their date";

  return (
    <Card title="Rules" subtitle="When registers lock and who can still change them">
      <form className="stack" onSubmit={submit} noValidate>
        <TextInput
          label="Days a register stays editable"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          value={values.editWindowDays}
          disabled={disabled}
          hint={windowHint}
          error={errors.editWindowDays}
          onChange={e => set("editWindowDays", e.target.value)}
        />
        <Field label="Who can change a locked register" hint="They give a reason, which is kept with the register">
          <div className="row" style={{ gap: 18 }}>
            <Checkbox label="Administrator" checked disabled />
            <Checkbox label="Principal" checked={values.principalOverrides} disabled={disabled} onChange={e => set("principalOverrides", e.target.checked)} />
          </div>
        </Field>
        <TextInput
          label="Present for the day at"
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={values.periodPresenceThreshold}
          disabled={disabled}
          hint={periodWise ? "% of the day's periods a student must attend" : "Used only when attendance is taken by period (% of the day's periods)"}
          error={errors.periodPresenceThreshold}
          onChange={e => set("periodPresenceThreshold", e.target.value)}
        />
        {canEdit && (
          <FormActions error={formError}>
            <Button type="button" disabled={!dirty || save.isPending} onClick={() => setValues(original)}>
              Discard
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
              Save rules
            </Button>
          </FormActions>
        )}
      </form>
    </Card>
  );
}
