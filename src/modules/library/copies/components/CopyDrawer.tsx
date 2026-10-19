import { useEffect, type FormEvent } from "react";
import { isApiError } from "@/common/api";
import { Link } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { useApiGet, useForm } from "@/common/hooks";
import { Button, DescriptionList, Drawer, ErrorState, Select, SkeletonBlock, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import type { Copy, CopyStatus, ItemType } from "../../shared/api/types";
import { CopyStatusBadge } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { COPY_STATUS_LABELS, ITEM_TYPE_LABELS, MANUAL_COPY_STATUSES, SCAN_CODE, isMoney, itemTypeOptions } from "../../shared/utils/labels";
import { COPIES_PATH, useUpdateCopy, type CopyChanges } from "../api/copies";

type Values = { status: string; barcode: string; itemType: string; price: string; acquiredOn: string; source: string; conditionNotes: string };

const toValues = (c: Copy): Values => ({
  status: c.status,
  barcode: c.barcode ?? "",
  itemType: c.itemType ?? "",
  price: c.price === null ? "" : String(c.price),
  acquiredOn: c.acquiredOn ?? "",
  source: c.source ?? "",
  conditionNotes: c.conditionNotes ?? ""
});

const EMPTY: Values = { status: "", barcode: "", itemType: "", price: "", acquiredOn: "", source: "", conditionNotes: "" };

/* What a status change does to holds (said in the drawer before saving) */
const statusNote = (from: CopyStatus, to: string) => {
  if (from === to) return null;
  if (from === "ON_HOLD") return "This copy is held for a reader: taking it off the shelf sends their hold back to the queue.";
  if (to === "AVAILABLE") return "Back on the shelf: if someone is waiting for this book, the copy is held for them.";
  if (to === "WITHDRAWN") return "Withdrawn copies leave the collection; there is no delete.";
  return null;
};

const STATUS_HINTS: Partial<Record<CopyStatus, string>> = {
  AVAILABLE: "On the shelf, can be lent",
  LOST: "Lost outside a loan",
  DAMAGED: "Kept in the library, not lent",
  WITHDRAWN: "Removed from the collection",
  MISSING: "Not found on the shelf"
};

/* LB-03 copy drawer (from the Copies tab or a scan). On loan or held copies change only through circulation. */
export function CopyDrawer({ copyId, onClose, showBook = true }: { copyId: string | null; onClose: () => void; showBook?: boolean }) {
  const { can } = useAuth();
  const canEdit = can("library.copies.manage");
  const toast = useToast();
  const money = useMoney();
  const currency = useSchoolCurrency();
  const q = useApiGet<Copy>(copyId ? `${COPIES_PATH}/${copyId}` : null);
  const update = useUpdateCopy();
  const form = useForm<Values>(EMPTY);
  const copy = q.data;
  const { values } = form;

  useEffect(() => {
    if (copy) form.reset(toValues(copy));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy?.id, copy?.updatedAt]);

  const circulating = copy?.status === "ISSUED";
  const statusLocked = circulating;
  const note = copy ? statusNote(copy.status, values.status) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!copy) return;
    const errs: Record<string, string> = {};
    if (values.barcode.trim() && !SCAN_CODE.test(values.barcode.trim())) errs.barcode = "must be 3-64 letters, digits or -";
    if (values.price.trim() && !isMoney(values.price)) errs.price = "must be an amount with at most 2 decimals";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    const before = toValues(copy);
    const changes: CopyChanges = {};
    if (values.status !== before.status) changes.status = values.status as CopyStatus;
    if (values.barcode.trim() !== before.barcode) changes.barcode = values.barcode.trim() || null;
    if (values.itemType !== before.itemType) changes.itemType = (values.itemType || null) as ItemType | null;
    if (values.price.trim() !== before.price) changes.price = values.price.trim() ? Number(values.price) : null;
    if (values.acquiredOn !== before.acquiredOn) changes.acquiredOn = values.acquiredOn || null;
    if (values.source.trim() !== before.source) changes.source = values.source.trim();
    if (values.conditionNotes.trim() !== before.conditionNotes) changes.conditionNotes = values.conditionNotes.trim();
    if (!Object.keys(changes).length) return onClose();
    form.setFormError(null);
    update.mutate(
      { id: copy.id, ...changes },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => {
          /* 409 "Barcode … is already used by copy …" belongs to the barcode field */
          if (isApiError(err) && err.status === 409 && /barcode/i.test(err.message)) {
            form.setErrors({ barcode: err.message });
            form.setFormError(null);
          } else form.setServerErrors(err);
        }
      }
    );
  };

  const title = copy ? copy.accessionNumber : "Copy";
  const subtitle = copy?.book && (showBook ? <Link to={`/library/books/${copy.book.id}`}>{copy.book.title}</Link> : copy.book.title);

  const statusOptions = [
    ...(copy && !MANUAL_COPY_STATUSES.includes(copy.status) ? [{ value: copy.status, label: COPY_STATUS_LABELS[copy.status], disabled: true }] : []),
    ...MANUAL_COPY_STATUSES.map(s => ({ value: s, label: COPY_STATUS_LABELS[s], description: STATUS_HINTS[s] }))
  ];

  return (
    <Drawer
      open={!!copyId}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footerStatus={form.formError}
      footer={
        canEdit && copy ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" form="copy-form" variant="primary" loading={update.isPending}>
              Save changes
            </Button>
          </>
        ) : undefined
      }
    >
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !copy ? (
        <SkeletonBlock lines={8} />
      ) : !canEdit ? (
        <DescriptionList
          columns={2}
          items={[
            { label: "Status", value: <CopyStatusBadge status={copy.status} /> },
            { label: "Barcode", value: copy.barcode && <span className="mono">{copy.barcode}</span> },
            { label: "Item type", value: copy.itemType ? ITEM_TYPE_LABELS[copy.itemType] : "Same as the book" },
            { label: "Price", value: money(copy.price) },
            { label: "Acquired", value: formatDate(copy.acquiredOn) },
            { label: "Source", value: copy.source },
            { label: "Condition", value: copy.conditionNotes, wide: true }
          ]}
        />
      ) : (
        <form id="copy-form" className="stack" onSubmit={submit} noValidate>
          <Select
            label="Status"
            {...form.text("status")}
            options={statusOptions}
            disabled={statusLocked}
            hint={
              statusLocked ? (
                "On loan: record its return at the desk instead"
              ) : note ? (
                <span className="text-warning">{note}</span>
              ) : copy.status === "ON_HOLD" ? (
                "Held at the desk for a reader; it changes when they collect it"
              ) : (
                "On loan and held change only through the desk"
              )
            }
          />
          <div className="form-grid">
            <TextInput label="Barcode" maxLength={64} className="mono" placeholder="Scan or type" {...form.text("barcode")} hint="Optional; scans find the copy by it" />
            <Select
              label="Item type"
              {...form.text("itemType")}
              placeholder="Same as the book"
              options={itemTypeOptions()}
              hint="e.g. one reference copy of a lending book"
            />
            <TextInput label={`Price (${currency})`} inputMode="decimal" {...form.text("price")} hint="Caps late fines; the lost charge starts here" />
            <TextInput label="Acquired on" type="date" {...form.text("acquiredOn")} />
            <TextInput label="Source" maxLength={200} placeholder="Vendor or donor" fieldClassName="span-2" {...form.text("source")} />
          </div>
          <Textarea label="Condition notes" rows={2} maxLength={500} {...form.text("conditionNotes")} />
        </form>
      )}
    </Drawer>
  );
}
