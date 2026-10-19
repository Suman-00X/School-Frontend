/* AC-10 · Cover and substitute: on a period-wise day, section → period → student list, to take
   an absent teacher's period, or mark it free when nobody of the section can. Free periods tab:
   every free period, with Remove. */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarOff, Coffee, Users } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList, useListParams } from "@/common/hooks";
import { Alert, Badge, Button, Card, DataTable, EmptyState, ErrorState, Select, SkeletonBlock, Stepper, Tabs, TextInput, useTabParam, type TabItem } from "@/common/ui";
import { formatDate, formatDateTime, todayIso } from "@/common/utils/format";
import { useMyTeaching } from "../../shared/api/teaching";
import { PageIntro } from "../../shared/components/PageIntro";
import { useSectionOptions } from "../../shared/components/SectionSelect";
import { hhmm, MY_TIMETABLE_PATH, type TeacherTimetable } from "../../timetable/api/timetable";
import { FREE_PERIODS_PATH, MODE_TEXT, useLockRules, type CoverSection, type CoverSections, type FreePeriod } from "../api/attendance";
import { MarkFreeDialog, RemoveFreeDialog } from "../components/FreePeriodDialogs";
import { RegisterEditor } from "../components/RegisterEditor";

export default function CoverPage() {
  const { can } = useAuth();
  const [, setSearch] = useSearchParams();
  const tabs: TabItem[] = [
    { id: "cover", label: "Cover a period", hidden: !can("academics.attendance.record") },
    { id: "free", label: "Free periods", hidden: !can("academics.attendance.read") }
  ];
  const [tab] = useTabParam(tabs);
  const switchTab = (id: string) => setSearch(id === tabs.find(t => !t.hidden)?.id ? {} : { tab: id }, { replace: true });
  return (
    <div className="stack">
      <PageIntro>
        {tab === "cover"
          ? "Take the register of a period whose teacher is away, or mark it free when nobody of the section can cover it."
          : "Periods marked free: no register was due, and they count in nobody's attendance."}
      </PageIntro>
      <Tabs tabs={tabs} value={tab} onChange={switchTab} />
      {tab === "cover" ? <CoverSteps /> : <FreePeriods />}
    </div>
  );
}

function CoverSteps() {
  const [search, setSearch] = useSearchParams();
  const sectionId = search.get("sectionId") ?? "";
  const period = Number(search.get("period")) || 0;
  const go = (next: { sectionId?: string; period?: number }) =>
    setSearch(prev => {
      const q = new URLSearchParams(prev);
      if (next.sectionId) q.set("sectionId", next.sectionId);
      else q.delete("sectionId");
      if (next.period) q.set("period", String(next.period));
      else q.delete("period");
      return q;
    });

  const step = !sectionId ? 0 : !period ? 1 : 2;
  return (
    <div className="stack">
      <Card>
        <Stepper steps={["Section", "Period", "Students"]} current={step} onStepClick={i => go(i === 0 ? {} : { sectionId })} />
      </Card>
      {step === 0 && <PickSection onPick={(id, p) => go({ sectionId: id, period: p })} />}
      {step > 0 && <SectionPeriods sectionId={sectionId} period={period} onPeriod={p => go({ sectionId, period: p })} onBack={() => go({})} />}
    </div>
  );
}

