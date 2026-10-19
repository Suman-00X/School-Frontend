import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, Select, useToast } from "@/common/ui";
import { useApiMutation, useForm } from "@/common/hooks";
import { formatDate } from "@/common/utils/format";
import { MoneyInput, parseAmount, hasTooManyDecimals, useMoney } from "../../shared";
import { applyCredit } from "../api/credits";

type OpenInvoice = { id: string; invoiceNumber: string; balance: number; dueDate: string };

/* Use the student's credit on an open invoice. Amount: as much as the credit and the
   balance allow, unless lowered. With several open invoices, pick one first. */
export function ApplyCreditDialog({
  open,
  onClose,
  credit,
  invoices,
  invoiceId
}: {
  open: boolean;
  onClose: () => void;
  credit: number;
  invoices: OpenInvoice[];
  /* Fixed invoice (from its own page); else a picker over `invoices` */
  invoiceId?: string;
}) {
  const toast = useToast();
  const money = useMoney();
  const form = useForm({ invoiceId: invoiceId ?? "", amount: "" });
  const { reset } = form;
  const apply = useApiMutation(applyCredit, { invalidate: ["/finance/"] });
  const [touched, setTouched] = useState(false);

  const target = invoices.find(i => i.id === form.values.invoiceId);
  const max = target ? Math.min(credit, target.balance) : credit;

  useEffect(() => {
    if (!open) return;
    const only = invoiceId ?? (invoices.length === 1 ? invoices[0].id : "");
    const first = invoices.find(i => i.id === only);
    reset({ invoiceId: only, amount: first ? String(Math.min(credit, first.balance)) : "" });
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = useMemo(
    () => invoices.map(i => ({ value: i.id, label: i.invoiceNumber, description: `Balance ${money(i.balance)} · due ${formatDate(i.dueDate)}` })),
    [invoices, money]
  );

  const submit = () => {
    const amount = parseAmount(form.values.amount);
    const errors: Record<string, string> = {};
    if (!form.values.invoiceId) errors.invoiceId = "Pick an invoice";
    if (amount === null || amount <= 0) errors.amount = "Enter an amount";
    else if (hasTooManyDecimals(form.values.amount)) errors.amount = "At most 2 decimals";
    else if (amount > max) errors.amount = `At most ${money(max)}`;
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    apply.mutate(
      { invoiceId: form.values.invoiceId, amount: amount! },
      {
        onSuccess: res => {
          toast.success(res.message);
          onClose();
        },
        onError: err => form.setServerErrors(err)
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply credit"
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={apply.isPending} onClick={submit}>
            Apply credit
          </Button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <p>
          Credit available: <strong className="amount">{money(credit)}</strong>
        </p>
        {!invoiceId && (
          <Select
            label="Invoice"
            required
            value={form.values.invoiceId}
            options={options}
            placeholder="Pick an open invoice"
            error={form.errors.invoiceId}
            onChange={e => {
              form.set("invoiceId", e.target.value);
              const inv = invoices.find(i => i.id === e.target.value);
              if (inv && !touched) form.set("amount", String(Math.min(credit, inv.balance)));
            }}
          />
        )}
        <MoneyInput
          label="Amount"
          required
          value={form.values.amount}
          error={form.errors.amount}
          hint={target ? `At most ${money(max)}: the smaller of the credit and the balance` : undefined}
          onChange={e => {
            setTouched(true);
            form.set("amount", e.target.value);
          }}
        />
      </form>
    </Dialog>
  );
}
