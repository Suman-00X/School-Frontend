import { useEffect, useRef, type FormEvent } from "react";
import { useForm } from "@/common/hooks";
import { Button, Dialog, TextInput, Textarea } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { addDaysIso } from "../../shared/utils/labels";

export type IssueOptions = { issuedOn: string; backdateReason: string; dueDate: string; overrideReason: string };
export const NO_OPTIONS: IssueOptions = { issuedOn: "", backdateReason: "", dueDate: "", overrideReason: "" };

/* "Back-dated to 3 Oct · due 20 Oct · block overridden" */
export function optionsSummary(o: IssueOptions) {
  const parts = [
    o.issuedOn && o.issuedOn !== todayIso() && `Back-dated to ${formatDate(o.issuedOn)}`,
    o.dueDate && `due ${formatDate(o.dueDate)}`,
    o.overrideReason && "block overridden"
  ].filter(Boolean) as string[];
  if (!parts.length) return "";
  const s = parts.join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* LB-04 "More options": back-date, a custom due date, and (when blocked) override the block */
export function IssueOptionsDialog({
  open,
  value,
  blocked,
  focusOverride,
  onClose,
  onSave
}: {
  open: boolean;
  value: IssueOptions;
  /* The borrower has blocks: offer the override */
  blocked: boolean;
  focusOverride?: boolean;
  onClose: () => void;
  onSave: (o: IssueOptions) => void;
}) {
  const form = useForm<IssueOptions>(value);
  const overrideRef = useRef<HTMLTextAreaElement>(null);
  const { values } = form;
  const today = todayIso();

  useEffect(() => {
    if (!open) return;
    form.reset(value);
    if (focusOverride) setTimeout(() => overrideRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const backdated = !!values.issuedOn && values.issuedOn < today;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (values.issuedOn && values.issuedOn > today) errs.issuedOn = "can't be in the future";
    if (values.issuedOn && values.issuedOn < addDaysIso(-365)) errs.issuedOn = "must be within the last 365 days";
    if (backdated && !values.backdateReason.trim()) errs.backdateReason = "Say why the loan is recorded late";
    if (values.dueDate && values.dueDate < today) errs.dueDate = "can't be in the past";
    if (values.dueDate && values.issuedOn && values.dueDate < values.issuedOn) errs.dueDate = "can't be before the issue date";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      issuedOn: backdated ? values.issuedOn : "",
      backdateReason: backdated ? values.backdateReason.trim() : "",
      dueDate: values.dueDate,
      overrideReason: blocked ? values.overrideReason.trim() : ""
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Issue options"
      footer={
        <>
          <Button onClick={() => onSave(NO_OPTIONS)}>Clear all</Button>
          <Button type="submit" form="issue-options" variant="primary">
            Use these
          </Button>
        </>
      }
    >
      <form id="issue-options" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextInput
            label="Issued on"
            type="date"
            max={today}
            min={addDaysIso(-365)}
            {...form.text("issuedOn")}
            hint="Blank: today. Earlier dates record a loan after the fact"
          />
          <TextInput label="Due on" type="date" min={values.issuedOn && values.issuedOn > today ? values.issuedOn : today} {...form.text("dueDate")} hint="Blank: from the circulation rule" />
        </div>
        <Textarea
          label="Why it is back-dated"
          rows={2}
          maxLength={500}
          {...form.text("backdateReason")}
          disabled={!backdated}
          required={backdated}
          placeholder={backdated ? "e.g. Copied from the paper issue register" : "Only for an earlier issue date"}
        />
        {blocked && (
          <Textarea
            ref={overrideRef}
            label="Override the block"
            rows={2}
            maxLength={500}
            {...form.text("overrideReason")}
            placeholder="Why lend despite the block, e.g. Exam preparation"
            hint="Lends despite overdue books or unpaid fines. The reason is kept on the loan"
          />
        )}
      </form>
    </Dialog>
  );
}
