import { useEffect } from "react";
import { Alert, Button, Dialog, Field, TextInput, Textarea, useToast } from "@/common/ui";
import { useApiMutation, useForm } from "@/common/hooks";
import { MoneyInput, hasTooManyDecimals, parseAmount, useMoney } from "../../shared";
import { METHOD_LABELS } from "../../shared/api/records";
import { useRefundOutcome } from "../../payments/api/financeSettings";
import { refundCredit, type CreditRefundInput } from "../api/credits";
import "../../shared/operations.css";

type Method = CreditRefundInput["method"];
const METHODS: Method[] = ["CASH", "CHEQUE", "UPI", "BANK_TRANSFER"];

/* FI-11 "Pay back": the student's credit paid to the family, a refund like any other
   (request, approval or the limit, number, refund receipt, ledger entry: D-63) */
export function PayBackCreditDialog({ studentId, studentName, credit, open, onClose }: { studentId: string; studentName: string; credit: number; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const money = useMoney();
  const outcome = useRefundOutcome();
  const form = useForm({ amount: String(credit), method: "CASH" as Method, reference: "", reason: "" });
  const { reset } = form;
  const payBack = useApiMutation(refundCredit, { invalidate: ["/finance/"] });

  useEffect(() => {
    if (open) reset({ amount: String(credit), method: "CASH", reference: "", reason: "" });
  }, [open, credit, reset]);

  const method = form.values.method;
  const needsRef = method !== "CASH";
  const amount = parseAmount(form.values.amount);

  const submit = () => {
    const errors: Record<string, string> = {};
    if (amount === null || amount <= 0) errors.amount = "Enter an amount";
    else if (hasTooManyDecimals(form.values.amount)) errors.amount = "At most 2 decimals";
    else if (amount > credit) errors.amount = `At most the credit, ${money(credit)}`;
    if (needsRef && !form.values.reference.trim()) errors.reference = "Enter the cheque number or transaction reference";
    if (!form.values.reason.trim()) errors.reason = "Write a reason";
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    payBack.mutate(
      { studentId, amount: amount!, method, reason: form.values.reason.trim(), reference: needsRef ? form.values.reference.trim() : undefined },
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
      title={`Pay back ${studentName ? `${studentName}'s` : "the"} credit`}
      footerStatus={form.formError}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={payBack.isPending} onClick={submit}>
            Pay back
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
        <MoneyInput
          label="Amount"
          required
          value={form.values.amount}
          error={form.errors.amount}
          hint={`Credit available: ${money(credit)} (less any already waiting for approval)`}
          onChange={e => form.set("amount", e.target.value)}
        />
        <Field label="Paid back by" required>
          <div className="segmented" role="group" aria-label="Method">
            {METHODS.map(m => (
              <button key={m} type="button" aria-pressed={m === method} onClick={() => form.set("method", m)}>
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>
        <TextInput
          label="Reference"
          required={needsRef}
          disabled={!needsRef}
          value={needsRef ? form.values.reference : ""}
          error={form.errors.reference}
          hint={needsRef ? "Cheque number, UPI or bank reference" : "Not needed for cash"}
          maxLength={100}
          onChange={e => form.set("reference", e.target.value)}
        />
        <Textarea label="Reason" required rows={2} maxLength={500} {...form.text("reason")} />
        <Alert tone="info">{outcome(amount, money)}</Alert>
      </form>
    </Dialog>
  );
}
