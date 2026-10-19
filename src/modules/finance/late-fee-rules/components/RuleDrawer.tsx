import { useEffect, useState, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, Field, Switch, TextInput, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { hasTooManyDecimals, MoneyInput, parseAmount, useMoney } from "../../shared";
import { createRule, RULES_PATH, slabsSummary, updateRule, type LateFeeRule, type RuleInput } from "../api/lateFeeRules";
import { newSlab, SlabGrid, slabErrors, slabsFrom, slabsInput, type SlabRow } from "./SlabGrid";

type Values = { name: string; description: string; graceDays: string; maxAmount: string; isDefault: boolean };

const EMPTY: Values = { name: "", description: "", graceDays: "0", maxAmount: "", isDefault: false };

const starterSlabs = () => [newSlab({ toDay: "7", amount: "50" }), newSlab({ toDay: "30", amount: "200" }), newSlab({ amount: "500" })];

const toValues = (r: LateFeeRule): Values => ({
  name: r.name,
  description: r.description ?? "",
  graceDays: String(r.graceDays),
  maxAmount: r.maxAmount === null ? "" : String(r.maxAmount),
  isDefault: r.isDefault
});

const HELP = "Delay counts from the end of the grace period. Fixed: the amount is the fee. Per day: the amount is added for each day of the slab.";

/* FI-04 drawer: create (rule = null), edit or view a late-fee rule with its slabs */
export function RuleDrawer({ open, rule, canEdit, onClose }: { open: boolean; rule: LateFeeRule | null; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const money = useMoney();
  const form = useForm<Values>(EMPTY);
  const [slabs, setSlabs] = useState<SlabRow[]>(starterSlabs);
  const [slabMessage, setSlabMessage] = useState<string | null>(null);
  const invalidate = [RULES_PATH, "/finance/fee-structures"];
  const create = useApiMutation(createRule, { invalidate });
  const update = useApiMutation(updateRule, { invalidate });
  const { values } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(rule ? toValues(rule) : EMPTY);
    setSlabs(rule ? slabsFrom(rule.slabs) : starterSlabs());
    setSlabMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  if (rule && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={rule.name} subtitle={rule.isDefault ? <Badge tone="primary">School default</Badge> : undefined}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Description", value: rule.description },
            { label: "Grace period", value: `${rule.graceDays} day${rule.graceDays === 1 ? "" : "s"}` },
            { label: "Slabs", value: slabsSummary(rule.slabs) },
            { label: "Most charged per invoice", value: rule.maxAmount === null ? "No cap" : money(rule.maxAmount) },
            { label: "Last changed", value: formatDateTime(rule.updatedAt) }
          ]}
        />
        <p className="small muted" style={{ marginTop: 16 }}>
          {HELP}
        </p>
      </Drawer>
    );

  /* ---- body ---- */
  const grace = Number(values.graceDays || 0);
  const cap = parseAmount(values.maxAmount);
  const input = slabsInput(slabs);
  const body: Partial<RuleInput> = {};
  if (!rule) {
    Object.assign(body, { name: values.name.trim(), graceDays: grace, isDefault: values.isDefault, slabs: input });
    if (values.description.trim()) body.description = values.description.trim();
    if (cap !== null) body.maxAmount = cap;
  } else {
    if (values.name.trim() !== rule.name) body.name = values.name.trim();
    if (values.description.trim() !== (rule.description ?? "")) body.description = values.description.trim();
    if (grace !== rule.graceDays) body.graceDays = grace;
    if (cap !== rule.maxAmount) body.maxAmount = cap;
    if (values.isDefault !== rule.isDefault) body.isDefault = values.isDefault;
    if (JSON.stringify(input) !== JSON.stringify(slabsInput(slabsFrom(rule.slabs)))) body.slabs = input;
  }
  const dirty = Object.keys(body).length > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Enter a name, e.g. Standard late fee";
    if (!/^\d+$/.test(values.graceDays.trim()) || grace > 365) e.graceDays = "0 to 365 days";
    if (values.maxAmount.trim() && (cap === null || cap <= 0)) e.maxAmount = "More than 0, or leave empty";
    else if (hasTooManyDecimals(values.maxAmount)) e.maxAmount = "At most 2 decimals";
    Object.assign(e, slabErrors(slabs));
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ name: err.message });
    } else if (isApiError(err) && err.status === 422) {
      setSlabMessage(err.message);
    } else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    setSlabMessage(null);
    if (!dirty || !validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      if (rule) toast.show("Open invoices follow the new rule from the next daily run.", "info");
      onClose();
    };
    if (rule) update.mutate({ id: rule.id, ...body }, { onSuccess: done, onError });
    else create.mutate(body as RuleInput, { onSuccess: done, onError });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={rule ? rule.name : "New late-fee rule"}
      subtitle={rule?.isDefault ? <Badge tone="primary">School default</Badge> : "Charged on overdue invoices of the structures that use it"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="rule-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!rule && !dirty}>
            {rule ? "Save changes" : "Create rule"}
          </Button>
        </>
      }
    >
      <form id="rule-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!rule} maxLength={100} placeholder="Standard late fee" {...form.text("name")} />
          <TextInput label="Description" maxLength={1000} {...form.text("description")} />
          <TextInput
            label="Grace period (days)"
            inputMode="numeric"
            hint="Days after the due date before any late fee"
            {...form.text("graceDays")}
            onChange={e => form.set("graceDays", e.target.value.replace(/\D/g, ""))}
          />
          <MoneyInput label="Most charged per invoice" placeholder="No cap" hint="Leave empty for no cap" {...form.text("maxAmount")} onChange={e => form.set("maxAmount", e.target.value.replace(/[^\d.,]/g, ""))} />
        </div>
        <Field label="Slabs" required hint={undefined}>
          <p className="small muted" style={{ marginBottom: 10 }}>
            {HELP}
          </p>
          <SlabGrid
            rows={slabs}
            onChange={next => {
              setSlabs(next);
              setSlabMessage(null);
              form.setErrors(e => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith("slabs."))));
            }}
            errors={form.errors}
            message={slabMessage}
          />
        </Field>
        <Field
          hint={
            rule?.isDefault && !values.isDefault
              ? "Without a default, structures with no rule of their own charge no late fee"
              : "Used by fee structures that charge late fees without a rule of their own. Replaces the current default."
          }
        >
          <Switch label="School default" checked={values.isDefault} onChange={on => form.set("isDefault", on)} />
        </Field>
      </form>
    </Drawer>
  );
}
