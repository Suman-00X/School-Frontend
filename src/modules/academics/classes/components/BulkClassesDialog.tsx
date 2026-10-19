import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage, isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Field, useToast } from "@/common/ui";
import { CLASS_LEVELS_PATH, CLASSES_PATH, createClasses, type ClassLevel, type LevelRow } from "../api/classes";
import { LevelPicker } from "./LevelPicker";

/* "Add classes": tick the levels the school doesn't have yet (e.g. LKG … Class 12), sent as one
   all-or-nothing request. The grid always has every level, so the dialog never changes size.
   Mount it when opened (fresh state). */
export function BulkClassesDialog({ open, onClose, levels }: { open: boolean; onClose: () => void; levels: LevelRow[] | undefined }) {
  const toast = useToast();
  const qc = useQueryClient();
  const missing = (levels ?? []).filter(l => !l.created).map(l => l.level);
  /* Nothing ticked to start with: classes can't be deleted */
  const [picked, setPicked] = useState<ClassLevel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useApiMutation(createClasses, { invalidate: [CLASSES_PATH] });

  const chosen = picked.filter(l => missing.includes(l));
  const ordered = (levels ?? []).filter(l => chosen.includes(l.level));

  const submit = () => {
    setError(null);
    mutation.mutate(
      ordered.map(l => ({ level: l.level })),
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          /* Someone created one meanwhile ("A class named Class 1 already exists"): refresh the grid */
          if (isApiError(err) && err.status === 409) void qc.invalidateQueries({ queryKey: [CLASS_LEVELS_PATH] });
          setError(`${errorMessage(err).replace(/\.$/, "")}. Nothing was created.`);
        }
      }
    );
  };

  const hint = !levels
    ? "Loading the levels…"
    : !missing.length
      ? "Every level already has a class."
      : `${chosen.length} of ${missing.length} missing level${missing.length === 1 ? "" : "s"} ticked. Greyed: already created.`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Add classes"
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!ordered.length} onClick={submit}>
            {ordered.length ? `Create ${ordered.length} class${ordered.length === 1 ? "" : "es"}` : "Create classes"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row-between">
          <p className="muted small">Classes are fixed levels, named and ordered for you. Add the ones your school teaches.</p>
          <div className="row" style={{ flexShrink: 0 }}>
            <Button size="sm" variant="ghost" disabled={!missing.length} onClick={() => setPicked(missing)}>
              All
            </Button>
            <Button size="sm" variant="ghost" disabled={!missing.length} onClick={() => setPicked([])}>
              None
            </Button>
          </div>
        </div>
        <Field hint={hint}>
          <LevelPicker label="Levels to create" mode="many" levels={levels} value={chosen} onChange={setPicked} />
        </Field>
      </div>
    </Dialog>
  );
}
