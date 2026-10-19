import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, Field, RadioGroup, TextInput, Textarea, useToast } from "@/common/ui";
import { useMoney } from "../../shared/hooks/useMoney";
import { COMPONENTS_PATH, createComponent, updateComponent, type Calculation, type ComponentInput, type ComponentKind, type SalaryComponent } from "../api/payroll";
import { CalculationText, KindBadge } from "./SalaryBits";

type Values = { code: string; name: string; kind: ComponentKind; calculation: Calculation; defaultValue: string; description: string };

const EMPTY: Values = { code: "", name: "", kind: "EARNING", calculation: "FIXED", defaultValue: "", description: "" };

const toValues = (c: SalaryComponent): Values => ({
  code: c.code,
  name: c.name,
  kind: c.kind,
  calculation: c.calculation,
  defaultValue: String(c.defaultValue),
  description: c.description ?? ""
});

const CODE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;

/* HR-02 component drawer: create (component = null), or view / edit one */
export function ComponentDrawer({
  open,
  component,
  canEdit,
  onClose
}: {
  open: boolean;
  component: SalaryComponent | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const money = useMoney();
  const form = useForm<Values>(EMPTY);
  const create = useApiMutation(createComponent, { invalidate: [COMPONENTS_PATH] });
  const update = useApiMutation(updateComponent, { invalidate: [COMPONENTS_PATH, "/hr/employee-salaries"] });
  const { values } = form;
  const percent = values.calculation === "PERCENT_OF_BASIC";

  useEffect(() => {
    if (open) form.reset(component ? toValues(component) : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, component?.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!CODE.test(values.code.trim().toUpperCase())) e.code = "2–20 letters, digits, - or _";
    if (!values.name.trim()) e.name = "Enter a name";
    const v = Number(values.defaultValue || 0);
    if (!Number.isFinite(v) || v < 0) e.defaultValue = "Enter 0 or more";
    else if (percent && v > 100) e.defaultValue = "At most 100%";
    else if (Math.round(v * 100) !== v * 100) e.defaultValue = "At most 2 decimals";
    form.setErrors(e);
    return Object.keys(e).length === 0;
  };

  const body = (): ComponentInput => ({
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    kind: values.kind,
    calculation: values.calculation,
    defaultValue: Number(values.defaultValue || 0),
    description: values.description.trim()
  });

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409 && /code|named|name/i.test(err.message) && !/used in/i.test(err.message)) {
      form.setErrors({ [/code/i.test(err.message) ? "code" : "name"]: err.message });
      form.setFormError(null);
    } else form.setServerErrors(err);
  };

  const done = (res: { message: string }) => {
    toast.success(res.message);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    if (!validate()) return;
    const b = body();
    if (!component) {
      if (!b.description) delete b.description;
      return create.mutate(b, { onSuccess: done, onError });
    }
    const before = toValues(component);
    const changes: Partial<ComponentInput> = {};
    if (b.code !== before.code) changes.code = b.code;
    if (b.name !== before.name) changes.name = b.name;
    if (b.kind !== before.kind) changes.kind = b.kind;
    if (b.calculation !== before.calculation) changes.calculation = b.calculation;
    if (b.defaultValue !== component.defaultValue) changes.defaultValue = b.defaultValue;
    if ((b.description ?? "") !== before.description) changes.description = b.description;
    if (!Object.keys(changes).length) return onClose();
    update.mutate({ id: component.id, ...changes }, { onSuccess: done, onError });
  };

  const title = component ? component.name : "New salary component";

  if (component && !canEdit)
    return (
      <Drawer open={open} onClose={onClose} title={title} subtitle={<span className="mono">{component.code}</span>}>
        <DescriptionList
          columns={1}
          items={[
            { label: "Kind", value: <KindBadge kind={component.kind} /> },
            { label: "Default value", value: <CalculationText calculation={component.calculation} value={component.defaultValue} /> },
            { label: "Description", value: component.description }
          ]}
        />
      </Drawer>
    );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={component ? <span className="mono">{component.code}</span> : undefined}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="component-form" variant="primary" loading={create.isPending || update.isPending}>
            {component ? "Save changes" : "Add component"}
          </Button>
        </>
      }
    >
      <form id="component-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="Name" required autoFocus={!component} maxLength={100} placeholder="House rent allowance" {...form.text("name")} />
          <TextInput
            label="Code"
            required
            maxLength={20}
            placeholder="HRA"
            hint="Shown on payslips"
            {...form.text("code")}
            onChange={e => form.set("code", e.target.value.toUpperCase())}
          />
        </div>
        <Field label="Kind" hint="Kind and calculation can't change once a salary uses the component" error={form.errors.kind}>
          <RadioGroup
            value={values.kind}
            onChange={v => form.set("kind", v)}
            aria-label="Kind"
            options={[
              { value: "EARNING", label: "Earning", description: "Added to pay (allowances)" },
              { value: "DEDUCTION", label: "Deduction", description: "Taken from pay (PF, tax)" }
            ]}
          />
        </Field>
        <Field label="Calculation" error={form.errors.calculation}>
          <RadioGroup
            value={values.calculation}
            onChange={v => form.set("calculation", v)}
            aria-label="Calculation"
            options={[
              { value: "FIXED", label: "Fixed amount", description: "The same amount every month" },
              { value: "PERCENT_OF_BASIC", label: "Percent of basic", description: "e.g. 40% of the monthly basic" }
            ]}
          />
        </Field>
        <TextInput
          label={percent ? "Default percent of basic" : "Default amount"}
          type="number"
          inputMode="decimal"
          min={0}
          max={percent ? 100 : undefined}
          step={0.01}
          placeholder={percent ? "40" : "1600"}
          hint={percent ? "0–100%. Prefilled when the component is added to a salary" : `Monthly amount, e.g. ${money(1600)}. Prefilled when added to a salary`}
          {...form.text("defaultValue")}
        />
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
      </form>
    </Drawer>
  );
}
