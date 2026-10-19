import { useEffect, useState, type FormEvent } from "react";
import { BookmarkPlus, X } from "lucide-react";
import { useForm } from "@/common/hooks";
import { Button, Dialog, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import type { Hold } from "../../shared/api/types";
import { BookSelect, BorrowerSelect } from "../../shared/components/LibraryBits";
import type { Borrower } from "../../shared/hooks/useLibraryLookups";
import { useCancelHold, usePlaceHold } from "../api/holds";

/* LB-06 · Place a hold for a borrower at the desk (book or borrower may come filled in) */
export function PlaceHoldDialog({
  open,
  onClose,
  bookId,
  borrower
}: {
  open: boolean;
  onClose: () => void;
  bookId?: string;
  borrower?: Borrower;
}) {
  const toast = useToast();
  const place = usePlaceHold();
  const form = useForm({ bookId: "", borrowerUserId: "", notNeededAfter: "" });
  const { values } = form;

  useEffect(() => {
    if (open) form.reset({ bookId: bookId ?? "", borrowerUserId: borrower?.userId ?? "", notNeededAfter: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!values.bookId) errs.bookId = "Pick the book";
    if (!values.borrowerUserId) errs.borrowerUserId = "Pick who it is for";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    form.setFormError(null);
    place.mutate(
      { bookId: values.bookId, borrowerUserId: values.borrowerUserId, ...(values.notNeededAfter ? { notNeededAfter: values.notNeededAfter } : {}) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        /* 409 already held, 422 hold limit, reference book, no rule, already on loan: shown as they are */
        onError: err => form.setServerErrors(err)
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Place a hold"
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="hold-form" variant="primary" loading={place.isPending} icon={<BookmarkPlus />}>
            Place hold
          </Button>
        </>
      }
    >
      <form id="hold-form" className="stack" onSubmit={submit} noValidate>
        <BookSelect value={values.bookId} onChange={e => form.set("bookId", e.target.value)} required error={form.errors.bookId} disabled={!!bookId} />
        <BorrowerSelect
          label="For"
          value={values.borrowerUserId}
          onChange={e => form.set("borrowerUserId", e.target.value)}
          required
          error={form.errors.borrowerUserId}
          known={borrower ? [borrower] : []}
          disabled={!!borrower}
        />
        <TextInput
          label="Not needed after"
          type="date"
          min={todayIso()}
          {...form.text("notNeededAfter")}
          hint="Optional. The hold lapses if no copy comes back by then"
        />
        <p className="small muted">When a copy is free it is kept at the desk for the reader, who is told to collect it.</p>
      </form>
    </Dialog>
  );
}

/* Cancel a hold, with an optional reason (a ready hold's copy moves on) */
export function CancelHoldDialog({ hold, onClose, onDone }: { hold: Hold | null; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const cancel = useCancelHold();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setError(null);
  }, [hold?.id]);

  if (!hold) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    cancel.mutate(
      { id: hold.id, reason: reason.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message || "Hold cancelled");
          onDone?.();
          onClose();
        },
        onError: err => setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      }
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Cancel ${hold.borrower.name}'s hold on ${hold.book.title}?`}
      footerStatus={error}
      footer={
        <>
          <Button onClick={onClose}>Keep the hold</Button>
          <Button type="submit" form="cancel-hold-form" variant="danger" loading={cancel.isPending} icon={<X />}>
            Cancel hold
          </Button>
        </>
      }
    >
      <form id="cancel-hold-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted">
          {hold.status === "READY" && hold.copy
            ? `Copy ${hold.copy.accessionNumber}, kept until ${formatDate(hold.pickupBy)}, goes to the next reader waiting, or back to the shelf.`
            : "They leave the queue for this book. Others waiting move up."}
        </p>
        <Textarea label="Reason" rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional, e.g. No longer needed" autoFocus />
      </form>
    </Dialog>
  );
}
