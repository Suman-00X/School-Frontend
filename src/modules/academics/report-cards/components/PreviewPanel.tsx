import { useEffect, useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useApiGet } from "@/common/hooks";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  FormActions,
  RadioGroup,
  Select,
  StatTile,
  StatTiles,
  Switch,
  TextInput,
  type Column
} from "@/common/ui";
import {
  GRADING_MODE_LABELS,
  POLICY_SOURCE_LABELS,
  usePolicyResolution,
  useResultPolicies,
  type GradingMode,
  type PolicySettings
} from "../../exams/api/grading";
import {
  pct,
  POLICY_SETTING_KEYS,
  RESULT_LABELS,
  runPreview,
  sourcePaths,
  studentFullName,
  type Preview,
  type PreviewFigures,
  type ResultSheet,
  type ResultStatus,
  type Source
} from "../api/reportCards";
import { ResultBadge } from "./ResultBits";

type Mode = "saved" | "adjust";

/* The rules a school most often tries out; the rest of the policy in force is kept as is */
type Adjust = {
  gradingMode: GradingMode;
  usePaperPassMarks: boolean;
  subjectMinPercent: string;
  overallMinPercent: string;
  maxCompartmentSubjects: string;
  graceMaxPerSubject: string;
  graceMaxTotal: string;
  bestOfSubjects: string;
  absentTreatment: "ZERO_FAIL" | "EXCLUDE";
  medicalTreatment: "ZERO_FAIL" | "EXCLUDE";
  exemptTreatment: "ZERO_FAIL" | "EXCLUDE";
};

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const num = (s: string) => (s.trim() === "" ? null : Number(s));

const adjustFrom = (p: PolicySettings): Adjust => ({
  gradingMode: p.gradingMode,
  usePaperPassMarks: p.usePaperPassMarks,
  subjectMinPercent: str(p.subjectMinPercent),
  overallMinPercent: str(p.overallMinPercent),
  maxCompartmentSubjects: str(p.maxCompartmentSubjects),
  graceMaxPerSubject: str(p.graceMaxPerSubject),
  graceMaxTotal: str(p.graceMaxTotal),
  bestOfSubjects: str(p.bestOfSubjects),
  absentTreatment: p.absentTreatment,
  medicalTreatment: p.medicalTreatment,
  exemptTreatment: p.exemptTreatment
});

const TREATMENTS = [
  { value: "ZERO_FAIL", label: "Count as zero", description: "The subject is failed" },
  { value: "EXCLUDE", label: "Leave out", description: "Not counted in the result" }
];

const MODE_OPTIONS = [
  { value: "saved" as const, label: "A saved policy", description: "Run one of the school's result policies" },
  { value: "adjust" as const, label: "Adjust the rules in force", description: "Change a few rules and see what would happen" }
];

