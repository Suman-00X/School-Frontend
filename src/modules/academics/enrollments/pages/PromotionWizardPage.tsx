/* AC-12 · Bulk promotion: promote a whole section into the next year, with per-student
   exceptions (repeat, leave, another section). One request at the end, all or nothing. */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, FormActions, Kpi, Page, PageHeader, Select, Stepper, useConfirm, useToast } from "@/common/ui";
import { SectionSelect, sectionTitle, useSectionOptions } from "../../shared/components/SectionSelect";
import { ENROLLMENTS_PAGE, SETUP_PATHS } from "../../shared/utils/paths";
import {
  ENROLLMENTS_PATH,
  promoteSection,
  studentLabel,
  useRoster,
  useYearSections,
  type BulkPromotionResult,
  type Enrollment,
  type PromotionAction,
  type PromotionOverride
} from "../api/enrollments";
import { useTargetYears } from "../components/EnrollmentDialogs";
import "../../shared/components/setup.css";

const STEPS = ["Sections", "Students", "Review"];

const ACTIONS: { value: PromotionAction; label: string }[] = [
  { value: "PROMOTE", label: "Promote" },
  { value: "REPEAT", label: "Repeat" },
  { value: "LEAVE", label: "Leaves" }
];

type Choice = { action: PromotionAction; toSectionId: string };

