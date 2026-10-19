import { useEffect, useState, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, TextInput, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import {
  ASSIGNMENTS_PATH,
  createPlan,
  installmentsLabel,
  PLANS_PATH,
  updatePlan,
  usePlanHasInvoices,
  type InstallmentPlan,
  type PlanInput
} from "../api/installmentPlans";
import { gridProblem, InstallmentGrid, newRow, rowsFrom, shareTotal, toInput, type InstallmentRow } from "./InstallmentGrid";
import { PlanTimeline } from "./PlanTimeline";

type Values = { name: string; description: string };

const starterRows = () => [newRow({ name: "Term 1", share: "50" }), newRow({ name: "Term 2", share: "50" })];

/* FI-02 drawer: create (plan = null), edit, or view a plan of the header's year.
   Once invoices exist under the plan its installments are locked; name and description stay editable. */
export function PlanDrawer({ open, plan, canEdit, onClose }: { open: boolean; plan: InstallmentPlan | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const { selected: year } = useAcademicYear();
  const form = useForm<Values>({ name: "", description: "" });
  const [rows, setRows] = useState<InstallmentRow[]>(starterRows);
  const [gridError, setGridError] = useState<string | null>(null);
  /* Learnt from a 409 when invoices.read isn't held */
  const [lockedByServer, setLockedByServer] = useState(false);
  const hasInvoices = usePlanHasInvoices(open && plan ? plan.id : null);
  const locked = !!plan && (hasInvoices === true || lockedByServer);
  const invalidate = [PLANS_PATH, ASSIGNMENTS_PATH, "/finance/fee-structures"];
  const create = useApiMutation(createPlan, { invalidate });
  const update = useApiMutation(updatePlan, { invalidate });

  useEffect(() => {
    if (!open) return;
    form.reset(plan ? { name: plan.name, description: plan.description ?? "" } : { name: "", description: "" });
    setRows(plan ? rowsFrom(plan.installments) : starterRows());
    setGridError(null);
    setLockedByServer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id]);

  if (plan && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={`${plan.name} plan`} subtitle={installmentsLabel(plan.installmentCount)} wide>
        <div className="stack">
          <DescriptionList
            columns={1}
            items={[
              { label: "Description", value: plan.description },
              { label: "Last changed", value: formatDateTime(plan.updatedAt) }
            ]}
          />
          <PlanTimeline plan={plan} />
          <InstallmentGrid rows={rowsFrom(plan.installments)} onChange={() => undefined} errors={{}} message={null} locked year={null} note="" />
        </div>
      </Drawer>
    );

  const original = plan ? JSON.stringify(toInput(rowsFrom(plan.installments))) : null;
  const installmentsChanged = !plan || JSON.stringify(toInput(rows)) !== original;
  const body: Partial<PlanInput> = {};
  if (!plan || form.values.name.trim() !== plan.name) body.name = form.values.name.trim();
  if (!plan ? form.values.description.trim() : form.values.description.trim() !== (plan.description ?? "")) body.description = form.values.description.trim();
  if (installmentsChanged && !locked) body.installments = toInput(rows);
  const dirty = Object.keys(body).length > 0;

  const problem = gridProblem(rows, year);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.values.name.trim()) e.name = "Enter a name, e.g. Quarterly";
    if (body.installments) {
      rows.forEach((r, i) => {
        if (!r.name.trim()) e[`installments.${i}.name`] = "Name it";
        if (!r.dueDate) e[`installments.${i}.dueDate`] = "Pick a date";
        if (!(Number(r.share) > 0)) e[`installments.${i}.sharePercent`] = "More than 0";
      });
    }
    form.setErrors(e);
    if (Object.keys(e).length) return false;
    if (body.installments && shareTotal(rows) !== 100) {
      setGridError(`Shares must add up to 100% (they add up to ${shareTotal(rows)}%)`);
      return false;
    }
    if (body.installments && problem) {
      setGridError(problem);
      return false;
    }
    return true;
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /installments/i.test(err.message)) {
      setLockedByServer(true);
      setGridError(err.message);
      form.setFormError("Installments are locked. Save again to keep the other changes.");
    } else if (isApiError(err) && err.status === 409) {
      form.setErrors({ name: err.message });
    } else if (isApiError(err) && err.status === 422) {
      /* Shares, due dates outside the year or out of order */
      setGridError(err.message);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    setGridError(null);
    if (!dirty || !validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (plan) update.mutate({ id: plan.id, ...body }, { onSuccess: done, onError });
    else create.mutate(body as PlanInput, { onSuccess: done, onError });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={plan ? `${plan.name} plan` : "New installment plan"}
      subtitle={
        plan ? (
          <span className="row">
            {installmentsLabel(plan.installmentCount)}
            {locked && <Badge tone="warning">Invoices issued</Badge>}
          </span>
        ) : (
          `For ${year?.yearName ?? "the selected year"}: how its fees are spread over the year`
        )
      }
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="plan-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!plan && !dirty}>
            {plan ? "Save changes" : "Create plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!plan} maxLength={100} placeholder="Quarterly" {...form.text("name")} />
          <TextInput label="Description" maxLength={1000} placeholder="Four equal installments" {...form.text("description")} />
        </div>
        <Field label="Installments" required>
          <InstallmentGrid
            rows={rows}
            onChange={next => {
              setRows(next);
              setGridError(null);
              form.setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("installments."))));
            }}
            errors={form.errors}
            message={gridError ?? problem}
            locked={locked}
            year={year}
          />
        </Field>
      </form>
    </Drawer>
  );
}

