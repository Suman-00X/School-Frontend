import { useEffect, useMemo, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Drawer, Field, RadioGroup, Select, TextInput, useConfirm, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { useEmployees } from "@/modules/administration";
import { StudentSelect, studentName, useStudentOptions } from "@/modules/users";
import { useMoney } from "../../shared/hooks/useMoney";
import { qty, quantityProblem, round2, signed, weightedAverage, type MovementType } from "../../shared/utils/format";
import { useAllItems, type Item } from "../../items/api/items";
import { useAllVendors } from "../../vendors/api/vendors";
import { MOVEMENTS_PATH, recordMovement, type Movement, type MovementInput } from "../api/stock";
import "../../shared/inventory.css";

type Who = "student" | "staff" | "text";
type Values = {
  itemId: string;
  type: MovementType;
  quantity: string;
  unitCost: string;
  vendorId: string;
  who: Who;
  studentId: string;
  staffUserId: string;
  issuedTo: string;
  reason: string;
  reference: string;
  movementDate: string;
};

export type MovementPreset = { item?: Item | null; type?: MovementType; vendorId?: string; unitCost?: number };

const TYPE_TEXT: Record<MovementType, { label: string; description: string; verb: string }> = {
  RECEIPT: { label: "Receive", description: "Bought or donated stock", verb: "Receive" },
  ISSUE: { label: "Issue", description: "Given out to a person or place", verb: "Issue" },
  RETURN: { label: "Take back", description: "Returned to the store", verb: "Take back" },
  ADJUSTMENT: { label: "Adjust", description: "Count correction, damage or loss", verb: "Adjust" }
};

/* IN-04 "Record movement": receive, issue, take back or adjust one item. Opened from the
   ledger (item picked here) or from an item (item fixed). Movements are permanent, so the
   form repeats the movement in a confirm step before saving. */
export function MovementDrawer({ open, preset, onClose, onDone }: { open: boolean; preset?: MovementPreset; onClose: () => void; onDone?: (m: Movement) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const fixedItem = preset?.item ?? null;
  const items = useAllItems(open && !fixedItem);
  const vendors = useAllVendors(open && can("inventory.vendors.read"));
  const students = useStudentOptions(open);
  const staff = useEmployees();
  const today = todayIso();
  const canAdjust = can("inventory.stock.adjust");

  const blank = (): Values => ({
    itemId: fixedItem?.id ?? "",
    type: preset?.type && (preset.type !== "ADJUSTMENT" || canAdjust) ? preset.type : "RECEIPT",
    quantity: "",
    unitCost: preset?.unitCost !== undefined ? String(preset.unitCost) : "",
    vendorId: preset?.vendorId ?? "",
    who: students.allowed ? "student" : "text",
    studentId: "",
    staffUserId: "",
    issuedTo: "",
    reason: "",
    reference: "",
    movementDate: today
  });
  const form = useForm<Values>(blank());
  const { values, errors } = form;
  const save = useApiMutation(recordMovement, { invalidate: ["/inventory/items", MOVEMENTS_PATH, "/inventory/reports"] });

  useEffect(() => {
    if (open) form.reset(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedItem?.id, preset?.type, preset?.vendorId]);

  const item = fixedItem ?? items.data?.find(i => i.id === values.itemId) ?? null;
  const unit = item?.unit;
  const type = values.type;
  const n = Number(values.quantity);
  const cost = Number(values.unitCost);

  const whoOptions = [
    students.allowed && { value: "student" as Who, label: "A student" },
    staff.canList && { value: "staff" as Who, label: "Staff or teacher" },
    { value: "text" as Who, label: students.allowed || staff.canList ? "Someone else or a place" : "Name or place" }
  ].filter(Boolean) as { value: Who; label: string }[];

  /* Stock and average cost before → after, as far as the form is filled in */
  const preview = useMemo(() => {
    if (!item || !values.quantity || !Number.isFinite(n) || n === 0) return null;
    const change = type === "ISSUE" ? -Math.abs(n) : type === "ADJUSTMENT" ? n : Math.abs(n);
    const after = Math.round((item.stockOnHand + change) * 1000) / 1000;
    const avgAfter = type === "RECEIPT" && Number.isFinite(cost) && values.unitCost !== "" ? weightedAverage(item.stockOnHand, item.averageUnitCost, Math.abs(n), cost) : item.averageUnitCost;
    const unitValue = type === "RECEIPT" ? cost : item.averageUnitCost;
    return { change, after, avgAfter, value: Number.isFinite(unitValue) ? round2(Math.abs(change) * unitValue) : null };
  }, [item, values.quantity, values.unitCost, n, cost, type]);

  const problem = !item
    ? null
    : type === "RECEIPT" && item.discontinued
      ? `${item.name} is discontinued and can't receive new stock`
      : preview && preview.after < 0
        ? type === "ISSUE"
          ? item.stockOnHand <= 0
            ? `${item.name} is out of stock`
            : `Only ${qty(item.stockOnHand, unit)} in stock`
          : `That would take ${item.name} below zero`
        : null;

  const recipient = (): { issuedToUserId?: string; issuedTo?: string; name: string } | null => {
    if (values.who === "student" && values.studentId) {
      const s = students.byId.get(values.studentId);
      return s ? { issuedToUserId: s.userId, name: studentName(s) } : null;
    }
    if (values.who === "staff" && values.staffUserId) {
      const p = staff.people.find(x => x.id === values.staffUserId);
      return { issuedToUserId: values.staffUserId, name: p?.name ?? "the staff member" };
    }
    if (values.who === "text" && values.issuedTo.trim()) return { issuedTo: values.issuedTo.trim(), name: values.issuedTo.trim() };
    return null;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!item) e.itemId = "Pick the item";
    const qp = quantityProblem(n, unit, { allowNegative: type === "ADJUSTMENT" });
    if (values.quantity.trim() === "") e.quantity = type === "ADJUSTMENT" ? "Enter the change, e.g. −2" : "Enter the quantity";
    else if (qp) e.quantity = qp;
    if (type === "RECEIPT") {
      if (values.unitCost.trim() === "" || !Number.isFinite(cost) || cost < 0) e.unitCost = "Enter the cost of one unit";
      else if (Math.round(cost * 100) !== cost * 100) e.unitCost = "At most 2 decimals";
    }
    if (type === "ISSUE" && !recipient()) e.issuedTo = values.who === "text" ? "Say who or where it goes" : "Pick who gets it";
    if (type === "ADJUSTMENT" && !values.reason.trim()) e.reason = "Say why (count, damage, loss…)";
    if (!values.movementDate) e.movementDate = "Pick the date";
    else if (values.movementDate > today) e.movementDate = "Can't be in the future";
    form.setErrors(e);
    return Object.keys(e).length === 0 && !problem;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    form.setFormError(null);
    if (!validate() || !item) return;
    const body: MovementInput = { type, movementDate: values.movementDate };
    if (type === "ADJUSTMENT") body.quantityChange = n;
    else body.quantity = Math.abs(n);
    if (type === "RECEIPT") {
      body.unitCost = cost;
      if (values.vendorId) body.vendorId = values.vendorId;
    }
    const who = type === "ISSUE" || type === "RETURN" ? recipient() : null;
    if (who?.issuedToUserId) body.issuedToUserId = who.issuedToUserId;
    if (who?.issuedTo) body.issuedTo = who.issuedTo;
    if (values.reason.trim() && type !== "RECEIPT") body.reason = values.reason.trim();
    if (values.reference.trim()) body.reference = values.reference.trim();

    const amount = qty(Math.abs(n), unit);
    const vendor = vendors.data?.find(v => v.id === values.vendorId)?.name;
    const sentence = {
      RECEIPT: `Receive ${amount} of ${item.name}${vendor ? ` from ${vendor}` : ""} at ${money(cost)} each?`,
      ISSUE: `Issue ${amount} of ${item.name} to ${who?.name}?`,
      RETURN: `Take back ${amount} of ${item.name}${who ? ` from ${who.name}` : ""}?`,
      ADJUSTMENT: `Adjust ${item.name} by ${signed(n)} ${unit}?`
    }[type];
    const ok = await confirm({
      title: `${TYPE_TEXT[type].verb} stock`,
      message: (
        <div className="stack-sm">
          <p>{sentence}</p>
          {preview && (
            <p className="muted">
              Stock goes from {qty(item.stockOnHand, unit)} to {qty(preview.after, unit)}. Movements are permanent; a mistake is corrected with an adjustment.
            </p>
          )}
        </div>
      ),
      confirmLabel: TYPE_TEXT[type].verb,
      tone: "primary"
    });
    if (!ok) return;
    save.mutate(
      { itemId: item.id, ...body },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone?.(res.data);
          onClose();
        },
        onError: err => {
          if (isApiError(err) && err.isValidation) form.setServerErrors(err, { quantityChange: "quantity", issuedToUserId: "issuedTo" });
          else if (isApiError(err) && err.status === 422 && /movementDate/.test(err.message)) form.setErrors({ movementDate: err.message });
          else form.setFormError(isApiError(err) ? err.message : "Something went wrong. Please try again.");
        }
      }
    );
  };

  const setType = (t: MovementType) => {
    form.set("type", t);
    form.setErrors({});
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={fixedItem ? `Stock movement · ${fixedItem.name}` : "Record stock movement"}
      subtitle={fixedItem ? `${fixedItem.sku} · ${qty(fixedItem.stockOnHand, fixedItem.unit)} in stock` : undefined}
      footerStatus={form.formError ?? problem}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="movement-form" variant="primary" loading={save.isPending} disabled={!!problem}>
            {TYPE_TEXT[type].verb}
          </Button>
        </>
      }
    >
      <form id="movement-form" className="stack" onSubmit={e => void submit(e)} noValidate>
        {!fixedItem && (
          <Select
            label="Item"
            required
            value={values.itemId}
            error={errors.itemId}
            placeholder={items.isLoading ? "Loading items…" : "Search by name or SKU"}
            searchable
            options={(items.data ?? []).map(i => ({
              value: i.id,
              label: i.name,
              description: `${i.sku} · ${qty(i.stockOnHand, i.unit)} in stock · avg ${money(i.averageUnitCost)}${i.discontinued ? " · discontinued" : ""}`
            }))}
            onChange={e => form.set("itemId", e.target.value)}
          />
        )}
        <Field label="What happened" error={errors.type}>
          <RadioGroup
            value={type}
            onChange={setType}
            aria-label="Movement type"
            options={(["RECEIPT", "ISSUE", "RETURN", "ADJUSTMENT"] as MovementType[])
              .filter(t => t !== "ADJUSTMENT" || canAdjust)
              .map(t => ({ value: t, label: TYPE_TEXT[t].label, description: TYPE_TEXT[t].description }))}
          />
        </Field>

        <div className="form-grid">
          <TextInput
            label={type === "ADJUSTMENT" ? `Change${unit ? ` (${unit})` : ""}` : `Quantity${unit ? ` (${unit})` : ""}`}
            required
            type="number"
            inputMode="decimal"
            step={unit && ["PCS", "BOX", "PACK", "SET", "REAM"].includes(unit) ? 1 : 0.001}
            min={type === "ADJUSTMENT" ? undefined : 0}
            placeholder={type === "ADJUSTMENT" ? "−2 or 5" : undefined}
            hint={type === "ADJUSTMENT" ? "Negative takes stock away, positive adds" : undefined}
            {...form.text("quantity")}
          />
          {type === "RECEIPT" ? (
            <TextInput label="Unit cost" required type="number" inputMode="decimal" min={0} step={0.01} hint="Price of one unit" {...form.text("unitCost")} />
          ) : (
            <TextInput label="Date" required type="date" max={today} {...form.text("movementDate")} />
          )}
        </div>

        {type === "RECEIPT" && (
          <>
            <div className="form-grid">
              <Select
                label="Vendor"
                value={values.vendorId}
                placeholder={can("inventory.vendors.read") ? "No vendor (donation, opening stock)" : "Vendors are not visible to you"}
                disabled={!can("inventory.vendors.read")}
                options={(vendors.data ?? []).map(v => ({ value: v.id, label: v.name, description: v.contactPerson ?? undefined }))}
                onChange={e => form.set("vendorId", e.target.value)}
              />
              <TextInput label="Invoice or reference" maxLength={100} placeholder="INV-2291" {...form.text("reference")} />
            </div>
            <TextInput label="Date" required type="date" max={today} {...form.text("movementDate")} />
          </>
        )}

        {(type === "ISSUE" || type === "RETURN") && (
          <>
            <Field label={type === "ISSUE" ? "Issued to" : "Returned by"} required={type === "ISSUE"} hint={type === "RETURN" ? "Optional" : undefined}>
              <RadioGroup value={values.who} onChange={w => form.set("who", w)} aria-label="Who" options={whoOptions} />
            </Field>
            {values.who === "student" && (
              <StudentSelect value={values.studentId} error={errors.issuedTo} onChange={e => form.set("studentId", e.target.value)} hint="Staff aren't listed here: pick “someone else” and type the name" />
            )}
            {values.who === "staff" && (
              <Select
                label="Staff member or teacher"
                value={values.staffUserId}
                error={errors.issuedTo}
                searchable
                placeholder={staff.isLoading ? "Loading…" : "Search by name"}
                options={staff.people.map(p => ({ value: p.id, label: p.name, description: p.email }))}
                onChange={e => form.set("staffUserId", e.target.value)}
              />
            )}
            {values.who === "text" && (
              <TextInput label="Name or place" maxLength={200} placeholder="Science lab, or Ramesh Chauhan" {...form.text("issuedTo")} />
            )}
            <TextInput label="Reason" maxLength={500} placeholder={type === "ISSUE" ? "Class 7B practicals" : "Not used"} {...form.text("reason")} />
          </>
        )}

        {type === "ADJUSTMENT" && (
          <div className="form-grid">
            <TextInput label="Reason" required maxLength={500} placeholder="Stock count, 2 damaged" {...form.text("reason")} />
            <TextInput label="Reference" maxLength={100} placeholder="Count sheet no." {...form.text("reference")} />
          </div>
        )}

        {/* Fixed height: what the movement does to the item */}
        <div className="in-preview" aria-live="polite">
          {!item ? (
            <span className="muted">Pick an item to see its stock.</span>
          ) : (
            <>
              <span>
                <span className="muted">In stock </span>
                <strong>{qty(item.stockOnHand, unit)}</strong>
                {preview && (
                  <>
                    <ArrowRight size={14} />
                    <strong style={{ color: preview.after < 0 ? "var(--danger-text)" : undefined }}>{qty(preview.after, unit)}</strong>
                  </>
                )}
              </span>
              <span>
                <span className="muted">Avg cost </span>
                {money(item.averageUnitCost)}
                {preview && type === "RECEIPT" && preview.avgAfter !== item.averageUnitCost && (
                  <>
                    <ArrowRight size={14} />
                    {money(preview.avgAfter)}
                  </>
                )}
              </span>
              {preview?.value !== null && preview?.value !== undefined && (
                <span>
                  <span className="muted">Value </span>
                  {money(preview.value)}
                </span>
              )}
            </>
          )}
        </div>
      </form>
    </Drawer>
  );
}
