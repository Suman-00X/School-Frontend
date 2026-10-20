import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCheck, PenLine } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { Alert, Badge, Button, Card, Page, PageHeader, SkeletonBlock, Textarea, useToast } from "@/common/ui";
import { formatDateTime, todayIso } from "@/common/utils/format";
import { DateNav, DiaryLines, NoLines, diaryDayLabel, shiftDate } from "@/modules/academics";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import { homeworkPath } from "../../homework/api/homework";
import { diaryPath, signDiary, useFamilyDiaryDay, useFamilyDiaryDays, type FamilyDiaryDay } from "../api/diary";

const RECENT_DAYS = 30;

/* PO-15 · Diary: the child's school diary for a day: what was done in class, homework,
   reminders and notes from the teachers. A parent signs each day (with a note to the class
   teacher if they like); a day changed after signing asks to be signed again. */
export default function DiaryPage() {
  const { student } = usePortalStudent();
  const { selected: year } = useAcademicYear();
  const [search, setSearch] = useSearchParams();
  const today = todayIso();
  const minDate = year?.startDate;
  const maxDate = year && year.endDate < today ? year.endDate : today;
  const clamp = (d: string) => (minDate && d < minDate ? minDate : maxDate && d > maxDate ? maxDate : d);
  const date = clamp(search.get("date") || today);
  const pick = (d: string) => setSearch(d === today ? {} : { date: d }, { replace: true });

  const day = useFamilyDiaryDay(student.id, date);
  const recent = useFamilyDiaryDays(student.id, shiftDate(maxDate, -(RECENT_DAYS - 1)), maxDate);

  return (
    <Page>
      <PageHeader title="Diary" subtitle={studentFullName(student)} />
      {day.error ? (
        <PortalError error={day.error} onRetry={() => void day.refetch()} />
      ) : (
        <div className="stack">
          <Card>
            <DateNav value={date} min={minDate} max={maxDate} onChange={pick} />
          </Card>
          <div className="dy-layout">
            <Card title={diaryDayLabel(date)}>
              {!day.data ? (
                <SkeletonBlock lines={6} />
              ) : (
                <DiaryLines
                  entries={day.data.entries}
                  homework={day.data.homework}
                  homeworkHref={h => homeworkPath(student.id, h.id)}
                  empty={<NoLines message="The teachers haven't written anything for this day." />}
                />
              )}
            </Card>
            <div className="stack">
              <SignatureCard studentId={student.id} date={date} day={day.data} />
              <Card title="Recent days" subtitle={`The last ${RECENT_DAYS} days with something written`}>
                {!recent.data ? (
                  <SkeletonBlock lines={4} />
                ) : !recent.data.length ? (
                  <p className="muted">Nothing written in the last {RECENT_DAYS} days.</p>
                ) : (
                  <ul className="dy-lines">
                    {recent.data.map(d => (
                      <li key={d.date} className="dy-line" style={{ padding: 0 }}>
                        <button type="button" className="dy-line-button" onClick={() => pick(d.date)} aria-current={d.date === date ? "date" : undefined}>
                          <div className="dy-line-body">
                            <span style={{ fontWeight: d.date === date ? 600 : undefined }}>{diaryDayLabel(d.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                            <span className="small muted">
                              {d.entries ? `${d.entries} line${d.entries === 1 ? "" : "s"}` : "A note to the teacher"}
                            </span>
                          </div>
                          {d.changedSinceSigned ? (
                            <Badge tone="warning">Changed</Badge>
                          ) : d.signedAt ? (
                            <Badge tone="success">Signed</Badge>
                          ) : (
                            <Badge>Not signed</Badge>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

/* The parent signs the day (the student only sees whether it was signed) */
function SignatureCard({ studentId, date, day }: { studentId: string; date: string; day: FamilyDiaryDay | undefined }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const toast = useToast();
  const [note, setNote] = useState("");
  const sign = useApiMutation(signDiary, { invalidate: [diaryPath(studentId)] });
  const canSign = can("portal.diary.sign") && !readOnly;
  const signature = day?.signature ?? null;

  useEffect(() => setNote(signature?.parentNote ?? ""), [date, signature?.id, signature?.parentNote]);

  if (!day) return <Card title="Signature"><SkeletonBlock lines={3} /></Card>;
  const nothing = !day.entries.length && !day.homework.length;
  return (
    <Card title="Signature">
      <div className="dy-sign">
        {signature ? (
          <>
            <div className="dy-signed">
              <CheckCheck size={16} />
              Signed by {signature.signer ? `${signature.signer.firstName} ${signature.signer.lastName}` : "a parent"} · {formatDateTime(signature.signedAt)}
            </div>
            {day.changedSinceSigned && (
              <Alert tone="warning" title="Changed after it was signed">
                A teacher added or changed a line. Please read the day again{canSign ? " and sign it." : "."}
              </Alert>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {nothing ? "Nothing to sign yet. A parent can still send the class teacher a note for this day." : canSign ? "Read the day, then sign to let the teachers know you've seen it." : "A parent hasn't signed this day yet."}
          </p>
        )}
        {canSign ? (
          <>
            <Textarea
              label="Note to the class teacher"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional: e.g. she was unwell yesterday, so the homework is pending"
              hint={signature?.parentNote ? "Signing again replaces your earlier note" : undefined}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button
                variant={signature && !day.changedSinceSigned ? undefined : "primary"}
                icon={day.changedSinceSigned ? <AlertTriangle /> : <PenLine />}
                loading={sign.isPending}
                onClick={() =>
                  sign.mutate(
                    { studentId, date, note: note.trim() || undefined },
                    { onSuccess: res => toast.success(res.message), onError: err => toast.error(err) }
                  )
                }
              >
                {signature ? "Sign again" : "Sign the diary"}
              </Button>
            </div>
          </>
        ) : (
          signature?.parentNote && (
            <p className="dy-note">
              <span className="muted">Note to the teacher: </span>
              {signature.parentNote}
            </p>
          )
        )}
      </div>
    </Card>
  );
}
