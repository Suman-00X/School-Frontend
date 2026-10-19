import { useEffect, useState, type ReactNode } from "react";
import { Button, Dialog, TextInput, Textarea, type ButtonProps } from "@/common/ui";
import { useForm } from "@/common/hooks";
import { todayIso } from "@/common/utils/format";

/* A confirmation that needs a written reason (cancel an invoice, waive a late fee, reject a
   refund, reverse an entry). `onSubmit` rejects with the API error, which lands on the field
   or in the footer; the dialog closes itself only on success. */
export function ReasonDialog({
  open,
  onClose,
  title,
  message,
  label = "Reason",
  hint,
  confirmLabel,
  tone = "danger",
  withDate,
  dateLabel = "Date",
  dateHint,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: ReactNode;
  label?: string;
  hint?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  /* An optional date field (not in the future), sent as `date` */
  withDate?: boolean;
  dateLabel?: string;
  dateHint?: string;
  onSubmit: (values: { reason: string; date?: string }) => Promise<unknown>;
}) {
  const form = useForm({ reason: "", date: "" });
  const { reset } = form;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = async () => {
    if (!form.values.reason.trim()) {
      form.setErrors({ reason: "Write a reason" });
      return;
    }
    try {
      await onSubmit({ reason: form.values.reason.trim(), date: form.values.date || undefined });
      onClose();
    } catch (err) {
      form.setServerErrors(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <AsyncButton variant={tone} onClick={submit}>
            {confirmLabel}
          </AsyncButton>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        {message && <div>{message}</div>}
        <Textarea {...form.text("reason")} label={label} hint={hint} required rows={3} maxLength={500} autoFocus />
        {withDate && <TextInput {...form.text("date")} type="date" label={dateLabel} hint={dateHint} max={todayIso()} />}
      </form>
    </Dialog>
  );
}

/* A button that shows its own spinner while the promise it started runs */
export function AsyncButton({ onClick, ...rest }: Omit<ButtonProps, "onClick"> & { onClick: () => Promise<unknown> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...rest}
      loading={busy || rest.loading}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
