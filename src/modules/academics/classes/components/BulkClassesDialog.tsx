import { useState } from "react";
import { useApiMutation } from "@/common/hooks";
import { Alert, Button, Dialog, TextInput, useToast } from "@/common/ui";
import { errorMessage } from "@/common/api";
import { CLASSES_PATH, createClasses, type ClassInput } from "../api/classes";
import { classConflict } from "../utils/errors";

/* "Class {n}" for n = from…to, order n. One all-or-nothing request. Mount it when opened (fresh state). */
export function BulkClassesDialog({ open, onClose, usedOrders }: { open: boolean; onClose: () => void; usedOrders: Set<number> }) {
  const toast = useToast();
  const [pattern, setPattern] = useState("Class {n}");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("12");
  const [error, setError] = useState<string | null>(null);
  const mutation = useApiMutation(createClasses, { invalidate: [CLASSES_PATH] });

  const a = Number(from);
  const b = Number(to);
  const rangeOk = Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b <= 50 && a <= b;
  const rows: ClassInput[] = rangeOk
    ? Array.from({ length: b - a + 1 }, (_, i) => ({ className: pattern.replace(/\{n\}/g, String(a + i)).trim(), classOrder: a + i }))
    : [];
  const clashes = rows.filter(r => usedOrders.has(r.classOrder)).map(r => r.classOrder);
  const patternOk = pattern.includes("{n}") && pattern.replace("{n}", "").trim().length > 0;

  const submit = () => {
    setError(null);
    mutation.mutate(rows, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => {
        const fields = classConflict(err);
        setError(fields ? `${Object.values(fields)[0]}. Nothing was created.` : errorMessage(err));
      }
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add many classes"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!rows.length || !patternOk || clashes.length > 0} onClick={submit}>
            {rows.length ? `Create ${rows.length} classes` : "Create classes"}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error && <Alert tone="danger">{error}</Alert>}
        <TextInput
          label="Name pattern"
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          hint="{n} becomes the number, e.g. Class {n} or Grade {n}"
          error={pattern && !patternOk ? "Include {n} and some text" : undefined}
        />
        <div className="form-grid">
          <TextInput label="From" type="number" min={1} max={50} value={from} onChange={e => setFrom(e.target.value)} />
          <TextInput
            label="To"
            type="number"
            min={1}
            max={50}
            value={to}
            onChange={e => setTo(e.target.value)}
            error={!rangeOk ? "Use numbers from 1 to 50, From ≤ To" : undefined}
          />
        </div>
        {clashes.length > 0 && <Alert tone="warning">Order {clashes.join(", ")} is already used by another class. Change the range.</Alert>}
        {rows.length > 0 && patternOk && (
          <div className="small">
            <div className="section-title" style={{ marginBottom: 6 }}>
              Preview (order · name)
            </div>
            <div className="row">
              {rows.map(r => (
                <span key={r.classOrder} className="chip">
                  {r.classOrder} · {r.className}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
