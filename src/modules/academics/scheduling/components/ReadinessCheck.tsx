import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock } from "lucide-react";
import { isApiError } from "@/common/api";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, ErrorState, Kpi, SkeletonBlock } from "@/common/ui";
import type { ClassInputs } from "../api/scheduling";
import { CLASSES_PAGE, PERIODS_PAGE } from "../utils/links";
import { IssueList } from "./RunBits";

type Section = ClassInputs["sections"][number];
type Teacher = ClassInputs["teachers"][number];

const TEACHERS_SHOWN = 8;

/* A load against what is open: a bar, red when over */
function Load({ needed, available }: { needed: number; available: number }) {
  const pct = available ? Math.min(100, Math.round((needed / available) * 100)) : 100;
  return (
    <div className="sch-load" title={`${needed} of ${available} periods`}>
      <div className={`progress${needed > available ? " sch-over" : ""}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="small nowrap">
        {needed} / {available}
      </span>
    </div>
  );
}

/* AC-07b step 1: what the timetable would be made from (GET …/class-timetable/inputs) and the
   problems visible before generating */
export function ReadinessCheck({ inputs, loading, error, onRetry }: { inputs: ClassInputs | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
  const [allTeachers, setAllTeachers] = useState(false);

  /* 422: the year can't be planned yet (no sections, no periods, no school days); say why and where to fix it */
  if (isApiError(error) && error.status === 422) {
    const fix = /bell schedule|periods/i.test(error.message) ? { to: PERIODS_PAGE, label: "Periods" } : /sections/i.test(error.message) ? { to: CLASSES_PAGE, label: "Classes & sections" } : null;
    return (
      <Card>
        <EmptyState icon={<Clock />} title="Not ready to plan" message={error.message} actions={fix && <ButtonLink to={fix.to}>{fix.label}</ButtonLink>} />
      </Card>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading || !inputs)
    return (
      <Card>
        <SkeletonBlock lines={8} />
      </Card>
    );

  const teaching = inputs.week.periods.filter(p => !p.isBreak).length;
  if (!teaching || !inputs.week.days.length)
    return (
      <Card>
        <EmptyState
          icon={<Clock />}
          title="No periods to plan in"
          message={
            <>
              Add the periods of the school day on <Link to={PERIODS_PAGE}>Periods</Link> first.
            </>
          }
        />
      </Card>
    );

  const errors = inputs.issues.filter(i => i.severity === "ERROR").length;
  const warnings = inputs.issues.length - errors;
  const needed = inputs.sections.reduce((n, s) => n + s.periodsNeeded, 0);
  const over = inputs.sections.filter(s => s.periodsNeeded > s.periodsAvailable).length;
  const teachers = allTeachers ? inputs.teachers : inputs.teachers.slice(0, TEACHERS_SHOWN);

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Sections" value={inputs.sections.length} hint={`${inputs.week.days.length} days × ${teaching} periods`} />
        <Kpi label="Periods to fill" value={needed} hint={`${inputs.week.teachingPeriodsPerWeek} open per section`} />
        <Kpi label="Teachers" value={inputs.teachers.length} hint={inputs.teachers[0] ? `Busiest: ${inputs.teachers[0].periodsPerWeek} periods` : undefined} />
        <Kpi label="Problems" value={errors} hint={`${warnings} warning${warnings === 1 ? "" : "s"}`} />
      </div>

      <Card title="Problems" subtitle={inputs.issues.length ? "Classes a problem names are left out until it is fixed" : undefined}>
        {inputs.issues.length ? (
          <IssueList issues={inputs.issues} />
        ) : (
          <div className="row small" style={{ gap: 8 }}>
            <CheckCircle2 size={16} className="sch-ok" /> Every subject has its classes a week and a teacher.
          </div>
        )}
      </Card>

      <Card flush title="Sections" subtitle={over ? `${over} section${over === 1 ? " needs" : "s need"} more periods than the week has` : "Periods needed against the periods of the week"}>
        <DataTable<Section>
          rows={inputs.sections}
          rowKey={s => s.id}
          empty={<EmptyState title="No sections to plan" message="Add sections under Classes & sections." />}
          columns={[
            { key: "name", header: "Section", render: s => <span style={{ fontWeight: 550 }}>{s.name}</span> },
            {
              key: "subjects",
              header: "Subjects",
              render: s => (
                <span className="small" title={s.subjects.map(x => `${x.subjectName ?? "Subject"}: ${x.weeklyClasses ?? 0} a week`).join("\n")}>
                  {s.subjects.length}
                  <span className="muted"> · {s.subjects.filter(x => !x.teacherId).length ? `${s.subjects.filter(x => !x.teacherId).length} without a teacher` : "all with a teacher"}</span>
                </span>
              )
            },
            { key: "load", header: "Periods", width: 220, render: s => <Load needed={s.periodsNeeded} available={s.periodsAvailable} /> },
            {
              key: "fit",
              header: "",
              align: "right",
              width: 120,
              render: s =>
                s.periodsNeeded > s.periodsAvailable ? (
                  <Badge tone="danger">Over by {s.periodsNeeded - s.periodsAvailable}</Badge>
                ) : s.periodsNeeded === s.periodsAvailable ? (
                  <Badge tone="success">Full week</Badge>
                ) : (
                  <Badge>{s.periodsAvailable - s.periodsNeeded} free</Badge>
                )
            }
          ]}
        />
      </Card>

      <Card
        flush
        title="Teachers"
        subtitle="Busiest first, with their classes in other sections"
        actions={
          inputs.teachers.length > TEACHERS_SHOWN && (
            <Button size="sm" variant="ghost" onClick={() => setAllTeachers(a => !a)}>
              {allTeachers ? "Show fewer" : `Show all ${inputs.teachers.length}`}
            </Button>
          )
        }
      >
        <DataTable<Teacher>
          rows={teachers}
          rowKey={t => t.teacherId}
          empty={<EmptyState title="No teachers yet" message="Assign teachers to the sections' subjects under Curriculum." />}
          columns={[
            { key: "name", header: "Teacher", render: t => t.name ?? "Teacher" },
            { key: "load", header: "Periods a week", width: 220, render: t => <Load needed={t.periodsPerWeek} available={t.periodsAvailable} /> },
            {
              key: "fit",
              header: "",
              align: "right",
              width: 120,
              render: t => (t.periodsPerWeek > t.periodsAvailable ? <Badge tone="danger">Over by {t.periodsPerWeek - t.periodsAvailable}</Badge> : null)
            }
          ]}
        />
      </Card>
    </div>
  );
}
