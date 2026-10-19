import { useState } from "react";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, TextInput, useToast } from "@/common/ui";
import type { SchoolClass } from "../api/classes";
import { createSections, SECTIONS_PATH, type SectionInput } from "../api/sections";

/* The API's format: 1–5 letters or digits, upper-cased */
const VALID = /^[A-Z0-9]{1,5}$/;

/* "a, b c;B" -> ["A", "B", "C", "B"]: order and repeats kept, so repeats can be pointed out */
const tokens = (text: string) => text.toUpperCase().split(/[\s,;]+/).filter(Boolean);

type Item = { name: string; problem: string | null };

/* Several sections of one class in the header's year, sent as one all-or-nothing request.
   Problems (format, repeats, existing sections, the server's per-item errors) are shown in the
   field's message line and on the item's chip; the preview keeps a fixed height. Mount it when opened. */
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
  /* The server's refusals, by section name (cleared when the names change) */
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useApiMutation(createSections, { invalidate: [SECTIONS_PATH] });

  const items: Item[] = tokens(names).map((name, i, all) => ({
    name,
    problem: !VALID.test(name)
      ? `${name} is not valid: use 1 to 5 letters or digits`
      : all.indexOf(name) < i
        ? `${name} is repeated`
        : existing.includes(name)
          ? `${klass.className} already has section ${name} in ${yearName}`
          : (serverErrors[name] ?? null)
  }));
  const firstProblem = items.find(i => i.problem)?.problem;
  const cap = capacity ? Number(capacity) : undefined;
  const capOk = cap === undefined || (Number.isInteger(cap) && cap >= 1 && cap <= 500);
  const ready = items.length > 0 && !firstProblem && capOk;

  const changeNames = (text: string) => {
    setNames(text);
    setServerErrors({});
    setFormError(null);
  };

  const submit = () => {
    setFormError(null);
    const rows: SectionInput[] = items.map(i => ({ classId: klass.id, sectionName: i.name, ...(cap ? { capacity: cap } : {}) }));
    mutation.mutate(rows, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => {
        if (isApiError(err) && err.isValidation) {
          /* "sections.1.sectionName" "repeats sections.0 in this request" -> the item it is about */
          const byName: Record<string, string> = {};
          const other: string[] = [];
          for (const d of err.details) {
            const m = /^sections\.(\d+)\.(\w+)$/.exec(d.field);
            const row = m ? rows[Number(m[1])] : undefined;
            if (!row || !m) {
              other.push(`${d.field} ${d.message}`);
              continue;
            }
            const repeat = /^repeats sections\.(\d+)/.exec(d.message);
            const label = m[2] === "capacity" ? `Capacity of ${row.sectionName}` : row.sectionName;
            byName[row.sectionName] ??= repeat
              ? `${row.sectionName} repeats ${rows[Number(repeat[1])]?.sectionName ?? "another item"}`
              : `${label}: ${d.message}`;
          }
          setServerErrors(byName);
          if (other.length) setFormError(other.join("; "));
          return;
        }
        /* "Section B already exists in this class for this academic year" */
        const taken = isApiError(err) && err.status === 409 ? /Section (\w+) already exists/i.exec(err.message) : null;
        if (taken) return setServerErrors({ [taken[1].toUpperCase()]: err.message });
        setFormError(`${errorMessage(err).replace(/\.$/, "")}. Nothing was created.`);
      }
    });
  };

  const count = items.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add sections to ${klass.className}`}
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!ready} onClick={submit}>
            {count ? `Create ${count} section${count === 1 ? "" : "s"}` : "Create sections"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted small">Sections belong to {yearName}. You can set class teachers on each one afterwards.</p>
        <TextInput
          label="Section names"
          value={names}
          autoFocus
          autoCapitalize="characters"
          onChange={e => changeNames(e.target.value.toUpperCase())}
          hint="1 to 5 letters or digits each, separated by commas or spaces, e.g. A, B, C"
          error={firstProblem}
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
        <div className="section-preview" aria-label="Sections to create">
          {count ? (
            items.map((i, n) => (
              <span key={`${i.name}-${n}`} className={`chip${i.problem ? " chip-danger" : ""}`} title={i.problem ?? undefined} style={{ paddingRight: 10 }}>
                {klass.className} – {i.name}
              </span>
            ))
          ) : (
            <span className="muted small">The sections to create appear here.</span>
          )}
        </div>
      </div>
    </Dialog>
  );
}
