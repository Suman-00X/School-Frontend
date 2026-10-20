/* AC-07b · Generate a timetable (Academics › Setup › Timetables): check what the week would be made
   from, set the rules, generate a draft, look at any section's or teacher's week in it, then apply
   or discard it. Generating never changes the timetable; applying writes the draft's lessons. */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History, Sparkles } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { Button, Card, Field, FormActions, MultiSelect, Page, PageHeader, RadioGroup, Stepper, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useSectionOptions } from "../../shared/components/SectionSelect";
import { CLASS_INPUTS_PATH, generateClassTimetable, SCHEDULING_PATH, useRuns, type ClassInputs, type ClassMode, type ClassRequest, type ClassRun } from "../api/scheduling";
import { EMPTY_RULES, requestFrom, ruleCount, rulesFrom, validateRules, type ClassRules } from "../components/ClassRules";
import { ClassRulesForm } from "../components/ClassRulesForm";
import { ClassDraftView } from "../components/ClassDraftView";
import { ReadinessCheck } from "../components/ReadinessCheck";
import { RecentDrafts } from "../components/RecentDrafts";
import { TIMETABLE_PAGE } from "../utils/links";
import "../components/scheduling.css";

const STEPS = ["Check", "Rules", "Draft"];

const MODES: { value: ClassMode; label: string; description: string }[] = [
  { value: "FILL", label: "Keep what's there", description: "Lessons already on the timetable stay; only the missing classes are placed." },
  { value: "REPLACE", label: "Plan the week again", description: "The sections' whole week is planned anew. Applying removes their current lessons." }
];

export default function ClassTimetableGeneratorPage() {
  const { can } = useAuth();
  const { readOnly, selected: year } = useAcademicYear();
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const runId = search.get("run") ?? "";
  const [step, setStep] = useState(runId ? 2 : 0);
  const [rules, setRules] = useState<ClassRules>(EMPTY_RULES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const sections = useSectionOptions();
  const runs = useRuns({ kind: "CLASS_TIMETABLE", limit: 10 });
  const generate = useApiMutation(generateClassTimetable, { invalidate: [SCHEDULING_PATH] });
  const canGenerate = can("academics.scheduling.generate") && !readOnly;

  const inputs = useApiGet<ClassInputs>(CLASS_INPUTS_PATH, { sectionIds: rules.sectionIds.join(",") || undefined, mode: rules.mode });
  const last = runs.data?.[0] as ClassRun | undefined;

  const openRun = (id: string) => {
    setSearch({ run: id }, { replace: !!runId });
    setStep(2);
  };
  const goTo = (i: number) => {
    setFormError(null);
    if (i < 2 && runId) setSearch({}, { replace: true });
    setStep(i);
  };
  const editRules = (request: ClassRequest) => {
    setRules(rulesFrom(request));
    setErrors({});
    goTo(1);
  };

  const submit = () => {
    setFormError(null);
    const found = validateRules(rules);
    setErrors(found);
    if (Object.keys(found).length) return setFormError("Check the rules marked in red.");
    generate.mutate(requestFrom(rules), {
      onSuccess: res => {
        toast.success(res.message);
        openRun(res.data.id);
      },
      onError: err => setFormError(errorMessage(err))
    });
  };

  const limit = Number(rules.timeLimitMs || 20000) / 1000;
  const scopeLabel = rules.sectionIds.length ? `${rules.sectionIds.length} section${rules.sectionIds.length === 1 ? "" : "s"}` : "every section";
  const noGenerate = readOnly ? `${year?.yearName ?? "This year"} is archived: its drafts can be looked at, not generated.` : "You can look at drafts; generating needs more access.";

  return (
    <Page>
      <PageHeader
        title="Generate a timetable"
        subtitle="Plan the week for every section or a few. Generating makes a draft: nothing changes until you apply it."
        breadcrumbs={[{ label: "Timetables", to: TIMETABLE_PAGE }, { label: "Generate" }]}
      />
      <div className="sch-layout">
        <div className="stack" style={{ minWidth: 0 }}>
          <Stepper steps={STEPS} current={step} onStepClick={goTo} />

          {step === 0 && (
            <>
              <Card title="What to plan" subtitle="The check below is for this choice">
                <div className="form-grid">
                  <MultiSelect
                    label="Sections"
                    value={rules.sectionIds}
                    onChange={next => setRules(r => ({ ...r, sectionIds: next }))}
                    options={sections.options}
                    placeholder={sections.isLoading ? "Loading sections…" : "Every section"}
                    noun="sections"
                    hint="Leave empty to plan the whole school"
                  />
                  <div />
                </div>
                <Field label="Lessons already placed">
                  <RadioGroup aria-label="Lessons already placed" options={MODES} value={rules.mode} onChange={mode => setRules(r => ({ ...r, mode }))} />
                </Field>
              </Card>
              <ReadinessCheck inputs={inputs.data} loading={inputs.isLoading} error={inputs.error} onRetry={() => void inputs.refetch()} />
              <FormActions error={canGenerate ? undefined : <span className="muted">{noGenerate}</span>}>
                {canGenerate && (
                  <Button variant="primary" onClick={() => goTo(1)} disabled={!inputs.data}>
                    Next: rules
                  </Button>
                )}
              </FormActions>
            </>
          )}

          {step === 1 && (
            <>
              <div className="row-between" style={{ minHeight: 34 }}>
                <p className="muted">
                  Every rule is optional. Planning {scopeLabel}, {rules.mode === "FILL" ? "keeping the lessons already placed" : "the whole week again"}.
                </p>
                {last && (
                  <Button
                    size="sm"
                    icon={<History />}
                    title={`From the draft of ${formatDateTime(last.createdAt)}: ${last.summary}`}
                    onClick={() => {
                      editRules(last.request);
                      toast.success(`Rules copied from the draft of ${formatDateTime(last.createdAt)}`);
                    }}
                  >
                    Start from last rules
                  </Button>
                )}
              </div>
              <ClassRulesForm rules={rules} onChange={setRules} inputs={inputs.data} errors={errors} />
              <FormActions error={generate.isPending ? <span className="muted">Searching for a timetable… up to {limit} seconds</span> : formError}>
                <Button onClick={() => goTo(0)} disabled={generate.isPending}>
                  Back
                </Button>
                {canGenerate && (
                  <Button variant="primary" icon={<Sparkles />} onClick={submit} loading={generate.isPending}>
                    Generate draft{ruleCount(rules) ? ` with ${ruleCount(rules)} rule${ruleCount(rules) === 1 ? "" : "s"}` : ""}
                  </Button>
                )}
              </FormActions>
            </>
          )}

          {step === 2 &&
            (runId ? (
              <ClassDraftView key={runId} runId={runId} onOpenRun={openRun} onEditRules={editRules} />
            ) : (
              <Card>
                <p className="muted">Generate a draft, or open one from Recent drafts.</p>
              </Card>
            ))}
        </div>
        <aside className="sch-aside">
          <RecentDrafts kind="CLASS_TIMETABLE" current={runId} onOpen={openRun} />
        </aside>
      </div>
    </Page>
  );
}
