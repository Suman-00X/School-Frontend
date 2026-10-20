import { useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, X } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Alert, Badge, Button, Dialog, EmptyState, ErrorState, SkeletonBlock, useToast, type Tone } from "@/common/ui";
import {
  SUBSTITUTIONS_INVALIDATE,
  SUBSTITUTIONS_PATH,
  cancelCover,
  type AbsentTeacher,
  type CoverItem,
  type CoverStatus,
  type DayPlan,
  type Duty
} from "../api/substitutions";
import { dayName, hhmm, longDate, shiftDate } from "../utils/dates";
import { CoverEditor } from "./CoverEditor";
import "./substitutions.css";


const STATUS: Record<CoverStatus, { label: string; tone: Tone }> = {
  NEEDED: { label: "Needs cover", tone: "warning" },
  SUBSTITUTE: { label: "Substitute", tone: "success" },
  ACTIVITY: { label: "Activity", tone: "info" },
  LEISURE: { label: "Leisure", tone: "neutral" },
  NOT_NEEDED: { label: "Teacher takes it", tone: "neutral" }
};

const CLOSURES: Record<string, string> = {
  WEEKLY_OFF: "a weekly off day",
  HOLIDAY: "a holiday",
  VACATION: "a vacation day",
  OUTSIDE_ACADEMIC_YEAR: "outside the current academic year"
};

/* "On leave", "Absent", "Half day · in at 10:00" */
const absenceLabel = (a: AbsentTeacher) => {
  if (a.status === "LEAVE") return "On leave";
  if (a.status === "ABSENT") return "Absent";
  const times = [a.checkIn && `in at ${hhmm(a.checkIn)}`, a.checkOut && `out at ${hhmm(a.checkOut)}`].filter(Boolean);
  return `Half day · ${times.length ? times.join(", ") : "which half isn't recorded"}`;
};

/* What happens in the period, in words */
const coverText = (item: CoverItem) => {
  const plan = item.plan;
  if (!plan) return item.ended ? "The period ended without cover: it was a leisure period" : "Not planned yet: a leisure period unless someone covers it";
  if (plan.kind === "SUBSTITUTE") return `${plan.substitute?.name}${plan.subject ? ` · teaches ${plan.subject.subjectName}` : ""}`;
  if (plan.kind === "ACTIVITY") return `${plan.activity} · ${plan.substitute ? `in charge: ${plan.substitute.name}` : "no teacher in charge"}`;
  if (plan.kind === "LEISURE") return "Left as a leisure period";
  return `${item.absentTeacher.name} takes it`;
};

const message = (e: unknown) => (isApiError(e) ? e.message : "Something went wrong. Please try again.");

function CoverRow({ item, date, halfDay, canEdit }: { item: CoverItem; date: string; halfDay: boolean; canEdit: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const cancel = useApiMutation(cancelCover, { invalidate: SUBSTITUTIONS_INVALIDATE });
  const status = STATUS[item.status];
  return (
    <div className={`cover-row-wrap${item.status === "NEEDED" ? " is-needed" : ""}`}>
      <div className="cover-row">
        <div className="cover-when">
          <strong>{item.period.name}</strong>
          <span className="small muted">
            {hhmm(item.period.startTime)}–{hhmm(item.period.endTime)}
          </span>
        </div>
        <div className="cover-lesson">
          <span>{item.section.name}</span>
          <span className="small muted">
            {item.subject.subjectName}
            {item.room ? ` · Room ${item.room}` : ""}
          </span>
        </div>
        <div className="cover-plan">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          <span className="cover-plan-text" title={coverText(item)}>
            {coverText(item)}
            {item.plan?.note && <span className="muted"> · {item.plan.note}</span>}
          </span>
        </div>
        <div className="cover-actions">
          {canEdit && !editing && (
            <>
              {item.plan && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X />}
                  aria-label="Clear the plan"
                  title="Clear the plan: the period needs cover again"
                  loading={cancel.isPending}
                  onClick={() =>
                    cancel.mutate(item.plan!.id, {
                      onSuccess: res => toast.success(res.message),
                      onError: e => toast.error(message(e))
                    })
                  }
                />
              )}
              <Button size="sm" variant={item.plan ? "default" : "primary"} onClick={() => setEditing(true)}>
                {item.plan ? "Change" : "Plan"}
              </Button>
            </>
          )}
        </div>
      </div>
      {editing && <CoverEditor item={item} date={date} halfDay={halfDay} onClose={() => setEditing(false)} />}
    </div>
  );
}

