import { useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Badge, Button, Checkbox, DescriptionList, Drawer, Field, RadioGroup, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useFeeHeadOptions } from "../../fee-heads";
import { hasTooManyDecimals, MoneyInput, parseAmount, SETUP_PATHS } from "../../shared";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  CONCESSIONS_PATH,
  createConcession,
  GRANTS_PATH,
  updateConcession,
  valueLabel,
  type Category,
  type Concession,
  type ConcessionInput,
  type ConcessionType
} from "../api/concessions";

type Values = { name: string; category: Category; concessionType: ConcessionType; value: string; feeHeadIds: string[]; description: string };

const EMPTY: Values = { name: "", category: "OTHER", concessionType: "PERCENT", value: "", feeHeadIds: [], description: "" };

const toValues = (c: Concession): Values => ({
  name: c.name,
  category: c.category,
  concessionType: c.concessionType,
  value: String(c.value),
  feeHeadIds: [...c.feeHeadIds].sort(),
  description: c.description ?? ""
});

const TYPES = [
  { value: "PERCENT" as const, label: "Percentage", description: "Of each fee head it covers" },
  { value: "FIXED" as const, label: "Fixed amount", description: "Per year, spread over the installments" }
];

/* FI-05 template drawer. Once granted, type, value and fee heads are frozen (409): they are shown
   disabled, and name, category and description stay editable. */
export function ConcessionDrawer({
  open,
  concession,
  grants,
  canEdit,
  onClose
}: {
  open: boolean;
  concession: Concession | null;
  /* Active grants of the template (undefined while counting) */
  grants: number | undefined;
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const heads = useFeeHeadOptions(open);
  const form = useForm<Values>(EMPTY);
  const invalidate = [CONCESSIONS_PATH, GRANTS_PATH];
  const create = useApiMutation(createConcession, { invalidate });
  const update = useApiMutation(updateConcession, { invalidate });
  const { values, errors } = form;

  useEffect(() => {
    if (open) form.reset(concession ? toValues(concession) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, concession?.id]);

  const headsLabel = (c: Concession) => (c.feeHeads.length ? c.feeHeads.map(h => h.name).join(", ") : "Every fee head");
  const grantsLink = concession && grants !== undefined && (
    <Link to={`${SETUP_PATHS.concessionGrants}?concessionId=${concession.id}`} onClick={onClose}>
      {grants === 0 ? "Not granted yet" : `${grants} grant${grants === 1 ? "" : "s"}`}
    </Link>
  );

  if (concession && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={concession.name} subtitle={<Badge>{CATEGORY_LABELS[concession.category]}</Badge>}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Takes off", value: valueLabel(concession) },
            { label: "Fee heads", value: headsLabel(concession) },
            { label: "Description", value: concession.description },
            { label: "Granted", value: grantsLink },
            { label: "Last changed", value: formatDateTime(concession.updatedAt) }
          ]}
        />
      </Drawer>
    );

  const frozen = !!concession && (grants ?? 0) > 0;
  const percent = values.concessionType === "PERCENT";
  const amount = parseAmount(values.value);

  const body: Partial<ConcessionInput> = {};
  if (!concession) {
    Object.assign(body, { name: values.name.trim(), category: values.category, concessionType: values.concessionType, value: amount ?? 0, feeHeadIds: values.feeHeadIds });
    if (values.description.trim()) body.description = values.description.trim();
  } else {
    const before = toValues(concession);
    if (values.name.trim() !== before.name) body.name = values.name.trim();
    if (values.category !== before.category) body.category = values.category;
    if (values.description.trim() !== before.description) body.description = values.description.trim();
    if (!frozen) {
      if (values.concessionType !== before.concessionType) body.concessionType = values.concessionType;
      if (amount !== concession.value) body.value = amount ?? 0;
      if ([...values.feeHeadIds].sort().join() !== before.feeHeadIds.join()) body.feeHeadIds = values.feeHeadIds;
    }
  }
  const dirty = Object.keys(body).length > 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Enter a name, e.g. Sibling discount";
    if (!frozen) {
      if (amount === null || amount <= 0) e.value = percent ? "1 to 100" : "More than 0";
      else if (percent && amount > 100) e.value = "At most 100 for a percentage";
      else if (hasTooManyDecimals(values.value)) e.value = "At most 2 decimals";
    }
    form.setErrors(e);
    return !Object.keys(e).length;
  };

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /granted/i.test(err.message)) form.setFormError(err.message);
    else if (isApiError(err) && err.status === 409) form.setErrors({ name: err.message });
    else form.setServerErrors(err);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!dirty || !validate()) return;
    const done = (res: { message: string }) => {
      toast.success(res.message);
      onClose();
    };
    if (concession) update.mutate({ id: concession.id, ...body }, { onSuccess: done, onError });
    else create.mutate(body as ConcessionInput, { onSuccess: done, onError });
  };

  const toggleHead = (id: string) =>
    form.set("feeHeadIds", values.feeHeadIds.includes(id) ? values.feeHeadIds.filter(x => x !== id) : [...values.feeHeadIds, id]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={concession ? concession.name : "New concession"}
      subtitle={concession ? grantsLink : "A discount you can grant to students, such as a sibling or staff-ward discount"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="concession-form" variant="primary" loading={create.isPending || update.isPending} disabled={!!concession && !dirty}>
            {concession ? "Save changes" : "Create concession"}
          </Button>
        </>
      }
    >
      <form id="concession-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!concession} maxLength={100} placeholder="Sibling discount" {...form.text("name")} />
          <Select label="Category" required options={CATEGORY_OPTIONS} hint="Reports group discounts by it" {...form.text("category")} />
        </div>
        <Field label="Takes off" hint={frozen ? "Granted already: type, value and fee heads can no longer change. Create a new concession instead." : undefined}>
          <RadioGroup aria-label="Type" options={TYPES} value={values.concessionType} disabled={frozen} onChange={t => form.set("concessionType", t)} />
        </Field>
        <div className="form-grid">
          {percent ? (
            <TextInput
              label="Percentage"
              required
              inputMode="decimal"
              placeholder="10"
              disabled={frozen}
              hint="0 to 100, of each covered fee head"
              {...form.text("value")}
              onChange={e => form.set("value", e.target.value.replace(/[^\d.]/g, ""))}
              error={errors.value}
            />
          ) : (
            <MoneyInput
              label="Amount per year"
              required
              placeholder="5,000.00"
              disabled={frozen}
              hint="Spread over the student's installments"
              {...form.text("value")}
              onChange={e => form.set("value", e.target.value.replace(/[^\d.,]/g, ""))}
              error={errors.value}
            />
          )}
        </div>
        <Field label="Fee heads" hint={values.feeHeadIds.length ? `${values.feeHeadIds.length} ticked` : "None ticked: it covers every fee head"}>
          <div className="row" role="group" aria-label="Fee heads" style={{ gap: "8px 16px" }}>
            {heads.heads.map(h => (
              <Checkbox key={h.id} label={h.name} checked={values.feeHeadIds.includes(h.id)} disabled={frozen} onChange={() => toggleHead(h.id)} />
            ))}
            {!heads.isLoading && !heads.heads.length && <span className="small muted">No fee heads yet.</span>}
          </div>
        </Field>
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
        <p className="small muted">Several concessions stack: percentages add up, then fixed amounts. Paid invoices are never changed.</p>
      </form>
    </Drawer>
  );
}
