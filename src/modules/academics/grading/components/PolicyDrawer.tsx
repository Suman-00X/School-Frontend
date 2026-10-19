import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Badge, Button, Checkbox, Drawer, errorCount, Field, FormTabs, RadioGroup, Select, Switch, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { useSubjectOptions } from "../../subjects/api/subjects";
import { useGradeScaleOptions } from "../api/gradeScales";
import {
  BUILT_IN,
  createPolicy,
  deletePolicy,
  GRADING_MODES,
  POLICY_ASSIGNMENTS_PATH,
  RESULT_POLICIES_PATH,
  updatePolicy,
  type AbsenceTreatment,
  type GradingMode,
  type PolicySettings,
  type RankingMethod,
  type RankScope,
  type ResultPolicy,
  type ResultPolicyInput,
  type RoundingMode,
  type SubjectCategory
} from "../api/resultPolicies";

/* Numbers are kept as typed; "" is "not set" (null) for the optional ones */
type SubjectRow = { key: number; subjectId: string; category: SubjectCategory; credits: string; isMandatory: boolean; minPercent: string };

type Values = {
  name: string;
  description: string;
  isDefault: boolean;
  gradingMode: GradingMode;
  gradeScaleId: string;
  coScholasticScaleId: string;
  gpaScale: string;
  usePaperPassMarks: boolean;
  subjectMinPercent: string;
  requirePassingGrade: boolean;
  requireComponentPass: boolean;
  overallMinPercent: string;
  maxCompartmentSubjects: string;
  graceMaxPerSubject: string;
  graceMaxTotal: string;
  graceCountsInTotal: boolean;
  bestOfSubjects: string;
  absentTreatment: AbsenceTreatment;
  medicalTreatment: AbsenceTreatment;
  exemptTreatment: AbsenceTreatment;
  rankingMethod: RankingMethod;
  rankScope: RankScope;
  rankFailedStudents: boolean;
  showRankToStudents: boolean;
  percentageDecimals: string;
  gpaDecimals: string;
  roundingMode: RoundingMode;
  subjects: SubjectRow[];
};

let seq = 0;
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

