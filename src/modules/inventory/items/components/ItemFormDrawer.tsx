import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, Select, Switch, TextInput, Textarea, useToast } from "@/common/ui";
import { useAllCategories } from "../../categories/api/categories";
import { COUNTABLE_UNITS, UNIT_LABELS, UNITS, type Unit } from "../../shared/utils/format";
import { createItem, ITEMS_PATH, updateItem, type Item, type ItemInput } from "../api/items";

type Values = { sku: string; name: string; categoryId: string; unit: Unit | ""; reorderLevel: string; location: string; description: string; discontinued: boolean };

const toValues = (i: Item | null, categoryId = ""): Values => ({
  sku: i?.sku ?? "",
  name: i?.name ?? "",
  categoryId: i?.categoryId ?? categoryId,
  unit: i?.unit ?? "",
  reorderLevel: i ? String(i.reorderLevel) : "0",
  location: i?.location ?? "",
  description: i?.description ?? "",
  discontinued: i?.discontinued ?? false
});

const SKU = /^[A-Z0-9][A-Z0-9._/-]{0,39}$/;

/* IN-03 item form: add (item = null) or edit. Stock and average cost are never fields:
   only stock movements change them. */
export function ItemFormDrawer({ open, item, defaultCategoryId, onClose, onSaved }: { open: boolean; item: Item | null; defaultCategoryId?: string; onClose: () => void; onSaved?: (i: Item) => void }) {
  const toast = useToast();
  const categories = useAllCategories(open);
  const form = useForm<Values>(toValues(null));
  const create = useApiMutation(createItem, { invalidate: [ITEMS_PATH, "/inventory/reports"] });
  const update = useApiMutation(updateItem, { invalidate: [ITEMS_PATH, "/inventory/reports", "/inventory/movements"] });
  const { values } = form;

  useEffect(() => {
    if (open) form.reset(toValues(item, defaultCategoryId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const whole = !!values.unit && COUNTABLE_UNITS.includes(values.unit);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    const sku = values.sku.trim().toUpperCase();
    const reorder = Number(values.reorderLevel || 0);
    const errors: Record<string, string> = {};
    if (!SKU.test(sku)) errors.sku = "1–40 letters, digits, . _ / or -";
    if (!values.name.trim()) errors.name = "Enter the item's name";
    if (!values.categoryId) errors.categoryId = "Pick a category";
    if (!values.unit) errors.unit = "Pick how it is counted";
    if (!Number.isFinite(reorder) || reorder < 0) errors.reorderLevel = "Enter 0 or more";
    else if (whole && !Number.isInteger(reorder)) errors.reorderLevel = `Whole ${values.unit} only`;
    if (Object.keys(errors).length) return form.setErrors(errors);

    const body: ItemInput = {
      sku,
      name: values.name.trim(),
      categoryId: values.categoryId,
      unit: values.unit as Unit,
      reorderLevel: reorder,
      location: values.location.trim(),
      description: values.description.trim(),
      discontinued: values.discontinued
    };
    const onError = (err: unknown) => {
      if (isApiError(err) && err.status === 409) {
        form.setErrors({ sku: err.message });
        form.setFormError(null);
      } else if (isApiError(err) && err.status === 422 && /unit/i.test(err.message)) {
        form.setErrors({ unit: err.message });
        form.setFormError(null);
      } else form.setServerErrors(err);
    };
    const done = (res: { data: Item; message: string }) => {
      toast.success(res.message);
      onSaved?.(res.data);
      onClose();
    };
    if (!item) {
      if (!body.location) delete body.location;
      if (!body.description) delete body.description;
      return create.mutate(body, { onSuccess: done, onError });
    }
    const before = toValues(item);
    const changes: Partial<ItemInput> = {};
    if (body.sku !== before.sku) changes.sku = body.sku;
    if (body.name !== before.name) changes.name = body.name;
    if (body.categoryId !== before.categoryId) changes.categoryId = body.categoryId;
    if (body.unit !== before.unit) changes.unit = body.unit;
    if (body.reorderLevel !== item.reorderLevel) changes.reorderLevel = body.reorderLevel;
    /* "" clears text (the API refuses null) */
    if (body.location !== before.location) changes.location = body.location;
    if (body.description !== before.description) changes.description = body.description;
    if (body.discontinued !== item.discontinued) changes.discontinued = body.discontinued;
    if (!Object.keys(changes).length) return onClose();
    update.mutate({ id: item.id, ...changes }, { onSuccess: done, onError });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? `Edit ${item.name}` : "New item"}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="item-form" variant="primary" loading={create.isPending || update.isPending}>
            {item ? "Save changes" : "Add item"}
          </Button>
        </>
      }
    >
      <form id="item-form" className="stack" onSubmit={submit} noValidate>
        <TextInput label="Name" required autoFocus={!item} maxLength={150} placeholder="Whiteboard marker (blue)" {...form.text("name")} />
        <div className="form-grid">
          <TextInput
            label="SKU"
            required
            maxLength={40}
            placeholder="STN-WBM-BLUE"
            hint="The store's own code, unique"
            {...form.text("sku")}
            onChange={e => form.set("sku", e.target.value.toUpperCase())}
          />
          <Select
            label="Category"
            required
            value={values.categoryId}
            error={form.errors.categoryId}
            placeholder={categories.isLoading ? "Loading…" : "Pick a category"}
            options={(categories.data ?? []).map(c => ({ value: c.id, label: c.name }))}
            onChange={e => form.set("categoryId", e.target.value)}
          />
          <Select
            label="Counted in"
            required
            value={values.unit}
            error={form.errors.unit}
            hint={item ? "Can't change once the item has stock movements" : whole ? "Whole numbers only" : "Up to 3 decimals"}
            placeholder="Pick a unit"
            options={UNITS.map(u => ({ value: u, label: `${UNIT_LABELS[u]} (${u})`, description: COUNTABLE_UNITS.includes(u) ? "Whole numbers" : "Decimals allowed" }))}
            onChange={e => form.set("unit", e.target.value as Unit)}
          />
          <TextInput
            label="Reorder level"
            type="number"
            inputMode="decimal"
            min={0}
            step={whole ? 1 : 0.001}
            hint="Low stock at or below this"
            {...form.text("reorderLevel")}
          />
        </div>
        <TextInput label="Location" maxLength={100} placeholder="Store room shelf 2" {...form.text("location")} />
        <Textarea label="Description" rows={2} maxLength={1000} {...form.text("description")} />
        <Field hint="Discontinued items can still be issued, take no new stock and are left out of low-stock">
          <Switch label="Discontinued" checked={values.discontinued} onChange={v => form.set("discontinued", v)} />
        </Field>
      </form>
    </Drawer>
  );
}
