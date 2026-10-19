import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BookCheck, Ban, HandCoins, RotateCw, SearchCheck, Undo2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useForm } from "@/common/hooks";
import { Button, DescriptionList, Dialog, Field, RadioGroup, TextInput, Textarea, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import type { FineMethod, Loan, ReturnCondition } from "../../shared/api/types";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { FINE_METHOD_LABELS, isMoney, plural } from "../../shared/utils/labels";
import { useAccount, usePayFine, useRecordFound, useRenew, useReturn, useWaiveFine } from "../api/loans";

export type LoanAction = { id: string; label: string; icon: ReactNode; run: () => void; danger?: boolean };

/* A fine that still grows says so */
export function FineAmount({ loan, value }: { loan: Pick<Loan, "fineIsFinal" | "status">; value: number }) {
  const money = useMoney();
  if (!value) return <span className="muted">—</span>;
  return (
    <span className="num nowrap">
      {money(value)}
      {!loan.fineIsFinal && loan.status === "ISSUED" && <span className="muted small"> so far</span>}
    </span>
  );
}

/* Return conditions, explained */
export function ConditionFields({
  condition,
  onCondition,
  damageCharge,
  onDamageCharge,
  damageError,
  disabled
}: {
  condition: ReturnCondition;
  onCondition: (c: ReturnCondition) => void;
  damageCharge: string;
  onDamageCharge: (v: string) => void;
  damageError?: string;
  disabled?: boolean;
}) {
  const currency = useSchoolCurrency();
  return (
    <>
      <Field label="Condition">
        <RadioGroup<ReturnCondition>
          aria-label="Condition"
          value={condition}
          onChange={onCondition}
          disabled={disabled}
          options={[
            { value: "OK", label: "Fine", description: "Back on the shelf, or held for the next reader" },
            { value: "DAMAGED", label: "Damaged", description: "Charge for repair or replacement" },
            { value: "LOST", label: "Lost", description: "Charges the replacement cost (price, fees, late fine)" }
          ]}
        />
      </Field>
      {/* Always here (disabled unless damaged), so choosing a condition moves nothing */}
      <TextInput
        label={`Damage charge (${currency})`}
        inputMode="decimal"
        value={damageCharge}
        onChange={e => onDamageCharge(e.target.value)}
        disabled={disabled || condition !== "DAMAGED"}
        error={damageError}
        hint={condition === "DAMAGED" ? "Optional; blank charges nothing" : condition === "LOST" ? "The lost charge follows the library policy" : "Only for a damaged return"}
      />
    </>
  );
}

/* Row and drawer actions on a loan (renew, return, collect, waive, found) with their dialogs.
   const { actionsFor, dialogs } = useLoanActions(); … {dialogs} */
export type LoanActionKind = "return" | "renew" | "pay" | "waive" | "found";

export function useLoanActions({ onDone }: { onDone?: (loan: Loan, kind: LoanActionKind, message: string) => void } = {}) {
  const { can } = useAuth();
  const toast = useToast();
  const renew = useRenew();
  const [open, setOpen] = useState<{ kind: "return" | "pay" | "waive" | "found"; loan: Loan } | null>(null);
  const circulate = can("library.loans.circulate");
  const waive = can("library.loans.waiveFine");

  const doRenew = (loan: Loan) =>
    renew.mutate(loan.id, {
      onSuccess: res => {
        toast.success(`${loan.book.title}: ${res.message}`);
        onDone?.(res.data, "renew", `${loan.book.title}: ${res.message}`);
      },
      onError: err => toast.error(err)
    });

  const actionsFor = (loan: Loan): LoanAction[] => {
    const owes = loan.fineOutstanding > 0;
    const out: (LoanAction | false)[] = [
      circulate && loan.status === "ISSUED" && { id: "return", label: "Return", icon: <Undo2 />, run: () => setOpen({ kind: "return", loan }) },
      circulate && loan.status === "ISSUED" && { id: "renew", label: "Renew", icon: <RotateCw />, run: () => doRenew(loan) },
      circulate && loan.status === "LOST" && { id: "found", label: "Record found", icon: <SearchCheck />, run: () => setOpen({ kind: "found", loan }) },
      circulate && owes && { id: "pay", label: "Collect fine", icon: <HandCoins />, run: () => setOpen({ kind: "pay", loan }) },
      waive && owes && { id: "waive", label: "Waive fine", icon: <Ban />, run: () => setOpen({ kind: "waive", loan }) }
    ];
    return out.filter(Boolean) as LoanAction[];
  };

  const close = () => setOpen(null);
  const doneAs = (kind: LoanActionKind) => (loan: Loan, message: string) => {
    close();
    onDone?.(loan, kind, message);
  };

  const dialogs = (
    <>
      <ReturnDialog loan={open?.kind === "return" ? open.loan : null} onClose={close} onDone={doneAs("return")} />
      <CollectFineDialog loan={open?.kind === "pay" ? open.loan : null} onClose={close} onDone={doneAs("pay")} />
      <WaiveFineDialog loan={open?.kind === "waive" ? open.loan : null} onClose={close} onDone={doneAs("waive")} />
      <RecordFoundDialog loan={open?.kind === "found" ? open.loan : null} onClose={close} onDone={doneAs("found")} />
    </>
  );

  return { actionsFor, dialogs, renewing: renew.isPending, openPay: (loan: Loan) => setOpen({ kind: "pay", loan }) };
}

/* What the desk says after a return */
export function useReturnToasts() {
  const toast = useToast();
  return (loan: Loan, message: string) => {
    toast.success(message);
    if (loan.copy.status === "ON_HOLD") toast.warning(`Keep ${loan.copy.accessionNumber} at the desk: it is held for the next reader.`);
  };
}

function LoanSummary({ loan }: { loan: Loan }) {
  const money = useMoney();
  return (
    <DescriptionList
      columns={2}
      items={[
        { label: "Borrower", value: loan.borrower.name },
        { label: "Copy", value: <span className="mono">{loan.copy.accessionNumber}</span> },
        {
          label: "Due",
          value: (
            <span className={loan.isOverdue ? "text-danger" : undefined}>
              {formatDate(loan.dueDate)}
              {loan.isOverdue && ` · ${plural(loan.daysOverdue, "day")} late`}
            </span>
          )
        },
        { label: "Fine so far", value: loan.fineOutstanding ? money(loan.fineOutstanding) : "None" }
      ]}
    />
  );
}

function ReturnDialog({ loan, onClose, onDone }: { loan: Loan | null; onClose: () => void; onDone: (l: Loan, message: string) => void }) {
  const ret = useReturn();
  const say = useReturnToasts();
  const [condition, setCondition] = useState<ReturnCondition>("OK");
  const form = useForm({ damageCharge: "", notes: "" });

  useEffect(() => {
    if (loan) {
      setCondition("OK");
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id]);

  if (!loan) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const charge = form.values.damageCharge.trim();
    if (condition === "DAMAGED" && charge && (!isMoney(charge) || Number(charge) <= 0)) return form.setErrors({ damageCharge: "must be an amount above 0" });
    form.setFormError(null);
    ret.mutate(
      {
        id: loan.id,
        condition,
        ...(condition === "DAMAGED" && charge ? { damageCharge: Number(charge) } : {}),
        ...(form.values.notes.trim() ? { notes: form.values.notes.trim() } : {})
      },
      {
        onSuccess: res => {
          say(res.data, res.message);
          onDone(res.data, res.message);
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Return ${loan.book.title}`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="return-form" variant={condition === "LOST" ? "danger" : "primary"} loading={ret.isPending} icon={<BookCheck />}>
            {condition === "LOST" ? "Record as lost" : "Return"}
          </Button>
        </>
      }
    >
      <form id="return-form" className="stack" onSubmit={submit} noValidate>
        <LoanSummary loan={loan} />
        <ConditionFields
          condition={condition}
          onCondition={setCondition}
          damageCharge={form.values.damageCharge}
          onDamageCharge={v => form.set("damageCharge", v)}
          damageError={form.errors.damageCharge}
        />
        <Textarea label="Notes" rows={2} maxLength={500} {...form.text("notes")} />
      </form>
    </Dialog>
  );
}

export function CollectFineDialog({ loan, onClose, onDone }: { loan: Loan | null; onClose: () => void; onDone: (l: Loan, message: string) => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const money = useMoney();
  const currency = useSchoolCurrency();
  const pay = usePayFine();
  const account = useAccount(loan?.borrowerUserId ?? null, !!loan && can("library.loans.read"));
  const [method, setMethod] = useState<FineMethod>("CASH");
  const form = useForm({ amount: "", reference: "" });
  const credit = account.data?.credit ?? 0;

  useEffect(() => {
    if (loan) {
      setMethod("CASH");
      form.reset({ amount: String(loan.fineOutstanding), reference: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id]);

  if (!loan) return null;
  const methods: FineMethod[] = credit > 0 ? ["CASH", "UPI", "CARD", "LIBRARY_CREDIT"] : ["CASH", "UPI", "CARD"];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = form.values.amount.trim();
    if (!isMoney(amount) || Number(amount) <= 0) return form.setErrors({ amount: "must be an amount above 0" });
    if (Number(amount) > loan.fineOutstanding) return form.setErrors({ amount: `must be at most ${money(loan.fineOutstanding)}` });
    form.setFormError(null);
    pay.mutate(
      { id: loan.id, amount: Number(amount), method, ...(form.values.reference.trim() ? { reference: form.values.reference.trim() } : {}) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone(res.data.loan, res.message);
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Collect a fine from ${loan.borrower.name}`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pay-form" variant="primary" loading={pay.isPending} icon={<HandCoins />}>
            Collect
          </Button>
        </>
      }
    >
      <form id="pay-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted">
          {loan.book.title} · {money(loan.fineOutstanding)} outstanding
          {loan.status === "ISSUED" && !loan.fineIsFinal ? " so far (the book is still out; the fine can be paid now)" : ""}.
        </p>
        <div className="form-grid">
          <TextInput label={`Amount (${currency})`} required autoFocus inputMode="decimal" {...form.text("amount")} hint="May be less than what is owed" />
          <TextInput
            label="Reference"
            maxLength={100}
            {...form.text("reference")}
            disabled={method === "CASH" || method === "LIBRARY_CREDIT"}
            hint={method === "UPI" || method === "CARD" ? "Transaction id, optional" : "For UPI and card payments"}
          />
        </div>
        <Field label="Paid by" hint={credit > 0 ? `${money(credit)} library credit available` : "No library credit on this account"}>
          <RadioGroup<FineMethod> aria-label="Paid by" value={method} onChange={setMethod} options={methods.map(m => ({ value: m, label: FINE_METHOD_LABELS[m] }))} />
        </Field>
      </form>
    </Dialog>
  );
}

function WaiveFineDialog({ loan, onClose, onDone }: { loan: Loan | null; onClose: () => void; onDone: (l: Loan, message: string) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const currency = useSchoolCurrency();
  const waive = useWaiveFine();
  const form = useForm({ amount: "", reason: "" });

  useEffect(() => {
    if (loan) form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id]);

  if (!loan) return null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = form.values.amount.trim();
    const errs: Record<string, string> = {};
    if (amount && (!isMoney(amount) || Number(amount) <= 0)) errs.amount = "must be an amount above 0, or blank";
    else if (amount && Number(amount) > loan.fineOutstanding) errs.amount = `must be at most ${money(loan.fineOutstanding)}`;
    if (!form.values.reason.trim()) errs.reason = "Say why the fine is waived";
    form.setErrors(errs);
    if (Object.keys(errs).length) return;
    const what = amount ? money(Number(amount)) : `everything owed so far (${money(loan.fineOutstanding)})`;
    const ok = await confirm({
      title: `Waive ${amount ? money(Number(amount)) : "the fine"} for ${loan.borrower.name}?`,
      message: `${what} on ${loan.book.title} will no longer be owed. This can't be undone.`,
      confirmLabel: "Waive"
    });
    if (!ok) return;
    form.setFormError(null);
    waive.mutate(
      { id: loan.id, reason: form.values.reason.trim(), ...(amount ? { amount: Number(amount) } : {}) },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone(res.data.loan, res.message);
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Waive a fine for ${loan.borrower.name}`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="waive-form" variant="danger" loading={waive.isPending} icon={<Ban />}>
            Waive
          </Button>
        </>
      }
    >
      <form id="waive-form" className="stack" onSubmit={e => void submit(e)} noValidate>
        <p className="muted">
          {loan.book.title} · {money(loan.fineOutstanding)} outstanding{loan.status === "ISSUED" ? " so far; days still to come can add to it" : ""}.
        </p>
        <TextInput label={`Amount (${currency})`} autoFocus inputMode="decimal" placeholder="Everything owed so far" {...form.text("amount")} hint="Blank waives the whole fine so far" />
        <Textarea label="Reason" required rows={2} maxLength={500} {...form.text("reason")} placeholder="e.g. Book returned late because of illness" />
      </form>
    </Dialog>
  );
}

function RecordFoundDialog({ loan, onClose, onDone }: { loan: Loan | null; onClose: () => void; onDone: (l: Loan, message: string) => void }) {
  const toast = useToast();
  const found = useRecordFound();
  const form = useForm({ notes: "" });

  useEffect(() => {
    if (loan) form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id]);

  if (!loan) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.setFormError(null);
    found.mutate(
      { id: loan.id, notes: form.values.notes.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          onDone(res.data, res.message);
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${loan.book.title} was found`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="found-form" variant="primary" loading={found.isPending} icon={<SearchCheck />}>
            Record found
          </Button>
        </>
      }
    >
      <form id="found-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted">
          Copy {loan.copy.accessionNumber}, lost by {loan.borrower.name} on {formatDate(loan.lostOn)}, goes back into circulation. If it is back within the
          library's refund period, the replacement charge is reversed; anything already paid beyond what is still owed becomes library credit.
        </p>
        <Textarea label="Notes" rows={2} maxLength={500} autoFocus {...form.text("notes")} />
      </form>
    </Dialog>
  );
}