const toValues = (p: (PolicySettings & Partial<ResultPolicy>) | null): Values => {
  const s = p ?? BUILT_IN;
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    isDefault: !!p?.isDefault,
    gradingMode: s.gradingMode,
    gradeScaleId: s.gradeScaleId ?? "",
    coScholasticScaleId: s.coScholasticScaleId ?? "",
    gpaScale: str(s.gpaScale),
    usePaperPassMarks: s.usePaperPassMarks,
    subjectMinPercent: str(s.subjectMinPercent),
    requirePassingGrade: s.requirePassingGrade,
    requireComponentPass: s.requireComponentPass,
    overallMinPercent: str(s.overallMinPercent),
    maxCompartmentSubjects: str(s.maxCompartmentSubjects),
    graceMaxPerSubject: str(s.graceMaxPerSubject),
    graceMaxTotal: str(s.graceMaxTotal),
    graceCountsInTotal: s.graceCountsInTotal,
    bestOfSubjects: str(s.bestOfSubjects),
    absentTreatment: s.absentTreatment,
    medicalTreatment: s.medicalTreatment,
    exemptTreatment: s.exemptTreatment,
    rankingMethod: s.rankingMethod,
    rankScope: s.rankScope,
    rankFailedStudents: s.rankFailedStudents,
    showRankToStudents: s.showRankToStudents,
    percentageDecimals: str(s.percentageDecimals),
    gpaDecimals: str(s.gpaDecimals),
    roundingMode: s.roundingMode,
    subjects: (p?.subjects ?? []).map(r => ({
      key: ++seq,
      subjectId: r.subjectId,
      category: r.category,
      credits: str(r.credits),
      isMandatory: r.isMandatory,
      minPercent: str(r.minPercent)
    }))
  };
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/* The whole policy as the API takes it */
const toBody = (v: Values): ResultPolicyInput => {
  const pf = v.gradingMode === "PASS_FAIL";
  return {
    name: v.name.trim(),
    description: v.description.trim(),
    isDefault: v.isDefault,
    gradingMode: v.gradingMode,
    gradeScaleId: v.gradeScaleId || null,
    coScholasticScaleId: v.coScholasticScaleId || null,
    gpaScale: v.gradingMode === "GPA" ? num(v.gpaScale) : null,
    usePaperPassMarks: v.usePaperPassMarks,
    subjectMinPercent: num(v.subjectMinPercent),
    requirePassingGrade: v.requirePassingGrade,
    requireComponentPass: v.requireComponentPass,
    overallMinPercent: num(v.overallMinPercent),
    maxCompartmentSubjects: num(v.maxCompartmentSubjects) ?? 0,
    graceMaxPerSubject: num(v.graceMaxPerSubject) ?? 0,
    graceMaxTotal: num(v.graceMaxTotal) ?? 0,
    graceCountsInTotal: v.graceCountsInTotal,
    bestOfSubjects: num(v.bestOfSubjects),
    absentTreatment: v.absentTreatment,
    medicalTreatment: v.medicalTreatment,
    exemptTreatment: v.exemptTreatment,
    /* A pass/fail result is never ranked */
    rankingMethod: pf ? "NONE" : v.rankingMethod,
    rankScope: v.rankScope,
    rankFailedStudents: v.rankFailedStudents,
    showRankToStudents: v.showRankToStudents,
    percentageDecimals: num(v.percentageDecimals) ?? 2,
    gpaDecimals: num(v.gpaDecimals) ?? 2,
    roundingMode: v.roundingMode,
    subjects: v.subjects
      .filter(r => r.subjectId)
      .map(r => ({ subjectId: r.subjectId, category: r.category, credits: num(r.credits) ?? 1, isMandatory: r.category === "CO_SCHOLASTIC" ? false : r.isMandatory, minPercent: num(r.minPercent) }))
  };
};

/* Only what changed, for PATCH */
const diff = (before: ResultPolicyInput, now: ResultPolicyInput): ResultPolicyInput => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(now)) if (JSON.stringify(v) !== JSON.stringify((before as Record<string, unknown>)[k])) out[k] = v;
  return out as ResultPolicyInput;
};

const TREATMENTS: { value: AbsenceTreatment; label: string; description: string }[] = [
  { value: "ZERO_FAIL", label: "Counts as zero", description: "The paper scores 0 and the subject fails" },
  { value: "EXCLUDE", label: "Left out", description: "The paper doesn't count either way" }
];

const RANKING: { value: RankingMethod; label: string; description: string }[] = [
  { value: "COMPETITION", label: "Standard", description: "Ties share a rank, the next is skipped: 1, 2, 2, 4" },
  { value: "DENSE", label: "Dense", description: "Ties share a rank, none skipped: 1, 2, 2, 3" },
  { value: "NONE", label: "No ranks", description: "Results show no rank" }
];

const SCOPES: { value: RankScope; label: string; description: string }[] = [
  { value: "SECTION", label: "Section", description: "Ranked within each section" },
  { value: "CLASS", label: "Class", description: "Across all sections of the class" },
  { value: "BOTH", label: "Both", description: "A section rank and a class rank" }
];

const ROUNDING = [
  { value: "HALF_UP", label: "Half up", description: "72.345 → 72.35" },
  { value: "HALF_EVEN", label: "Half to even", description: "72.345 → 72.34 (banker's rounding)" },
  { value: "UP", label: "Always up", description: "72.341 → 72.35" },
  { value: "DOWN", label: "Always down", description: "72.349 → 72.34" }
];

const CATEGORIES = [
  { value: "SCHOLASTIC", label: "Scholastic" },
  { value: "CO_SCHOLASTIC", label: "Co-scholastic" }
];