/* AC-15 Preview rules: run a policy on the real marks; nothing is saved or published */
export function PreviewPanel({ source, sectionId, initialPolicyId }: { source: Source; sectionId: string; initialPolicyId?: string }) {
  const policies = useResultPolicies();
  const [mode, setMode] = useState<Mode>("saved");
  const [policyId, setPolicyId] = useState(initialPolicyId ?? "");
  const [adjust, setAdjust] = useState<Adjust | null>(null);
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  /* The policy in force: from the section's sheet, else (exam) which rules apply to the exam */
  const sheetQ = sectionId ? sourcePaths(source).sheet(sectionId) : null;
  const sheet = useApiGet<ResultSheet>(mode === "adjust" && sheetQ ? sheetQ.path : null, sheetQ?.query);
  const resolution = usePolicyResolution(mode === "adjust" && !sectionId && source.kind === "exam" ? source.id : undefined, undefined);
  const base = sheet.data?.policy ?? (resolution.data ? { ...resolution.data.policy, source: resolution.data.source } : null);

  useEffect(() => {
    if (base && !adjust) setAdjust(adjustFrom(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base?.id, base?.name]);
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [source.id, sectionId]);

  const set = <K extends keyof Adjust>(k: K, v: Adjust[K]) => setAdjust(a => (a ? { ...a, [k]: v } : a));

  const run = async () => {
    setError(null);
    let body;
    if (mode === "saved") {
      if (!policyId) return setError("Pick a policy to preview");
      body = { policyId, ...(sectionId ? { sectionId } : {}) };
    } else {
      if (!base || !adjust) return setError("The rules in force are still loading");
      const settings: Record<string, unknown> = {};
      for (const k of POLICY_SETTING_KEYS) settings[k] = (base as unknown as Record<string, unknown>)[k];
      Object.assign(settings, {
        gradingMode: adjust.gradingMode,
        usePaperPassMarks: adjust.usePaperPassMarks,
        subjectMinPercent: num(adjust.subjectMinPercent),
        overallMinPercent: num(adjust.overallMinPercent),
        maxCompartmentSubjects: num(adjust.maxCompartmentSubjects) ?? 0,
        graceMaxPerSubject: num(adjust.graceMaxPerSubject) ?? 0,
        graceMaxTotal: num(adjust.graceMaxTotal) ?? 0,
        bestOfSubjects: num(adjust.bestOfSubjects),
        absentTreatment: adjust.absentTreatment,
        medicalTreatment: adjust.medicalTreatment,
        exemptTreatment: adjust.exemptTreatment
      });
      if (adjust.gradingMode === "PASS_FAIL") settings.rankingMethod = "NONE";
      if (adjust.gradingMode === "GPA" && !settings.gpaScale) settings.gpaScale = 10;
      for (const k of Object.keys(settings)) if (settings[k] === undefined) delete settings[k];
      body = { policy: { ...settings, name: `${base.name} (adjusted)` }, ...(sectionId ? { sectionId } : {}) };
    }
    setRunning(true);
    try {
      const res = await runPreview(source, body);
      setResult(res.data);
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  const fig = (f: PreviewFigures) => [pct(f.percentage), f.grade, f.gpa !== null ? `GPA ${f.gpa}` : null].filter(Boolean).join(" · ") || "—";
  const columns: Column<Preview["changes"][number]>[] = [
    { key: "name", header: "Student", render: c => <span className="nowrap">{studentFullName(c)}</span> },
    { key: "section", header: "Section", render: c => <span className="nowrap">{c.section}</span> },
    {
      key: "result",
      header: "Result now → preview",
      render: c => (
        <span className="row nowrap" style={{ gap: 6 }}>
          <ResultBadge result={c.current.result} /> → <ResultBadge result={c.preview.result} />
        </span>
      )
    },
    {
      key: "figures",
      header: "Figures now → preview",
      render: c => (
        <span className="small nowrap">
          {fig(c.current)} → <strong>{fig(c.preview)}</strong>
        </span>
      )
    },
    {
      key: "rank",
      header: "Rank",
      align: "right",
      render: c => (c.current.rank === c.preview.rank ? (c.current.rank ?? "—") : `${c.current.rank ?? "—"} → ${c.preview.rank ?? "—"}`)
    }
  ];

  const sm = result?.summary;
  const tally = (r: ResultStatus) => (sm ? `${sm.current[r]} → ${sm.preview[r]}` : undefined);

  return (
    <div className="stack">
      <Card
        title="Try a policy"
        subtitle={`Runs on the real marks of ${source.name}${sectionId ? " in the picked section" : " in every section"}. Nothing is saved.`}
      >
        <div className="stack">
          <RadioGroup aria-label="What to preview" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          {mode === "saved" ? (
            <Select
              label="Policy"
              value={policyId}
              onChange={e => setPolicyId(e.target.value)}
              options={policies.policies.map(p => ({
                value: p.id,
                label: p.name,
                description: `${GRADING_MODE_LABELS[p.gradingMode]}${p.isDefault ? " · school default" : ""}`
              }))}
              placeholder={policies.isLoading ? "Loading policies…" : "Pick a policy"}
              required
              error={undefined}
              hint={!policies.isLoading && !policies.policies.length ? "No result policies yet: they are set up under Setup › Grading" : undefined}
            />
          ) : !adjust ? (
            <EmptyState
              icon={<FlaskConical />}
              title={source.kind === "scheme" && !sectionId ? "Pick a section first" : "Loading the rules in force…"}
              message={source.kind === "scheme" && !sectionId ? "The rules in force depend on the class." : undefined}
            />
          ) : (
            <div className="stack">
              {base && (
                <p className="small muted">
                  Starting from {base.name} ({POLICY_SOURCE_LABELS[(base as { source?: string }).source ?? ""] ?? "in force"}). Other rules stay as
                  they are.
                </p>
              )}
              <div className="form-grid">
                <Select
                  label="Grading"
                  value={adjust.gradingMode}
                  required
                  onChange={e => set("gradingMode", e.target.value as GradingMode)}
                  options={(Object.keys(GRADING_MODE_LABELS) as GradingMode[]).map(m => ({ value: m, label: GRADING_MODE_LABELS[m] }))}
                  error={undefined}
                />
                <Field label="Paper pass marks" hint="Each paper's own pass mark decides the subject">
                  <Switch label="Use them" checked={adjust.usePaperPassMarks} onChange={v => set("usePaperPassMarks", v)} />
                </Field>
                <TextInput
                  label="Pass mark per subject (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={adjust.subjectMinPercent}
                  onChange={e => set("subjectMinPercent", e.target.value)}
                  hint="Empty: no subject minimum"
                />
                <TextInput
                  label="Pass mark overall (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={adjust.overallMinPercent}
                  onChange={e => set("overallMinPercent", e.target.value)}
                  hint="Empty: no overall minimum"
                />
                <TextInput
                  label="Compartment subjects allowed"
                  type="number"
                  min={0}
                  max={20}
                  value={adjust.maxCompartmentSubjects}
                  onChange={e => set("maxCompartmentSubjects", e.target.value)}
                  hint="0: failing a subject fails the result"
                />
                <TextInput
                  label="Best of subjects"
                  type="number"
                  min={1}
                  max={30}
                  value={adjust.bestOfSubjects}
                  onChange={e => set("bestOfSubjects", e.target.value)}
                  hint="Empty: every subject counts"
                />
                <TextInput
                  label="Grace marks per subject"
                  type="number"
                  min={0}
                  max={100}
                  value={adjust.graceMaxPerSubject}
                  onChange={e => set("graceMaxPerSubject", e.target.value)}
                  hint="0: no grace"
                />
                <TextInput
                  label="Grace marks in all"
                  type="number"
                  min={0}
                  max={100}
                  value={adjust.graceMaxTotal}
                  onChange={e => set("graceMaxTotal", e.target.value)}
                  hint="At least the per-subject grace"
                />
                <Select
                  label="Absent"
                  value={adjust.absentTreatment}
                  required
                  onChange={e => set("absentTreatment", e.target.value as Adjust["absentTreatment"])}
                  options={TREATMENTS}
                  error={undefined}
                />
                <Select
                  label="Medical"
                  value={adjust.medicalTreatment}
                  required
                  onChange={e => set("medicalTreatment", e.target.value as Adjust["medicalTreatment"])}
                  options={TREATMENTS}
                  error={undefined}
                />
                <Select
                  label="Exempt"
                  value={adjust.exemptTreatment}
                  required
                  onChange={e => set("exemptTreatment", e.target.value as Adjust["exemptTreatment"])}
                  options={TREATMENTS}
                  error={undefined}
                />
              </div>
            </div>
          )}
          <FormActions error={error}>
            <Button variant="primary" icon={<Play />} loading={running} onClick={() => void run()}>
              Run preview
            </Button>
          </FormActions>
        </div>
      </Card>
      {result && (
        <>
          <StatTiles>
            <StatTile label="Students" value={sm!.students} hint={result.policy.name} />
            <StatTile
              label="Results that change"
              value={sm!.resultChanged}
              hint={`${sm!.changed} with any figure changed`}
              hintTone={sm!.resultChanged ? "warn" : "good"}
            />
            <StatTile label={RESULT_LABELS.PASS} value={tally("PASS")} hint="now → preview" />
            <StatTile
              label={RESULT_LABELS.FAIL}
              value={tally("FAIL")}
              hint={`Compartment ${tally("COMPARTMENT")} · incomplete ${tally("INCOMPLETE")}`}
            />
          </StatTiles>
          <Card flush title="Students whose results would change">
            <DataTable
              columns={columns}
              rows={result.changes}
              rowKey={c => c.studentId}
              empty={
                <EmptyState
                  icon={<FlaskConical />}
                  title="No result would change"
                  message="Under this policy every student keeps the same figures."
                />
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}
