import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Select, TextInput, useToast } from "@/common/ui";
import { createExams, EXAMS_PATH, EXAM_TYPE_LABELS, EXAM_TYPES, type ExamInput, type ExamType } from "../api/exams";

type Row = {
  key: number;
  examName: string;
  examType: ExamType;
  startDate: string;
  endDate: string;
};

let seq = 0;
const blank = (examName = "", examType: ExamType = "INTERNAL"): Row => ({
  key: ++seq,
  examName,
  examType,
  startDate: "",
  endDate: ""
});

const TYPE_OPTIONS = EXAM_TYPES.map(t => ({
  value: t,
  label: EXAM_TYPE_LABELS[t]
}));

/* AC-13: several exams of the header's year in one all-or-nothing request (the year's plan).
   Each row's problem shows in its own reserved line. Mount it when opened. */
export function BulkExamsDialog({ open, onClose, yearName, existing }: { open: boolean; onClose: () => void; yearName: string; existing: string[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => [blank("Unit Test 1"), blank("Half-Yearly Examination"), blank("Annual Examination", "FINAL")]);
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useApiMutation(createExams, { invalidate: [EXAMS_PATH] });

  const taken = new Set(existing.map(n => n.trim().toLowerCase()));
  const filled = rows.filter(r => r.examName.trim());
  const problemOf = (r: Row, i: number) => {
    const name = r.examName.trim().toLowerCase();
    if (!name) return r.startDate || r.endDate ? "Give the exam a name" : null;
    if (taken.has(name)) return `${yearName} already has an exam with this name`;
    if (rows.findIndex(o => o.examName.trim().toLowerCase() === name) < i) return "This name is repeated";
    if (r.startDate && r.endDate && r.endDate < r.startDate) return "Ends before it starts";
    return serverErrors[r.key] ?? null;
  };
  const problems = rows.map(problemOf);
  const ready = filled.length > 0 && problems.every(p => !p);

  const change = (key: number, patch: Partial<Row>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setServerErrors({});
    setFormError(null);
  };

  const submit = () => {
    const sent = rows.filter(r => r.examName.trim());
    const body: ExamInput[] = sent.map(r => ({
      examName: r.examName.trim(),
      examType: r.examType,
      ...(r.startDate ? { startDate: r.startDate } : {}),
      ...(r.endDate ? { endDate: r.endDate } : {})
    }));
    mutation.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => {
        if (isApiError(err) && err.isValidation) {
          const byRow: Record<number, string> = {};
          const other: string[] = [];
          for (const d of err.details) {
            const m = /^exams\.(\d+)\.(\w+)$/.exec(d.field);
            const row = m ? sent[Number(m[1])] : undefined;
            if (row) byRow[row.key] ??= `${m![2] === "examName" ? "Name" : m![2]}: ${d.message}`;
            else other.push(d.message);
          }
          setServerErrors(byRow);
          setFormError(other.length ? other.join("; ") : "Fix the rows marked in red. Nothing was created.");
          return;
        }
        setFormError(`${errorMessage(err).replace(/\.$/, "")}. Nothing was created.`);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={`Plan exams for ${yearName}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!ready} onClick={submit}>
            {filled.length ? `Create ${filled.length} exam${filled.length === 1 ? "" : "s"}` : "Create exams"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted small">Rows without a name are skipped. Dates are optional; grade scales and papers are set on each exam afterwards.</p>
        <div className="bulk-exams">
          <div className="bulk-exams-head" aria-hidden>
            <span>Name</span>
            <span>Type</span>
            <span>Starts</span>
            <span>Ends</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="bulk-exams-row">
              <TextInput
                aria-label={`Name of exam ${i + 1}`}
                value={r.examName}
                maxLength={100}
                onChange={e => change(r.key, { examName: e.target.value })}
                error={problems[i]}
              />
              <Select
                aria-label={`Type of exam ${i + 1}`}
                options={TYPE_OPTIONS}
                value={r.examType}
                required
                onChange={e => change(r.key, { examType: e.target.value as ExamType })}
                error={undefined}
              />
              <TextInput
                aria-label={`Start of exam ${i + 1}`}
                type="date"
                value={r.startDate}
                onChange={e => change(r.key, { startDate: e.target.value })}
                error={undefined}
              />
              <TextInput
                aria-label={`End of exam ${i + 1}`}
                type="date"
                value={r.endDate}
                min={r.startDate || undefined}
                onChange={e => change(r.key, { endDate: e.target.value })}
                error={undefined}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 />}
                aria-label={`Remove row ${i + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows(rs => rs.filter(o => o.key !== r.key))}
              />
            </div>
          ))}
        </div>
        <div>
          <Button size="sm" icon={<Plus />} disabled={rows.length >= 20} onClick={() => setRows(rs => [...rs, blank()])}>
            Add a row
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