/* Keys per tab, for the error counts on the tabs */
const TAB_KEYS = {
  grading: ["name", "description", "gradingMode", "gradeScaleId", "coScholasticScaleId", "gpaScale"],
  pass: ["usePaperPassMarks", "subjectMinPercent", "requirePassingGrade", "requireComponentPass", "overallMinPercent"],
  grace: ["maxCompartmentSubjects", "graceMaxPerSubject", "graceMaxTotal", "graceCountsInTotal"],
  absences: ["bestOfSubjects", "absentTreatment", "medicalTreatment", "exemptTreatment"],
  ranking: ["rankingMethod", "rankScope", "rankFailedStudents", "showRankToStudents", "percentageDecimals", "gpaDecimals", "roundingMode"],
  subjects: ["subjects"]
} as const;

/* AC-06 result policy editor: one long form in tabs, saved together. Read-only without manage.
   Mount it when opened. */
export function PolicyDrawer({ policy, canManage, onClose }: { policy: ResultPolicy | null; canManage: boolean; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const scales = useGradeScaleOptions();
  const subjects = useSubjectOptions();
  const invalidate = [RESULT_POLICIES_PATH, POLICY_ASSIGNMENTS_PATH];
  const create = useApiMutation(createPolicy, { invalidate });
  const update = useApiMutation(updatePolicy, { invalidate });
  const remove = useApiMutation(deletePolicy, { invalidate });
  const [values, setValues] = useState<Values>(() => toValues(policy));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const [attempt, setAttempt] = useState(0);
  const disabled = !canManage;

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues(x => ({ ...x, [k]: v }));
    setErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const text = (k: keyof Values & string) => ({
    value: values[k] as string,
    error: errors[k],
    disabled,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never)
  });

  const gpa = values.gradingMode === "GPA";
  const passFail = values.gradingMode === "PASS_FAIL";
  const before = policy ? toBody(toValues(policy)) : null;
  const changes = before ? diff(before, toBody(values)) : null;
  const unchanged = !!changes && Object.keys(changes).length === 0;

  const validate = () => {
    const e: Record<string, string> = {};
    const range = (k: keyof Values & string, min: number, max: number, opts: { int?: boolean; required?: boolean } = {}) => {
      const raw = (values[k] as string).trim();
      if (raw === "") {
        if (opts.required) e[k] = "is required";
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < min || n > max || (opts.int && !Number.isInteger(n))) e[k] = `${opts.int ? "A whole number" : "A number"} from ${min} to ${max}`;
    };
    if (!values.name.trim()) e.name = "Give the policy a name";
    if (gpa) range("gpaScale", 0.5, 10, { required: true });
    range("subjectMinPercent", 0, 100);
    range("overallMinPercent", 0, 100);
    range("maxCompartmentSubjects", 0, 20, { int: true });
    range("graceMaxPerSubject", 0, 100);
    range("graceMaxTotal", 0, 100);
    if (!e.graceMaxPerSubject && !e.graceMaxTotal && (num(values.graceMaxPerSubject) ?? 0) > (num(values.graceMaxTotal) ?? 0))
      e.graceMaxPerSubject = "Can't be more than the total grace";
    range("bestOfSubjects", 1, 30, { int: true });
    range("percentageDecimals", 0, 4, { int: true });
    range("gpaDecimals", 0, 4, { int: true });
    const ids = values.subjects.map(r => r.subjectId).filter(Boolean);
    if (new Set(ids).size !== ids.length) e.subjects = "Each subject can have only one rule";
    else if (values.subjects.some(r => r.subjectId && r.credits.trim() !== "" && !(Number(r.credits) > 0 && Number(r.credits) <= 99))) e.subjects = "Credits are a number above 0, up to 99";
    else if (values.subjects.some(r => r.minPercent.trim() !== "" && !(Number(r.minPercent) >= 0 && Number(r.minPercent) <= 100))) e.subjects = "A subject's own minimum is a % from 0 to 100";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) {
      setAttempt(a => a + 1);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && err.isValidation) {
        const fe: Record<string, string> = {};
        for (const d of err.details) {
          const key = d.field.startsWith("subjects") ? "subjects" : d.field;
          fe[key] ??= d.message;
        }
        setErrors(fe);
        setAttempt(a => a + 1);
        setFormError("Please correct the highlighted fields.");
      } else if (isApiError(err) && err.status === 409) setErrors({ name: err.message });
      else setFormError(errorMessage(err));
    };
    if (policy) update.mutate({ id: policy.id, ...changes }, { onSuccess: done, onError });
    else create.mutate(toBody(values), { onSuccess: done, onError });
  };

  const askDelete = async () => {
    if (!policy) return;
    const ok = await confirm({
      title: `Delete ${policy.name}?`,
      message: `${policy.name} is removed. A policy still applied to an exam or class can't be deleted: remove those assignments first.${policy.isDefault ? " It is the school default now: results then follow the built-in rules until another default is set." : ""}`,
      confirmLabel: "Delete policy"
    });
    if (ok)
      remove.mutate(policy.id, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => toast.error(err)
      });
  };

  const sw = (k: keyof Values & string, label: string, hint: string) => (
    <Field hint={hint}>
      <Switch label={label} checked={values[k] as boolean} disabled={disabled} onChange={v => set(k, v as never)} />
    </Field>
  );

  const tabs = [
    {
      id: "grading",
      label: "Grading",
      errors: errorCount(errors, TAB_KEYS.grading),
      content: (
        <div className="stack">
          <div className="form-grid">
            <TextInput label="Name" required maxLength={100} placeholder="CBSE middle school" {...text("name")} />
            <Field label="School default" hint="Applies wherever no more specific policy is assigned">
              <Switch label={values.isDefault ? "School default" : "Not the default"} checked={values.isDefault} disabled={disabled || !!policy?.isDefault} onChange={v => set("isDefault", v)} />
            </Field>
          </div>
          <Textarea label="Description" rows={2} maxLength={1000} {...text("description")} />
          <Field label="Results show">
            <RadioGroup aria-label="Grading mode" options={GRADING_MODES} value={values.gradingMode} disabled={disabled} onChange={v => set("gradingMode", v)} />
          </Field>
          <div className="form-grid">
            <Select label="Grade scale" options={scales.options} placeholder="The school's default scale" hint="For grades and grade points" {...text("gradeScaleId")} />
            <Select label="Co-scholastic scale" options={scales.options} placeholder="None" hint="For art, sports, conduct" {...text("coScholasticScaleId")} />
            {gpa && <TextInput label="GPA out of" type="number" min={1} max={10} step="any" required placeholder="10" hint="The highest grade point, e.g. 4, 5 or 10" {...text("gpaScale")} />}
          </div>
        </div>
      )
    },
    {
      id: "pass",
      label: "Pass rules",
      hint: "A subject passes only when every rule that is on holds.",
      errors: errorCount(errors, TAB_KEYS.pass),
      content: (
        <div className="stack">
          {sw("usePaperPassMarks", "Use each paper's pass marks", "The pass marks set on the exam paper")}
          {sw("requireComponentPass", "Pass each part separately", "Theory and practical (and other parts) each need their pass marks")}
          {sw("requirePassingGrade", "A failing grade fails the subject", "Grades the scale marks as not passing")}
          <div className="form-grid">
            <TextInput label="Minimum % in each subject" type="number" min={0} max={100} step="any" placeholder="None" hint="Empty: no minimum" {...text("subjectMinPercent")} />
            <TextInput label="Minimum % overall" type="number" min={0} max={100} step="any" placeholder="None" hint="Of the total of counted subjects" {...text("overallMinPercent")} />
          </div>
        </div>
      )
    },
    {
      id: "grace",
      label: "Compartment & grace",
      errors: errorCount(errors, TAB_KEYS.grace),
      content: (
        <div className="stack">
          <TextInput
            label="Subjects a student may fail and sit again"
            type="number"
            min={0}
            max={20}
            hint="Failing this many or fewer gives a compartment result; 0: no compartment"
            fieldClassName="field-narrow"
            {...text("maxCompartmentSubjects")}
          />
          <div className="form-grid">
            <TextInput label="Grace marks per subject" type="number" min={0} max={100} step="any" hint="The most added to one subject to pass it" {...text("graceMaxPerSubject")} />
            <TextInput label="Grace marks in total" type="number" min={0} max={100} step="any" hint="The most added across all subjects" {...text("graceMaxTotal")} />
          </div>
          {sw("graceCountsInTotal", "Grace counts in the total", "Off: the total and percentage use the marks before grace")}
        </div>
      )
    },
    {
      id: "absences",
      label: "Absences & best of",
      errors: errorCount(errors, TAB_KEYS.absences),
      content: (
        <div className="stack">
          <TextInput
            label="Count only the best subjects"
            type="number"
            min={1}
            max={30}
            placeholder="All"
            hint="E.g. 5: the best five count; mandatory subjects always do. Empty: all subjects"
            fieldClassName="field-narrow"
            {...text("bestOfSubjects")}
          />
          <Field label="Absent from a paper">
            <RadioGroup aria-label="Absent" options={TREATMENTS} value={values.absentTreatment} disabled={disabled} onChange={v => set("absentTreatment", v)} />
          </Field>
          <Field label="Absent on medical grounds">
            <RadioGroup aria-label="Medical" options={TREATMENTS} value={values.medicalTreatment} disabled={disabled} onChange={v => set("medicalTreatment", v)} />
          </Field>
          <Field label="Exempted from a paper">
            <RadioGroup aria-label="Exempt" options={TREATMENTS} value={values.exemptTreatment} disabled={disabled} onChange={v => set("exemptTreatment", v)} />
          </Field>
        </div>
      )
    },
    {
      id: "ranking",
      label: "Ranking & rounding",
      errors: errorCount(errors, TAB_KEYS.ranking),
      content: (
        <div className="stack">
          {passFail ? (
            <p className="muted" style={{ margin: 0 }}>
              Pass / fail results are not ranked.
            </p>
          ) : (
            <>
              <Field label="Ranks" error={errors.rankingMethod}>
                <RadioGroup aria-label="Ranking" options={RANKING} value={values.rankingMethod} disabled={disabled} onChange={v => set("rankingMethod", v)} />
              </Field>
              {values.rankingMethod !== "NONE" && (
                <>
                  <Field label="Ranked within">
                    <RadioGroup aria-label="Rank scope" options={SCOPES} value={values.rankScope} disabled={disabled} onChange={v => set("rankScope", v)} />
                  </Field>
                  {sw("rankFailedStudents", "Rank students who failed", "Off: only students who passed get a rank")}
                  {sw("showRankToStudents", "Show ranks to students and parents", "Off: staff still see them; the report card leaves them out")}
                </>
              )}
            </>
          )}
          <div className="form-grid">
            <TextInput label="Decimals in percentages" type="number" min={0} max={4} {...text("percentageDecimals")} />
            {gpa && <TextInput label="Decimals in GPA" type="number" min={0} max={4} {...text("gpaDecimals")} />}
            <Select label="Rounding" required options={ROUNDING} {...text("roundingMode")} />
          </div>
        </div>
      )
    },
    {
      id: "subjects",
      label: "Subject rules",
      hint: "Optional: per subject, whether it counts (co-scholastic doesn't), its credits for GPA, if it always counts in best-of, and its own minimum %.",
      errors: errorCount(errors, TAB_KEYS.subjects),
      content: <SubjectRules rows={values.subjects} options={subjects.options} disabled={disabled} error={errors.subjects} onChange={rows => set("subjects", rows)} />
    }
  ];

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={policy ? policy.name : "New result policy"}
      subtitle={policy?.isDefault ? <Badge tone="success">School default</Badge> : policy ? "Result policy" : "Starts from the built-in standard rules"}
      footerStatus={formError}
      footer={
        canManage ? (
          <>
            {policy && (
              <Button variant="ghost" icon={<Trash2 />} loading={remove.isPending} onClick={() => void askDelete()}>
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="policy-form" variant="primary" loading={create.isPending || update.isPending} disabled={unchanged}>
              {policy ? "Save changes" : "Create policy"}
            </Button>
          </>
        ) : undefined
      }
    >
      <form id="policy-form" onSubmit={submit} noValidate>
        <FormTabs tabs={tabs} attempt={attempt} />
      </form>
    </Drawer>
  );
}

