import { useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation } from "@/common/hooks";
import { Badge, Button, Drawer, Field, Select, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { createScheme, deleteScheme, SCHEMES_PATH, updateScheme, useExamOptions, type AssessmentScheme, type SchemeInput } from "../api/assessmentSchemes";
import { usePolicyOptions } from "../api/resultPolicies";

type Row = { key: number; examId: string; weight: string };
let seq = 0;

const rowsOf = (s: AssessmentScheme | null): Row[] =>
  s ? s.exams.map(e => ({ key: ++seq, examId: e.examId, weight: String(e.weight) })) : [{ key: ++seq, examId: "", weight: "" }, { key: ++seq, examId: "", weight: "" }];

const examsOf = (rows: Row[]) => rows.filter(r => r.examId).map(r => ({ examId: r.examId, weight: Number(r.weight) }));

/* AC-06 scheme editor: a name, its own policy (optional) and exams with weights that add up
   to 100, with a running total. Configuration only: publishing is on the exams pages.
   Read-only without manage or in an archived year. Mount it when opened. */
export function SchemeDrawer({ scheme, canManage, onClose }: { scheme: AssessmentScheme | null; canManage: boolean; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year } = useAcademicYear();
  const exams = useExamOptions();
  const policies = usePolicyOptions();
  const create = useApiMutation(createScheme, { invalidate: [SCHEMES_PATH] });
  const update = useApiMutation(updateScheme, { invalidate: [SCHEMES_PATH] });
  const remove = useApiMutation(deleteScheme, { invalidate: [SCHEMES_PATH] });
  const [name, setName] = useState(scheme?.name ?? "");
  const [description, setDescription] = useState(scheme?.description ?? "");
  const [policyId, setPolicyId] = useState(scheme?.policyId ?? "");
  const [rows, setRows] = useState<Row[]>(() => rowsOf(scheme));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const disabled = !canManage;

  const total = Math.round(rows.reduce((t, r) => t + (r.examId && Number.isFinite(Number(r.weight)) ? Number(r.weight) : 0), 0) * 100) / 100;
  const used = rows.map(r => r.examId);

  const body = (): SchemeInput => ({
    name: name.trim(),
    description: description.trim(),
    policyId: policyId || null,
    exams: examsOf(rows)
  });

  let changes: SchemeInput | null = null;
  if (scheme) {
    const now = body();
    const out: SchemeInput = {};
    if (now.name !== scheme.name) out.name = now.name;
    if (now.description !== (scheme.description ?? "")) out.description = now.description;
    if ((now.policyId ?? null) !== (scheme.policyId ?? null)) out.policyId = now.policyId;
    if (JSON.stringify(now.exams) !== JSON.stringify(scheme.exams.map(e => ({ examId: e.examId, weight: e.weight })))) out.exams = now.exams;
    changes = out;
  }
  const unchanged = !!changes && Object.keys(changes).length === 0;

  const setRow = (key: number, patch: Partial<Row>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setErrors(({ exams: _drop, ...rest }) => rest);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Give the scheme a name, e.g. Term 1";
    const picked = rows.filter(r => r.examId);
    if (!picked.length) errs.exams = "Add at least one exam";
    else if (picked.some(r => !(Number(r.weight) > 0 && Number(r.weight) <= 100))) errs.exams = "Each exam needs a weight above 0, up to 100";
    else if (total !== 100) errs.exams = `The weights add up to ${total}; they must add up to 100`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && err.isValidation) {
        const fe = err.fieldErrors();
        setErrors({ ...(fe.name ? { name: fe.name } : {}), ...(Object.keys(fe).some(k => k.startsWith("exams")) ? { exams: Object.entries(fe).find(([k]) => k.startsWith("exams"))![1] } : {}) });
        setFormError("Please correct the highlighted fields.");
      } else if (isApiError(err) && err.status === 422) setErrors({ exams: err.message });
      else setFormError(errorMessage(err));
    };
    if (scheme) update.mutate({ id: scheme.id, ...changes }, { onSuccess: done, onError });
    else {
      const b = body();
      if (!b.description) delete b.description;
      if (!b.policyId) delete b.policyId;
      create.mutate(b, { onSuccess: done, onError });
    }
  };

  const askDelete = async () => {
    if (!scheme) return;
    const ok = await confirm({
      title: `Delete ${scheme.name}?`,
      message: `${scheme.name} and its weights are removed. The exams and their marks stay.${scheme.resultsPublishedAt ? " Its results are published: withdraw them first." : ""}`,
      confirmLabel: "Delete scheme"
    });
    if (ok)
      remove.mutate(scheme.id, {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => toast.error(err)
      });
  };

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={scheme ? scheme.name : "New assessment scheme"}
      subtitle={
        scheme?.resultsPublishedAt ? (
          <Badge tone="success">Results published {formatDate(scheme.resultsPublishedAt)}</Badge>
        ) : (
          `Combines exams of ${year?.yearName ?? "the year"} into one result, e.g. a term or the year`
        )
      }
      footerStatus={formError}
      footer={
        canManage ? (
          <>
            {scheme && (
              <Button variant="ghost" icon={<Trash2 />} loading={remove.isPending} onClick={() => void askDelete()}>
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="scheme-form" variant="primary" loading={create.isPending || update.isPending} disabled={unchanged}>
              {scheme ? "Save changes" : "Create scheme"}
            </Button>
          </>
        ) : undefined
      }
    >
      <form id="scheme-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required maxLength={100} placeholder="Term 1" disabled={disabled} value={name} error={errors.name} onChange={e => setName(e.target.value)} />
          <Select
            label="Result policy"
            options={policies.options}
            value={policyId}
            placeholder="The class's policy or the school default"
            hint="Its own rules for this result, if it needs any"
            disabled={disabled}
            onChange={e => setPolicyId(e.target.value)}
          />
        </div>
        <Textarea label="Description" rows={2} maxLength={1000} disabled={disabled} value={description} onChange={e => setDescription(e.target.value)} />
        <Field label="Exams and weights" error={errors.exams} hint={`Total ${total} of 100`}>
          <div className="stack-sm">
            <div className="weights">
              {rows.map((r, i) => (
                <div key={r.key} className="weights-row">
                  <Select
                    aria-label={`Exam ${i + 1}`}
                    options={exams.options.map(o => ({ ...o, disabled: o.value !== r.examId && used.includes(o.value) }))}
                    value={r.examId}
                    placeholder={exams.isLoading ? "Loading exams…" : "Pick an exam"}
                    disabled={disabled}
                    onChange={e => setRow(r.key, { examId: e.target.value })}
                  />
                  <div className="input-group weights-weight">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      aria-label={`Weight of exam ${i + 1}`}
                      placeholder="0"
                      value={r.weight}
                      disabled={disabled}
                      onChange={e => setRow(r.key, { weight: e.target.value })}
                    />
                    <span className="weights-pct">%</span>
                  </div>
                  <Button size="sm" variant="ghost" icon={<X />} aria-label={`Remove exam ${i + 1}`} disabled={disabled || rows.length <= 1} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} />
                </div>
              ))}
            </div>
            <div className="weights-total">
              <div className="progress" aria-hidden>
                <div style={{ width: `${Math.min(total, 100)}%`, background: total === 100 ? "var(--success)" : total > 100 ? "var(--danger)" : "var(--primary)" }} />
              </div>
              <span className={total === 100 ? "" : "muted"}>{total} / 100</span>
            </div>
            {!disabled && (
              <div>
                <Button size="sm" icon={<Plus />} disabled={rows.length >= 12} onClick={() => setRows(rs => [...rs, { key: ++seq, examId: "", weight: "" }])}>
                  Add an exam
                </Button>
              </div>
            )}
          </div>
        </Field>
      </form>
    </Drawer>
  );
}
