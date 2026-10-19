import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useForm } from "@/common/hooks";
import { Button, DataTable, DescriptionList, Drawer, EmptyState, Tabs, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useMoney } from "../../shared/hooks/useMoney";
import { qty } from "../../shared/utils/format";
import type { Movement } from "../../stock/api/stock";
import { createVendor, updateVendor, VENDORS_PATH, type Vendor, type VendorInput } from "../api/vendors";

type Values = { name: string; contactPerson: string; phone: string; email: string; taxId: string; address: string; notes: string };
const KEYS = ["name", "contactPerson", "phone", "email", "taxId", "address", "notes"] as const;
/* The API can't clear these once set (an empty value fails their format) */
const UNCLEARABLE = ["phone", "email", "taxId"];

const toValues = (v: Vendor | null): Values => Object.fromEntries(KEYS.map(k => [k, (v?.[k] as string | null) ?? ""])) as Values;

/* IN-02 drawer: Details (form, or read-only) and Receipts from this vendor */
export function VendorDrawer({ open, vendor, canEdit, onClose }: { open: boolean; vendor: Vendor | null; canEdit: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const form = useForm<Values>(toValues(null));
  const create = useApiMutation(createVendor, { invalidate: [VENDORS_PATH] });
  const update = useApiMutation(updateVendor, { invalidate: [VENDORS_PATH, "/inventory/movements"] });
  const [tab, setTab] = useState("details");
  const showReceipts = !!vendor && can("inventory.stock.read");

  useEffect(() => {
    if (open) {
      form.reset(toValues(vendor));
      setTab("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendor?.id]);

  const onError = (err: unknown) => {
    if (isApiError(err) && err.status === 409) {
      form.setErrors({ [/tax id/i.test(err.message) ? "taxId" : "name"]: err.message });
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
    const v = Object.fromEntries(KEYS.map(k => [k, form.values[k].trim()])) as Values;
    v.taxId = v.taxId.toUpperCase();
    const errors: Record<string, string> = {};
    if (!v.name) errors.name = "Enter the vendor's name";
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) errors.email = "Enter a valid email";
    if (v.phone && !/^[+0-9 ()-]{5,20}$/.test(v.phone)) errors.phone = "Digits, spaces, +, ( ) or -";
    if (vendor) for (const k of UNCLEARABLE) if (!v[k as keyof Values] && vendor[k as keyof Vendor]) errors[k] = "Can't be cleared; enter a new value";
    if (Object.keys(errors).length) return form.setErrors(errors);

    if (!vendor) {
      const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x)) as VendorInput;
      return create.mutate(body, { onSuccess: done, onError });
    }
    const changes: Partial<VendorInput> = {};
    for (const k of KEYS) if (v[k] !== ((vendor[k] as string | null) ?? "")) (changes as Record<string, string>)[k] = v[k];
    if (!Object.keys(changes).length) return onClose();
    update.mutate({ id: vendor.id, ...changes }, { onSuccess: done, onError });
  };

  const editing = !vendor || canEdit;
  const details = editing ? (
    <form id="vendor-form" className="stack" onSubmit={submit} noValidate>
      <TextInput label="Name" required autoFocus={!vendor} maxLength={150} {...form.text("name")} />
      <div className="form-grid">
        <TextInput label="Contact person" maxLength={100} {...form.text("contactPerson")} />
        <TextInput label="Phone" type="tel" maxLength={20} {...form.text("phone")} />
        <TextInput label="Email" type="email" maxLength={200} {...form.text("email")} />
        <TextInput
          label="Tax id (GSTIN)"
          maxLength={30}
          placeholder="29ABCDE1234F1Z5"
          hint="15 characters for vendors in India"
          {...form.text("taxId")}
          onChange={e => form.set("taxId", e.target.value.toUpperCase())}
        />
      </div>
      <Textarea label="Address" rows={2} maxLength={500} {...form.text("address")} />
      <Textarea label="Notes" rows={2} maxLength={1000} {...form.text("notes")} />
    </form>
  ) : (
    <DescriptionList
      columns={2}
      items={[
        { label: "Contact person", value: vendor!.contactPerson },
        { label: "Phone", value: vendor!.phone },
        { label: "Email", value: vendor!.email },
        { label: "Tax id", value: vendor!.taxId && <span className="mono">{vendor!.taxId}</span> },
        { label: "Address", value: vendor!.address, wide: true },
        { label: "Notes", value: vendor!.notes, wide: true }
      ]}
    />
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide={showReceipts}
      title={vendor ? vendor.name : "New vendor"}
      footerStatus={tab === "details" ? form.formError : undefined}
      footer={
        editing ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="vendor-form" variant="primary" disabled={tab !== "details"} loading={create.isPending || update.isPending}>
              {vendor ? "Save changes" : "Add vendor"}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        {showReceipts && (
          <Tabs
            tabs={[
              { id: "details", label: "Details" },
              { id: "receipts", label: "Receipts" }
            ]}
            value={tab}
            onChange={setTab}
          />
        )}
        {tab === "details" || !vendor ? details : <VendorReceipts vendor={vendor} />}
      </div>
    </Drawer>
  );
}

/* Purchases from this vendor, newest first */
function VendorReceipts({ vendor }: { vendor: Vendor }) {
  const money = useMoney();
  const [page, setPage] = useState(1);
  const list = useApiList<Movement>("/inventory/movements", { vendorId: vendor.id, type: "RECEIPT", page, limit: 10 });
  return (
    <div className="stack-sm">
      <div className="card card-flush">
        <DataTable
          rows={list.rows}
          rowKey={m => m.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          empty={<EmptyState title="Nothing received from this vendor yet" />}
          columns={[
            { key: "number", header: "Number", render: m => <span className="mono small">{m.movementNumber}</span> },
            { key: "date", header: "Date", render: m => <span className="nowrap">{formatDate(m.movementDate)}</span> },
            { key: "item", header: "Item", render: m => m.item?.name ?? "—" },
            { key: "qty", header: "Quantity", align: "right", render: m => <span className="nowrap">{qty(m.quantityChange, m.item?.unit)}</span> },
            { key: "cost", header: "Unit cost", align: "right", render: m => money(m.unitCost) },
            { key: "value", header: "Value", align: "right", render: m => <strong>{money(m.totalValue)}</strong> }
          ]}
        />
      </div>
      <Link className="small" to={`/inventory/movements?vendorId=${vendor.id}&type=RECEIPT`}>
        All receipts from {vendor.name} in stock movements
      </Link>
    </div>
  );
}