function SubjectRules({
  rows,
  options,
  disabled,
  error,
  onChange
}: {
  rows: SubjectRow[];
  options: { value: string; label: string; description?: string }[];
  disabled: boolean;
  error?: string;
  onChange: (rows: SubjectRow[]) => void;
}) {
  const set = (key: number, patch: Partial<SubjectRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const used = rows.map(r => r.subjectId);
  return (
    <Field error={error} hint={rows.length ? undefined : "No subject rules: every subject counts, 1 credit each, with the policy's minimum."}>
      <div className="stack-sm">
        {rows.length > 0 && (
          <div className="rules">
            <div className="rules-head" aria-hidden>
              <span>Subject</span>
              <span>Counts as</span>
              <span>Credits</span>
              <span>Always counts</span>
              <span>Own min %</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div key={r.key} className="rules-row">
                <Select
                  aria-label={`Rule ${i + 1} subject`}
                  searchable
                  options={options.map(o => ({ ...o, disabled: o.value !== r.subjectId && used.includes(o.value) }))}
                  value={r.subjectId}
                  placeholder="Pick a subject"
                  disabled={disabled}
                  onChange={e => set(r.key, { subjectId: e.target.value })}
                />
                <Select
                  aria-label={`Rule ${i + 1} category`}
                  options={CATEGORIES}
                  value={r.category}
                  required
                  disabled={disabled}
                  onChange={e => set(r.key, { category: e.target.value as SubjectCategory, ...(e.target.value === "CO_SCHOLASTIC" ? { isMandatory: false } : {}) })}
                />
                <input className="input" type="number" min={0} max={99} step="any" aria-label={`Rule ${i + 1} credits`} value={r.credits} disabled={disabled} onChange={e => set(r.key, { credits: e.target.value })} />
                <Checkbox
                  aria-label={`Rule ${i + 1} always counts`}
                  checked={r.isMandatory}
                  disabled={disabled || r.category === "CO_SCHOLASTIC"}
                  onChange={e => set(r.key, { isMandatory: e.target.checked })}
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  placeholder="—"
                  aria-label={`Rule ${i + 1} own minimum`}
                  value={r.minPercent}
                  disabled={disabled}
                  onChange={e => set(r.key, { minPercent: e.target.value })}
                />
                <Button size="sm" variant="ghost" icon={<X />} aria-label={`Remove rule ${i + 1}`} disabled={disabled} onClick={() => onChange(rows.filter(x => x.key !== r.key))} />
              </div>
            ))}
          </div>
        )}
        {!disabled && (
          <div>
            <Button
              size="sm"
              icon={<Plus />}
              disabled={rows.length >= 60}
              onClick={() => onChange([...rows, { key: ++seq, subjectId: "", category: "SCHOLASTIC", credits: "1", isMandatory: false, minPercent: "" }])}
            >
              Add a subject rule
            </Button>
          </div>
        )}
      </div>
    </Field>
  );
}
