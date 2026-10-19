import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/common/api";
import { useApiMutation } from "@/common/hooks";
import { Button, Dialog, Select, Textarea, useToast } from "@/common/ui";
import { enumLabel } from "@/common/utils/format";
import { useMoney } from "../../shared";

/* The two setup changes made from a student's account (FI-11): their installment plan for a
   year (FI-02) and a concession grant (FI-05). Small dialogs prefilled with the student. */

type PlanRow = { id: string; name: string; installmentCount?: number; installments?: unknown[] };
type ConcessionRow = { id: string; name: string; category: string; concessionType: "PERCENT" | "FIXED"; value: number; description: string | null };

const DEFAULT_PLAN = "__default__";

export function ChangePlanDialog({
  open,
  onClose,
  studentId,
  studentName,
  academicYearId,
  yearName,
  currentPlanId
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  academicYearId: string;
  yearName: string;
  currentPlanId: string | null;
}) {
  const toast = useToast();
  const [planId, setPlanId] = useState(currentPlanId ?? DEFAULT_PLAN);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setPlanId(currentPlanId ?? DEFAULT_PLAN);
      setError(null);
    }
  }, [open, currentPlanId]);

  /* Plans of the account's year, not the header's */
  const plans = useQuery({
    queryKey: ["/finance/installment-plans", { academicYearId, all: true }],
    enabled: open,
    queryFn: async () => (await api.get<PlanRow[]>("/finance/installment-plans", { limit: 100 }, { academicYearId })).data
  });
  const assign = useApiMutation(
    (installmentPlanId: string | null) => api.post("/finance/plan-assignments", { studentId, installmentPlanId }, { academicYearId }),
    { invalidate: ["/finance/"] }
  );

  const options = useMemo(
    () => [
      { value: DEFAULT_PLAN, label: "The fee structure's default", description: "No plan of their own" },
      ...(plans.data ?? []).map(p => {
        const n = p.installmentCount ?? p.installments?.length ?? 0;
        return { value: p.id, label: p.name, description: `${n} installment${n === 1 ? "" : "s"}` };
      })
    ],
    [plans.data]
  );

  const submit = () => {
    setError(null);
    assign.mutate(planId === DEFAULT_PLAN ? null : planId, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => setError(errorMessage(err))
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Change ${studentName}'s plan`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={assign.isPending} disabled={planId === (currentPlanId ?? DEFAULT_PLAN)} onClick={submit}>
            Change plan
          </Button>
        </>
      }
    >
      <div className="stack">
        <Select
          label={`Installment plan for ${yearName}`}
          value={planId}
          onChange={e => setPlanId(e.target.value)}
          options={options}
          placeholder={plans.isLoading ? "Loading plans…" : undefined}
          required
          error={undefined}
          hint="Possible only while nothing of the year is paid."
        />
        <p className="small muted">Unpaid invoices of the year are cancelled and issued again under the new plan.</p>
      </div>
    </Dialog>
  );
}

export function GrantConcessionDialog({
  open,
  onClose,
  studentId,
  studentName,
  academicYearId,
  yearName,
  granted
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  academicYearId: string;
  yearName: string;
  /* Concession ids the student already has this year */
  granted: string[];
}) {
  const toast = useToast();
  const money = useMoney();
  const [concessionId, setConcessionId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setConcessionId("");
      setReason("");
      setErrors({});
      setError(null);
    }
  }, [open]);

  const concessions = useQuery({
    queryKey: ["/finance/concessions", { all: true }],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => (await api.get<ConcessionRow[]>("/finance/concessions", { limit: 100 })).data
  });
  const grant = useApiMutation(
    () => api.post("/finance/concession-grants", { studentId, concessionId, academicYearId, reason: reason.trim() || undefined }),
    { invalidate: ["/finance/"] }
  );

  const options = (concessions.data ?? []).map(c => ({
    value: c.id,
    label: c.name,
    disabled: granted.includes(c.id),
    description: `${c.concessionType === "PERCENT" ? `${c.value}%` : `${money(c.value)} a year`} · ${enumLabel(c.category)}${granted.includes(c.id) ? " · already granted" : ""}`
  }));

  const submit = () => {
    if (!concessionId) {
      setErrors({ concessionId: "Pick a concession" });
      return;
    }
    setError(null);
    grant.mutate(undefined, {
      onSuccess: res => {
        toast.success(res.message);
        onClose();
      },
      onError: err => setError(errorMessage(err))
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Grant a concession to ${studentName}`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={grant.isPending} onClick={submit}>
            Grant concession
          </Button>
        </>
      }
    >
      <div className="stack">
        <Select
          label="Concession"
          value={concessionId}
          onChange={e => {
            setConcessionId(e.target.value);
            setErrors({});
          }}
          options={options}
          placeholder={concessions.isLoading ? "Loading…" : "Pick a concession"}
          required
          error={errors.concessionId}
          hint={`For ${yearName}. It lowers the invoices that have nothing paid yet.`}
        />
        <Textarea label="Reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500} />
      </div>
    </Dialog>
  );
}
