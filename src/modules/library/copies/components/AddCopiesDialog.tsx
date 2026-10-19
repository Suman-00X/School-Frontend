import { useEffect, useState, type FormEvent } from "react";
import { Copy as CopyIcon } from "lucide-react";
import { useForm } from "@/common/hooks";
import { Badge, Button, Dialog, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import type { Book, Copy, ItemType } from "../../shared/api/types";
import { ITEM_TYPE_LABELS, isMoney, isWhole, itemTypeOptions } from "../../shared/utils/labels";
import { useAddCopies } from "../api/copies";

const EMPTY = { count: "1", price: "", acquiredOn: "", source: "", itemType: "", conditionNotes: "" };

/* LB-03 · Add copies: how many and their shared details; then the new accession numbers for labels */
export function AddCopiesDialog({ open, book, onClose }: { open: boolean; book: Book; onClose: () => void }) {
  const toast = useToast();
  const currency = useSchoolCurrency();
  const form = useForm(EMPTY);
  const add = useAddCopies();
  const [added, setAdded] = useState<Copy[] | null>(null);
  const { values } = form;

  useEffect(() => {
    if (open) {
      form.reset({ ...EMPTY, acquiredOn: todayIso() });
      setAdded(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!isWhole(values.count) || Number(values.count) < 1 || Number(values.count) > 100) errs.count = "must be 1 to 100";
    if (values.price.trim() && !isMoney(values.price)) errs.price = "must be an amount with at most 2 decimals";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    form.setFormError(null);
    add.mutate(
      {
        bookId: book.id,
        count: Number(values.count),
        ...(values.price.trim() ? { price: Number(values.price) } : {}),
        ...(values.acquiredOn ? { acquiredOn: values.acquiredOn } : {}),
        ...(values.source.trim() ? { source: values.source.trim() } : {}),
        ...(values.itemType ? { itemType: values.itemType as ItemType } : {}),
        ...(values.conditionNotes.trim() ? { conditionNotes: values.conditionNotes.trim() } : {})
      },
      {
        onSuccess: res => {
          toast.success(res.message);
          setAdded(res.data.copies);
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  const codes = added?.map(c => c.accessionNumber) ?? [];
  const copyCodes = () => {
    void navigator.clipboard?.writeText(codes.join("\n"));
    toast.success(`${codes.length} accession number${codes.length === 1 ? "" : "s"} copied`);
  };

  if (added)
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={`${added.length} cop${added.length === 1 ? "y" : "ies"} added`}
        footer={
          <>
            <Button icon={<CopyIcon />} onClick={copyCodes}>
              Copy numbers
            </Button>
            <Button variant="primary" onClick={onClose} autoFocus>
              Done
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="muted">Write these accession numbers on the copies' labels of {book.title}:</p>
          <div className="lib-codes">
            {codes.map(c => (
              <Badge key={c} tone="primary">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      </Dialog>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add copies of ${book.title}`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-copies-form" variant="primary" loading={add.isPending}>
            Add copies
          </Button>
        </>
      }
    >
      <form id="add-copies-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput label="How many" required autoFocus inputMode="numeric" {...form.text("count")} hint="1 to 100; each gets its own accession number" />
          <TextInput label={`Price each (${currency})`} inputMode="decimal" {...form.text("price")} hint="Caps late fines and sets the lost charge" />
          <TextInput label="Acquired on" type="date" max={todayIso()} {...form.text("acquiredOn")} />
          <TextInput label="Source" maxLength={200} placeholder="Vendor or donor" {...form.text("source")} />
          <Select
            label="Item type"
            {...form.text("itemType")}
            placeholder={`Same as the book (${ITEM_TYPE_LABELS[book.itemType]})`}
            options={itemTypeOptions()}
            fieldClassName="span-2"
            hint="Only to make these copies different, e.g. a reference copy"
          />
        </div>
        <Textarea label="Condition notes" rows={2} maxLength={500} {...form.text("conditionNotes")} />
      </form>
    </Dialog>
  );
}