export default function PromotionWizardPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [search] = useSearchParams();
  const { selected: year, readOnly } = useAcademicYear();
  const sourceSections = useSectionOptions();
  const targets = useTargetYears();
  const [step, setStep] = useState(0);
  const [fromSection, setFromSection] = useState(search.get("from") ?? "");
  const [toYear, setToYear] = useState(targets.defaultId);
  const [toSection, setToSection] = useState("");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BulkPromotionResult | null>(null);
  const roster = useRoster(fromSection);
  const targetSections = useYearSections(toYear);
  const run = useApiMutation(promoteSection, { invalidate: [ENROLLMENTS_PATH] });

  const students = useMemo(
    () => (roster.data ?? []).filter(e => e.status === "ACTIVE").sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true })),
    [roster.data]
  );
  const source = sourceSections.byId.get(fromSection);
  const target = targetSections.byId.get(toSection);
  const toYearName = targets.options.find(o => o.value === toYear)?.label ?? "the next year";
  const choiceOf = (e: Enrollment): Choice => choices[e.studentId] ?? { action: "PROMOTE", toSectionId: "" };
  const counts = students.reduce(
    (c, e) => {
      c[choiceOf(e).action]++;
      return c;
    },
    { PROMOTE: 0, REPEAT: 0, LEAVE: 0 } as Record<PromotionAction, number>
  );

  if (readOnly)
    return (
      <Page>
        <PageHeader title="Promote a section" breadcrumbs={[{ label: "Enrollments", to: ENROLLMENTS_PAGE }, { label: "Promote a section" }]} />
        <Card>
          <EmptyState title={`${year?.yearName ?? "This year"} is archived`} message="Pick a year that isn't archived in the header to promote its sections." />
        </Card>
      </Page>
    );

  const set = (studentId: string, patch: Partial<Choice>) => setChoices(c => ({ ...c, [studentId]: { ...(c[studentId] ?? { action: "PROMOTE", toSectionId: "" }), ...patch } }));

  const next = () => {
    setMessage(null);
    if (step === 0) {
      if (!fromSection || !toYear || !toSection) return setMessage("Pick the section, the year and the section they move to.");
      if (!students.length) return setMessage(`${source ? sectionTitle(source) : "The section"} has no active students to promote.`);
    }
    if (step === 1) {
      const missing = students.find(e => choiceOf(e).action === "REPEAT" && !choiceOf(e).toSectionId);
      if (missing) return setMessage(`Pick the section ${studentLabel(missing)} repeats in.`);
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    setMessage(null);
    const overrides: PromotionOverride[] = students
      .map(e => ({ e, c: choiceOf(e) }))
      .filter(({ c }) => c.action !== "PROMOTE" || (c.toSectionId && c.toSectionId !== toSection))
      .map(({ e, c }) => ({ studentId: e.studentId, action: c.action, ...(c.action !== "LEAVE" && c.toSectionId ? { toSectionId: c.toSectionId } : {}) }));
    const ok = await confirm({
      title: `Promote ${source ? sectionTitle(source) : "the section"} into ${toYearName}?`,
      message: `${counts.PROMOTE} promoted, ${counts.REPEAT} repeating, ${counts.LEAVE} leaving. Their ${year?.yearName ?? ""} enrollments close (marked left); leavers' transport seats and hostel beds end.`,
      confirmLabel: "Promote",
      tone: "primary"
    });
    if (!ok) return;
    run.mutate(
      { fromSectionId: fromSection, toAcademicYearId: toYear, toSectionId: toSection, overrides },
      {
        onSuccess: res => {
          toast.success(res.message || "Section promoted");
          setResult(res.data);
        },
        onError: err => setMessage(errorMessage(err))
      }
    );
  };

  const crumbs = [{ label: "Enrollments", to: ENROLLMENTS_PAGE }, { label: "Promote a section" }];

  if (result) {
    const names = new Map(students.map(e => [e.studentId, studentLabel(e)]));
    return (
      <Page>
        <PageHeader title="Promotion done" breadcrumbs={crumbs} />
        <div className="kpis">
          <Kpi label="Promoted" value={result.promoted} />
          <Kpi label="Repeating" value={result.repeated} />
          <Kpi label="Left" value={result.left} />
          <Kpi label="Skipped" value={result.skipped.length} hint={result.skipped.length ? "See below" : undefined} />
        </div>
        <Card flush title="Skipped" subtitle={result.skipped.length ? "Nothing changed for these students" : undefined}>
          <DataTable
            rows={result.skipped}
            rowKey={s => s.studentId}
            empty={<EmptyState icon={<CheckCircle2 />} title="Nobody was skipped" />}
            columns={[
              { key: "name", header: "Student", render: s => names.get(s.studentId) ?? s.studentId },
              { key: "reason", header: "Why", render: s => s.reason }
            ]}
          />
        </Card>
        <FormActions>
          <ButtonLink to={`${ENROLLMENTS_PAGE}?section=${fromSection}`}>Back to the roster</ButtonLink>
          <Button
            variant="primary"
            onClick={() => {
              setResult(null);
              setStep(0);
              setFromSection("");
              setChoices({});
            }}
          >
            Promote another section
          </Button>
        </FormActions>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Promote a section" subtitle={`From ${year?.yearName ?? "this year"} into another year, one section at a time`} breadcrumbs={crumbs} />
      <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      {step === 0 && (
        <Card title="Sections">
          {!targets.options.length ? (
            <EmptyState
              title="There is no year to promote into"
              message="Create next year and its sections first."
              actions={<ButtonLink to={SETUP_PATHS.academicYears}>Academic years</ButtonLink>}
            />
          ) : (
            <div className="form-grid">
              <SectionSelect
                label={`From (${year?.yearName ?? "this year"})`}
                value={fromSection}
                required
                hint={roster.data ? `${students.length} active student${students.length === 1 ? "" : "s"}` : "Every active student is listed next"}
                onChange={e => {
                  setFromSection(e.target.value);
                  setChoices({});
                }}
              />
              <div />
              <Select
                label="Into year"
                required
                options={targets.options}
                value={toYear}
                placeholder="Pick the year"
                hint="Students are enrolled in this year"
                onChange={e => {
                  setToYear(e.target.value);
                  setToSection("");
                  setChoices({});
                }}
              />
              <Select
                label="Into section"
                required
                searchable
                options={targetSections.options}
                value={toSection}
                disabled={!toYear}
                placeholder={!toYear ? "Pick the year first" : targetSections.isLoading ? "Loading sections…" : targetSections.options.length ? "Pick the section" : "That year has no sections yet"}
                hint="Where everyone goes unless you say otherwise"
                onChange={e => setToSection(e.target.value)}
              />
            </div>
          )}
        </Card>
      )}
      {step === 1 && (
        <Card flush title={`${source ? sectionTitle(source) : "Students"} → ${target ? sectionTitle(target) : toYearName}`} subtitle="Everyone is promoted unless you change it. Repeating needs a section of the new year.">
          <DataTable
            rows={students}
            rowKey={e => e.studentId}
            loading={roster.isLoading}
            columns={[
              { key: "roll", header: "Roll", width: 90, render: e => <span className="mono">{e.rollNumber ?? "—"}</span> },
              { key: "name", header: "Student", render: e => <span style={{ fontWeight: 550 }}>{studentLabel(e)}</span> },
              {
                key: "action",
                header: "Action",
                render: e => (
                  <div className="segmented" role="radiogroup" aria-label={`Action for ${studentLabel(e)}`}>
                    {ACTIONS.map(a => (
                      <button
                        key={a.value}
                        type="button"
                        role="radio"
                        aria-checked={choiceOf(e).action === a.value}
                        className={`segmented-item${choiceOf(e).action === a.value ? " is-on" : ""}${a.value === "LEAVE" ? " is-leave" : ""}`}
                        onClick={() => set(e.studentId, { action: a.value })}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )
              },
              {
                key: "section",
                header: "Into section",
                render: e => {
                  const c = choiceOf(e);
                  if (c.action === "LEAVE") return <span className="muted">No new enrollment</span>;
                  return (
                    <Select
                      aria-label={`Section for ${studentLabel(e)}`}
                      className="select-sm"
                      searchable
                      options={targetSections.options}
                      value={c.toSectionId}
                      placeholder={c.action === "REPEAT" ? "Pick a section" : target ? `${sectionTitle(target)} (default)` : "Default"}
                      required={c.action === "REPEAT"}
                      onChange={ev => set(e.studentId, { toSectionId: ev.target.value })}
                    />
                  );
                }
              }
            ]}
          />
        </Card>
      )}
      {step === 2 && (
        <div className="stack">
          <div className="kpis">
            <Kpi label="Promoted" value={counts.PROMOTE} hint={target ? `Into ${sectionTitle(target)} unless another section was picked` : undefined} />
            <Kpi label="Repeating" value={counts.REPEAT} />
            <Kpi label="Leaving" value={counts.LEAVE} hint="Their transport seat and hostel bed end" />
          </div>
          <Card title="What happens">
            <ul className="small enrollments-notes">
              <li>
                Each student gets a place in {toYearName}; their {year?.yearName ?? ""} enrollment in {source ? sectionTitle(source) : "the section"} closes.
              </li>
              <li>The new section is numbered by the school's roll-number rule; a section that already has students keeps their numbers.</li>
              <li>Students already enrolled in {toYearName} are skipped and listed afterwards.</li>
            </ul>
            {counts.REPEAT + counts.LEAVE > 0 && (
              <div className="row" style={{ marginTop: 10, gap: 6 }}>
                {students
                  .filter(e => choiceOf(e).action !== "PROMOTE")
                  .map(e => (
                    <Badge key={e.studentId} tone={choiceOf(e).action === "LEAVE" ? "warning" : "info"}>
                      {studentLabel(e)}: {choiceOf(e).action === "LEAVE" ? "leaves" : "repeats"}
                    </Badge>
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}
      <FormActions error={message}>
        {step > 0 ? (
          <Button onClick={() => setStep(s => s - 1)} disabled={run.isPending}>
            Back
          </Button>
        ) : (
          <ButtonLink to={ENROLLMENTS_PAGE}>Cancel</ButtonLink>
        )}
        {step < 2 ? (
          <Button variant="primary" onClick={next} disabled={!targets.options.length}>
            Next
          </Button>
        ) : (
          <Button variant="primary" icon={<ArrowUpRight />} loading={run.isPending} onClick={() => void submit()}>
            Promote {students.length} student{students.length === 1 ? "" : "s"}
          </Button>
        )}
      </FormActions>
    </Page>
  );
}
