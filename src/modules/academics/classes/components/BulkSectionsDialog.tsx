import { useState } from "react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Alert, Button, Dialog, TextInput, useToast } from "@/common/ui";
import type { SchoolClass } from "../api/classes";
import { createSections, SECTIONS_PATH, type SectionInput } from "../api/sections";

const parseNames = (text: string) => [...new Set(text.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
const VALID = /^[A-Z0-9]{1,5}$/;

/* Several sections of one class in the header's year, sent as one all-or-nothing request. Mount it when opened. */
export function BulkSectionsDialog({
  open,
  onClose,
  klass,
  existing,
  yearName
}: {
  open: boolean;
  onClose: () => void;
  klass: SchoolClass;
  existing: string[];
  yearName: string;
}) {
  const toast = useToast();
  /* Suggest the next three free letters */
  const [names, setNames] = useState(() =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !existing.includes(l)).slice(0, 3).join(", ")
  );
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useApiMutation(createSections, { invalidate: [SECTIONS_PATH] });

  const parsed = parseNames(names);
  const invalid = parsed.filter(n => !VALID.test(n));
  const taken = parsed.filter(n => existing.includes(n));
  const cap = capacity ? Number(capacity) : undefined;
  const capOk = cap === undefined || (Number.isInteger(cap) && cap >= 1 && cap <= 500);
  const ready = parsed.length > 0 && !invalid.length && !taken.length && capOk;

  const submit = () => {
    setError(null);
    const rows: SectionInput[] = parsed.map(sectionName => ({ classId: klass.id, sectionName, ...(cap ? { capacity: cap } : {}) }));
    mutation.mutate(rows, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err =>
        setError(
          isApiError(err) && err.status === 409
            ? `One of these sections already exists in ${klass.className} for ${yearName}. Nothing was created.`
            : errorMessage(err)
        )
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add sections to ${klass.className}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!ready} onClick={submit}>
            {parsed.length ? `Create ${parsed.length} section${parsed.length === 1 ? "" : "s"}` : "Create sections"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted small">Sections belong to {yearName}. You can set class teachers on each one afterwards.</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <TextInput
          label="Section names"
          value={names}
          onChange={e => setNames(e.target.value)}
          hint="Separate with commas or spaces, e.g. A, B, C"
          error={
            invalid.length
              ? `Not valid: ${invalid.join(", ")} (1 to 5 letters or digits)`
              : taken.length
                ? `Already in ${klass.className}: ${taken.join(", ")}`
                : undefined
          }
        />
        <TextInput
          label="Capacity of each"
          type="number"
          min={1}
          max={500}
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
          hint="Optional"
          error={capOk ? undefined : "A whole number from 1 to 500"}
        />
        {parsed.length > 0 && (
          <div className="row">
            {parsed.map(n => (
              <span key={n} className="chip">
                {klass.className} – {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
