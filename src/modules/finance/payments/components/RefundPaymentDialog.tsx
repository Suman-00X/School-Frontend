import { useEffect } from "react";
import { Alert, Button, Dialog, Select, TextInput, Textarea, useToast } from "@/common/ui";
import { useApiMutation, useForm } from "@/common/hooks";
import { MoneyInput, hasTooManyDecimals, parseAmount, useMoney } from "../../shared";
import { METHOD_LABELS, type RefundMethod } from "../../shared/api/records";
import { refundPayment, refundable, type Payment } from "../api/payments";
import { useRefundOutcome } from "../api/financeSettings";

const METHOD_HINTS: Record<RefundMethod, string> = {
  ORIGINAL: "Through the payment gateway, to the card or UPI that paid",
  CASH: "Handed over at the counter",
  CHEQUE: "A cheque from the school",
  UPI: "Sent by UPI",
  BANK_TRANSFER: "Sent to the family's bank account"
};

/* FI-09 refund dialog: part or all of what is still refundable on a payment */
export function RefundPaymentDialog({ payment, open, onClose }: { payment: Payment; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const money = useMoney();
  const outcome = useRefundOutcome();
  const online = payment.method === "ONLINE";
  const max = refundable(payment);
  const form = useForm({ amount: String(max), method: (online ? "ORIGINAL" : "") as RefundMethod | "", reference: "", reason: "" });
  const { reset } = form;
  const refund = useApiMutation(refundPayment, { invalidate: ["/finance/"] });

  useEffect(() => {
    if (open) reset({ amount: String(refundable(payment)), method: payment.method === "ONLINE" ? "ORIGINAL" : "", reference: "", reason: "" });
  }, [open, payment, reset]);

  const methods: RefundMethod[] = online ? ["ORIGINAL", "CASH", "CHEQUE", "UPI", "BANK_TRANSFER"] : ["CASH", "CHEQUE", "UPI", "BANK_TRANSFER"];
  const method = form.values.method;
  const needsRef = method === "CHEQUE" || method === "UPI" || method === "BANK_TRANSFER";
  const amount = parseAmount(form.values.amount);

  const submit = () => {
    const errors: Record<string, string> = {};
    if (amount === null || amount <= 0) errors.amount = "Enter an amount";
    else if (hasTooManyDecimals(form.values.amount)) errors.amount = "At most 2 decimals";
    else if (amount > max) errors.amount = `At most ${money(max)} can still be refunded`;
    if (!method) errors.method = "Pick how the money goes back";
    if (needsRef && !form.values.reference.trim()) errors.reference = "Enter the cheque number or transaction reference";
    if (!form.values.reason.trim()) errors.reason = "Write a reason";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    refund.mutate(
      {
        paymentId: payment.id,
        amount: amount!,
        method: method as RefundMethod,
        reason: form.values.reason.trim(),
        reference: needsRef ? form.values.reference.trim() : undefined
      },
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
      title={`Refund ${payment.receiptNumber ?? "this payment"}`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={refund.isPending} onClick={submit}>
            Refund
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
        <div className="form-grid">
          <MoneyInput
            label="Amount"
            required
            value={form.values.amount}
            error={form.errors.amount}
            hint={`Up to ${money(max)}`}
            onChange={e => form.set("amount", e.target.value)}
          />
          <Select
            label="Paid back by"
            required
            value={method}
            error={form.errors.method}
            placeholder="Pick a method"
            options={methods.map(m => ({ value: m, label: METHOD_LABELS[m], description: METHOD_HINTS[m] }))}
            onChange={e => form.set("method", e.target.value as RefundMethod)}
          />
        </div>
        <TextInput
          label="Reference"
          required={needsRef}
          disabled={!needsRef}
          value={needsRef ? form.values.reference : ""}
          error={form.errors.reference}
          hint={needsRef ? "Cheque number, UPI or bank reference" : "Not needed for this method"}
          maxLength={100}
          onChange={e => form.set("reference", e.target.value)}
        />
        <Textarea label="Reason" required rows={2} maxLength={500} {...form.text("reason")} />
        <Alert tone="info">{outcome(amount, money)}</Alert>
      </form>
    </Dialog>
  );
}