function StalePlans({ plans, canEdit }: { plans: Duty[]; canEdit: boolean }) {
  const toast = useToast();
  const cancel = useApiMutation(cancelCover, { invalidate: SUBSTITUTIONS_INVALIDATE });
  return (
    <section className="cover-teacher">
      <header className="cover-teacher-head">
        <div>
          <strong>Plans no longer needed</strong>
          <div className="small muted">The teacher is no longer marked away (leave cancelled or attendance changed), or the timetable changed.</div>
        </div>
      </header>
      {plans.map(plan => (
        <div className="cover-row" key={plan.id}>
          <div className="cover-when">
            <strong>{plan.period.name}</strong>
            <span className="small muted">
              {hhmm(plan.period.startTime)}–{hhmm(plan.period.endTime)}
            </span>
          </div>
          <div className="cover-lesson">
            <span>{plan.section.name}</span>
            <span className="small muted">for {plan.absentTeacher.name}</span>
          </div>
          <div className="cover-plan">
            <span className="cover-plan-text">{plan.kind === "ACTIVITY" ? plan.activity : (plan.substitute?.name ?? STATUS[plan.kind].label)}</span>
          </div>
          <div className="cover-actions">
            {canEdit && (
              <Button
                size="sm"
                loading={cancel.isPending}
                onClick={() => cancel.mutate(plan.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(message(e)) })}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

/* AC-12: the day's substitution plan, over the page. Every lesson of an absent teacher, with how
   it is covered; one not planned is a leisure period. ADMIN plans, PRINCIPAL sees it.
   Mount it when it opens: it starts on `initialDate` (default: the school's today). */
export function SubstitutionOverlay({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: string }) {
  const { can } = useAuth();
  const canPlan = can("academics.substitutions.plan");
  const [date, setDate] = useState<string | undefined>(initialDate);
  const { data, error, isLoading, refetch } = useApiGet<DayPlan>(SUBSTITUTIONS_PATH, date ? { date } : undefined, { enabled: open });

  const shown = data?.date ?? date;
  const today = data?.today;
  const step = (days: number) => shown && setDate(shiftDate(shown, days));
  const c = data?.counts;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      full
      title={
        <span className="cover-title">
          <span>Substitutions</span>
          <span className="cover-day-nav">
            <Button size="sm" variant="ghost" icon={<ChevronLeft />} aria-label="Previous day" onClick={() => step(-1)} disabled={!shown} />
            <span className="cover-day-label">{shown && today ? `${dayName(shown, today)} · ${longDate(shown)}` : "…"}</span>
            <Button size="sm" variant="ghost" icon={<ChevronRight />} aria-label="Next day" onClick={() => step(1)} disabled={!shown} />
            {today && shown !== today && (
              <Button size="sm" onClick={() => setDate(today)}>
                Today
              </Button>
            )}
          </span>
        </span>
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <SkeletonBlock lines={6} />
      ) : !data.workingDay ? (
        <EmptyState icon={<CalendarCheck />} title="No classes this day" message={`${longDate(data.date)} is ${CLOSURES[data.closure ?? ""] ?? "a closed day"}.`} />
      ) : (
        <div className="stack">
          <div className="cover-counts">
            {c!.needed > 0 ? (
              <Badge tone="warning" dot>
                {c!.needed} to plan
              </Badge>
            ) : (
              c!.periods > 0 && (
                <Badge tone="success" dot>
                  All planned
                </Badge>
              )
            )}
            {c!.substitute > 0 && <Badge tone="success">{c!.substitute} substituted</Badge>}
            {c!.activity > 0 && <Badge tone="info">{c!.activity} activity</Badge>}
            {c!.leisure > 0 && <Badge>{c!.leisure} leisure</Badge>}
            {c!.notNeeded > 0 && <Badge>{c!.notNeeded} taken by the teacher</Badge>}
            <span className="small muted">
              {data.absentTeachers.length} teacher{data.absentTeachers.length === 1 ? "" : "s"} away · {c!.periods} period{c!.periods === 1 ? "" : "s"}
            </span>
          </div>
          {!data.editable && data.date < data.today && <Alert tone="info">A past day: its plan is kept as it was and can't change.</Alert>}
          {data.absentTeachers.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck />}
              title="Every teacher is in"
              message="Nobody is marked absent, on leave or on a half day in Staff attendance for this day."
            />
          ) : (
            data.absentTeachers.map(a => (
              <section className="cover-teacher" key={a.teacher.id}>
                <header className="cover-teacher-head">
                  <div>
                    <strong>{a.teacher.name}</strong> <span className="small muted">{a.teacher.employeeCode}</span>
                    {a.remarks && <div className="small muted">{a.remarks}</div>}
                  </div>
                  <Badge tone={a.status === "HALF_DAY" ? "info" : "danger"}>{absenceLabel(a)}</Badge>
                </header>
                {a.periods.map(item => (
                  <CoverRow key={item.timetableSlotId} item={item} date={data.date} halfDay={a.status === "HALF_DAY"} canEdit={canPlan && data.editable} />
                ))}
              </section>
            ))
          )}
          {data.noLongerNeeded.length > 0 && <StalePlans plans={data.noLongerNeeded} canEdit={canPlan && data.editable} />}
        </div>
      )}
    </Dialog>
  );
}
