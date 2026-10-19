import { useState } from "react";
import { Plus, X } from "lucide-react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Checkbox, Dialog, Select, useToast } from "@/common/ui";
import "../../shared/components/setup.css";
import { createSubjects, SUBJECT_CODE, SUBJECT_TYPES, SUBJECTS_PATH, type SubjectInput, type SubjectType } from "../api/subjects";

type Row = { key: number; subjectCode: string; subjectName: string; subjectType: SubjectType; isOptional: boolean };

let seq = 0;
const blank = (): Row => ({ key: ++seq, subjectCode: "", subjectName: "", subjectType: "THEORY", isOptional: false });

const MAX_ROWS = 50;

/* "Add several": one row per subject, sent as one all-or-nothing request. Each row keeps a
   reserved line for its error ("subjects.2.subjectCode repeats subjects.0"). Mount it when opened. */
export function BulkSubjectsDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => [blank(), blank(), blank(), blank()]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const mutation = useApiMutation(createSubjects, { invalidate: [SUBJECTS_PATH] });

  const filled = rows.filter(r => r.subjectCode.trim() || r.subjectName.trim());
  const set = (key: number, patch: Partial<Row>) => {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
    setRowErrors(e => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const submit = () => {
    setError(null);
    const errs: Record<number, string> = {};
    for (const r of filled) {
      const code = r.subjectCode.trim().toUpperCase();
      if (!code || !r.subjectName.trim()) errs[r.key] = "Needs both a code and a name";
      else if (!SUBJECT_CODE.test(code)) errs[r.key] = "Code: 2–10 letters, digits or -, starting with a letter";
    }
    setRowErrors(errs);
    if (Object.keys(errs).length) {
      setError("Please correct the highlighted rows.");
      return;
    }
    const body: SubjectInput[] = filled.map(r => ({
      subjectCode: r.subjectCode.trim().toUpperCase(),
      subjectName: r.subjectName.trim(),
      subjectType: r.subjectType,
      isOptional: r.isOptional
    }));
    mutation.mutate(body, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => {
        /* "subjects.2.subjectCode": put it on that row */
        if (isApiError(err) && err.details.length) {
          const mapped: Record<number, string> = {};
          for (const d of err.details) {
            const m = /^subjects\.(\d+)\.?(\w*)/.exec(d.field);
            const row = m ? filled[Number(m[1])] : undefined;
            if (row && !mapped[row.key]) mapped[row.key] = `${m![2] === "subjectName" ? "Name" : m![2] === "subjectCode" ? "Code" : "Row"} ${d.message}`;
          }
          setRowErrors(mapped);
        }
        setError(`${errorMessage(err).replace(/\.$/, "")}. Nothing was created.`);
      }
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Add subjects"
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!filled.length} onClick={submit}>
            {filled.length ? `Create ${filled.length} subject${filled.length === 1 ? "" : "s"}` : "Create subjects"}
          </Button>
        </>
      }
    >
      <div className="stack-sm">
        <p className="small muted">Empty rows are skipped. Subjects can't be deleted later, so check the codes.</p>
        <div className="bulk-subjects">
          <div className="bulk-subjects-head" aria-hidden>
            <span>Code</span>
            <span>Name</span>
            <span>Type</span>
            <span>Optional</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={r.key} className="bulk-subjects-row">
              <div className="bulk-subjects-fields">
                <input
                  className={`input${rowErrors[r.key] ? " invalid" : ""}`}
                  aria-label={`Row ${i + 1} code`}
                  placeholder="MAT"
                  maxLength={10}
                  value={r.subjectCode}
                  onChange={e => set(r.key, { subjectCode: e.target.value.toUpperCase() })}
                />
                <input
                  className={`input${rowErrors[r.key] ? " invalid" : ""}`}
                  aria-label={`Row ${i + 1} name`}
                  placeholder="Mathematics"
                  maxLength={100}
                  value={r.subjectName}
                  onChange={e => set(r.key, { subjectName: e.target.value })}
                />
                <Select
                  aria-label={`Row ${i + 1} type`}
                  options={SUBJECT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                  value={r.subjectType}
                  required
                  onChange={e => set(r.key, { subjectType: e.target.value as SubjectType })}
                />
                <Checkbox aria-label={`Row ${i + 1} optional`} checked={r.isOptional} onChange={e => set(r.key, { isOptional: e.target.checked })} />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X />}
                  aria-label={`Remove row ${i + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                />
              </div>
              <div className={`field-message${rowErrors[r.key] ? " field-error" : ""}`}>{rowErrors[r.key]}</div>
            </div>
          ))}
        </div>
        <div>
          <Button size="sm" icon={<Plus />} disabled={rows.length >= MAX_ROWS} onClick={() => setRows(rs => [...rs, blank()])}>
            Add row
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
