import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isApiError } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Select, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { fetchAllPages } from "@/modules/users/shared";
import { addMonths, monthLabel, monthOf, monthRange } from "../../shared/utils/format";
import { RUNS_PATH, runPayroll, type PayrollRun } from "../api/payroll";

/* Create a DRAFT run for a month (one per month; future months can't be run) */
export function RunPayrollDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const thisMonth = monthOf(todayIso());
  const runs = useQuery({
    queryKey: [RUNS_PATH, "all"],
    enabled: open,
    queryFn: async () => (await fetchAllPages<PayrollRun>(RUNS_PATH, {}, 500)).rows
  });
  const byMonth = new Map((runs.data ?? []).map(r => [r.month, r]));
  const firstFree = monthRange(addMonths(thisMonth, -18), thisMonth)
    .reverse()
    .find(m => !byMonth.has(m) && m >= (runs.data?.[0]?.month ?? ""));

  const [month, setMonth] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const run = useApiMutation(runPayroll, { invalidate: [RUNS_PATH] });

  useEffect(() => {
    if (open) {
      setNotes("");
      setError(null);
      setFormError(null);
    }
  }, [open]);
  /* Default: the oldest month after the latest run, else this month */
  useEffect(() => {
    if (open && runs.data) setMonth(firstFree ?? thisMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runs.data]);

  const options = monthRange(addMonths(thisMonth, -18), thisMonth).map(m => {
    const existing = byMonth.get(m);
    return {
      value: m,
      label: monthLabel(m),
      disabled: !!existing,
      description: existing ? `Already run (${existing.status === "FINALIZED" ? "finalized" : "draft"})` : m === thisMonth ? "This month, so far" : undefined
    };
  });

  const submit = () => {
    if (!month) return setError("Pick the month");
    run.mutate(
      { month, notes: notes.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
          navigate(`${RUNS_PATH}/${res.data.id}`, { state: { withoutSalary: res.data.withoutSalary ?? [] } });
        },
        onError: err => {
          if (isApiError(err) && (err.status === 409 || err.status === 422)) setError(err.message);
          else setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Run payroll"
      footerStatus={formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={run.isPending} disabled={runs.isLoading} onClick={submit}>
            Run payroll
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          Computes a draft payslip for every employee with a salary, from attendance and approved leave. Nothing is final until you finalize it.
        </p>
        <Select
          label="Month"
          required
          value={month}
          placeholder={runs.isLoading ? "Loading…" : "Pick a month"}
          error={error}
          options={options}
          onChange={e => {
            setMonth(e.target.value);
            setError(null);
          }}
        />
        <Textarea label="Notes" rows={2} maxLength={500} value={notes} placeholder="Salaries for October" onChange={e => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}