/* Step 1: my sections taking attendance by period today, and a teacher's own classes today */
function PickSection({ onPick }: { onPick: (sectionId: string, period?: number) => void }) {
  const { can } = useAuth();
  const cover = useApiGet<CoverSections>("/academics/attendance/cover");
  const mine = useApiGet<TeacherTimetable>(can("portal.learning.teaching") ? MY_TIMETABLE_PATH : null);
  const c = cover.data;
  if (cover.error) return <Card><ErrorState error={cover.error} onRetry={() => void cover.refetch()} /></Card>;
  if (!c)
    return (
      <Card>
        <SkeletonBlock lines={4} />
      </Card>
    );
  if (c.mode !== "PERIOD_WISE")
    return (
      <Card>
        <EmptyState
          icon={<Users />}
          title={`Today attendance is taken ${MODE_TEXT[c.mode]}`}
          message="There are no period registers to cover: the class teacher, the deputy or an administrator takes the register."
          actions={<Link className="btn" to="/academics/attendance">Open the register</Link>}
        />
      </Card>
    );

  const weekday = new Date(c.date + "T00:00:00").getDay() || 7;
  const today = mine.data?.days.find(d => d.weekday === weekday)?.slots ?? [];
  return (
    <div className="stack">
      {!c.workingDay && <Alert tone="warning" title="The school is closed today">No registers can be taken on a closed day.</Alert>}
      {mine.data && (
        <Card title="My classes today" subtitle={today.length ? `${today.length} on the timetable` : "Nothing on your timetable today"}>
          {today.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap" }}>
              {today.map(s => (
                <Button key={s.id} size="sm" onClick={() => s.section && onPick(s.section.id, s.period.periodNumber)} disabled={!s.section}>
                  {s.period.name} · {s.section?.name} · {s.subject?.subjectName}
                </Button>
              ))}
            </div>
          )}
        </Card>
      )}
      <Card title="Sections" subtitle={`${formatDate(c.date)} · attendance by period`}>
        {c.sections.length === 0 ? (
          <EmptyState icon={<Users />} title="No sections to cover" message="You can cover periods only in sections you teach in." />
        ) : (
          <div className="cover-grid">
            {c.sections.map(s => (
              <button key={s.id} type="button" className="cover-section" onClick={() => onPick(s.id)}>
                <div className="cover-card-title">{s.label}</div>
                <div className="small muted">{s.className}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* Step 2: the section's periods today; step 3: one period's student list */
function SectionPeriods({ sectionId, period, onPeriod, onBack }: { sectionId: string; period: number; onPeriod: (p: number) => void; onBack: () => void }) {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const lock = useLockRules();
  const q = useApiGet<CoverSection>(`/academics/attendance/cover/${sectionId}`);
  const [freeing, setFreeing] = useState<{ periodNumber: number; periodName: string; reason?: string } | null>(null);
  const [unfreeing, setUnfreeing] = useState<{ id: string; label: string; reason: string } | null>(null);
  const c = q.data;
  const canFree = can("academics.attendance.manageFreePeriods") && teaching.leads(sectionId) && !readOnly;

  if (q.error)
    return (
      <Card>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        <div className="row" style={{ justifyContent: "center" }}>
          <Button variant="ghost" icon={<ArrowLeft />} onClick={onBack}>
            Pick another section
          </Button>
        </div>
      </Card>
    );
  if (!c)
    return (
      <Card>
        <SkeletonBlock lines={5} />
      </Card>
    );

  const open = c.periods.find(p => p.periodNumber === period);
  if (period && open)
    return (
      <div className="stack">
        <div>
          <Button size="sm" variant="ghost" icon={<ArrowLeft />} onClick={() => onPeriod(0)}>
            {c.section.label}: all periods
          </Button>
        </div>
        <RegisterEditor
          key={`${sectionId}|${period}`}
          sectionId={sectionId}
          date={c.date}
          kind="PERIOD"
          periodNumber={period}
          title={`${open.name} · ${c.section.label} · ${formatDate(c.date)}`}
          canRecord={can("academics.attendance.record") && !readOnly}
          subjects={c.subjects}
          defaultSubjectId={(open.subjectTaught ?? open.timetabled?.subject)?.id ?? null}
          onSaved={() => void q.refetch()}
        />
      </div>
    );

  return (
    <Card
      title={c.section.label}
      subtitle={`${formatDate(c.date)} · ${c.periods.filter(p => !p.taken && !p.free).length} of ${c.periods.length} not taken`}
      actions={
        <Button size="sm" variant="ghost" icon={<ArrowLeft />} onClick={onBack}>
          Sections
        </Button>
      }
    >
      <div className="cover-grid">
        {c.periods.map(p => (
          <div key={p.periodNumber} className="cover-card">
            <div className="cover-card-head">
              <div>
                <div className="cover-card-title">{p.name}</div>
                <div className="small muted">
                  {hhmm(p.startTime)}–{hhmm(p.endTime)}
                </div>
              </div>
              {p.free ? <Badge>Free</Badge> : p.taken ? <Badge tone={p.substitute ? "info" : "success"}>{p.substitute ? "Substitute" : "Taken"}</Badge> : <Badge tone="warning">Not taken</Badge>}
            </div>
            <div className="cover-card-body">
              {p.free ? (
                <>Free: {p.free.reason}</>
              ) : p.timetabled ? (
                <>
                  {(p.subjectTaught ?? p.timetabled.subject).subjectName}
                  {p.timetabled.teacher?.name ? ` · ${p.timetabled.teacher.name}` : ""}
                  {p.subjectTaught && p.subjectTaught.id !== p.timetabled.subject.id && <div className="small muted">Timetabled: {p.timetabled.subject.subjectName}</div>}
                </>
              ) : (
                <span className="muted">Nothing timetabled</span>
              )}
            </div>
            <div className="cover-card-actions">
              {p.free ? (
                canFree && (
                  <Button size="sm" onClick={() => setUnfreeing({ id: p.free!.id, label: p.name, reason: p.free!.reason })}>
                    Remove
                  </Button>
                )
              ) : (
                <>
                  <Button size="sm" variant={p.taken ? "default" : "primary"} onClick={() => onPeriod(p.periodNumber)}>
                    {p.taken ? "Open register" : "Take register"}
                  </Button>
                  {canFree && !p.taken && (
                    <Button size="sm" variant="ghost" onClick={() => setFreeing({ periodNumber: p.periodNumber, periodName: p.name })}>
                      Mark free
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {freeing && (
        <MarkFreeDialog
          key={freeing.periodNumber}
          target={{ sectionId, sectionLabel: c.section.label, date: c.date, ...freeing }}
          locked={lock.isLocked(c.date, todayIso())}
          onClose={() => {
            setFreeing(null);
            void q.refetch();
          }}
        />
      )}
      {unfreeing && (
        <RemoveFreeDialog
          key={unfreeing.id}
          target={{ ...unfreeing, sectionLabel: c.section.label, date: c.date }}
          locked={lock.isLocked(c.date, todayIso())}
          onClose={() => {
            setUnfreeing(null);
            void q.refetch();
          }}
        />
      )}
    </Card>
  );
}

function FreePeriods() {
  const { can } = useAuth();
  const { readOnly } = useAcademicYear();
  const teaching = useMyTeaching();
  const lock = useLockRules();
  const sections = useSectionOptions();
  const { params, setParam, setPage } = useListParams({ sectionId: "", from: "", to: "" });
  const list = useApiList<FreePeriod>(FREE_PERIODS_PATH, params);
  const [removing, setRemoving] = useState<FreePeriod | null>(null);
  /* Past the edit window only the policy's override roles may change a date */
  const canFree = (f: FreePeriod) =>
    can("academics.attendance.manageFreePeriods") && teaching.leads(f.section.id) && !readOnly && (!lock.isLocked(f.date, todayIso()) || lock.canOverride);
  const filtered = !!(params.sectionId || params.from || params.to);

  return (
    <Card flush>
      <div className="filter-bar">
        <Select label="Section" className="select-sm" value={params.sectionId} onChange={e => setParam("sectionId", e.target.value)} options={sections.options} placeholder="All sections" />
        <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
        <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
      </div>
      <DataTable
        rows={list.rows}
        rowKey={f => f.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        empty={
          <EmptyState
            icon={filtered ? <CalendarOff /> : <Coffee />}
            title={filtered ? "No free periods match" : "No free periods"}
            message={filtered ? "Try another section or dates." : "A period is marked free from Cover a period, when nobody of the section can take it."}
          />
        }
        columns={[
          { key: "date", header: "Date", render: f => <span className="nowrap">{formatDate(f.date)}</span> },
          { key: "section", header: "Section", render: f => f.section.label },
          { key: "label", header: "Period", render: f => f.label },
          {
            key: "reason",
            header: "Reason",
            render: f => (
              <div>
                <div>{f.reason}</div>
                {f.lockOverride && <div className="small muted">Changed after lock: {f.lockOverride.reason}</div>}
              </div>
            )
          },
          { key: "markedAt", header: "Marked", render: f => <span className="small muted nowrap">{formatDateTime(f.markedAt)}</span> },
          {
            key: "actions",
            header: "",
            align: "right",
            render: f =>
              canFree(f) && (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(f)}>
                  Remove
                </Button>
              )
          }
        ]}
      />
      {removing && (
        <RemoveFreeDialog
          key={removing.id}
          target={{ id: removing.id, label: removing.label, sectionLabel: removing.section.label, date: removing.date, reason: removing.reason }}
          locked={lock.isLocked(removing.date, todayIso())}
          onClose={() => setRemoving(null)}
        />
      )}
    </Card>
  );
}
