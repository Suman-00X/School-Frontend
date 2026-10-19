import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Lock } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Button, Dialog, RadioGroup, TextInput, useToast } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { studentPath } from "../../shared/api/students";
import { MIN_ONLINE_PAYMENT, confirmPayment, downloadReceipt, startPayment, type Invoice, type Payment } from "../api/fees";
import { openCheckout } from "../api/razorpay";

const UNAVAILABLE_KEY = ["portal", "online-payments-unavailable"];

/* Once the API says the school takes no online payments, Pay buttons hide for the session */
export function useOnlinePaymentsUnavailable() {
  const q = useQuery({ queryKey: UNAVAILABLE_KEY, queryFn: () => false, initialData: false, staleTime: Infinity, gcTime: Infinity });
  return q.data;
}

const NOT_COMPLETED = "The payment was not completed. If money was deducted, it will be confirmed automatically.";

/* PO-06 · Pay online: full balance or another amount (at least 100.00, or the whole balance
   when smaller), then the gateway's checkout, then the confirmation and the receipt. */
export function PayDialog({ open, onClose, studentId, invoice, currency }: { open: boolean; onClose: () => void; studentId: string; invoice: Invoice | null; currency: string }) {
  const { me, session } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [choice, setChoice] = useState<"full" | "part">("full");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<"order" | "checkout" | "confirm" | null>(null);
  const [paid, setPaid] = useState<Payment | null>(null);
  const [downloading, setDownloading] = useState(false);

  const balance = invoice?.balance ?? 0;
  const minimum = Math.min(MIN_ONLINE_PAYMENT, balance);
  const money = (n: number) => formatMoney(n, currency);

  const close = () => {
    if (busy) return;
    setChoice("full");
    setAmount("");
    setError(null);
    setFieldError(undefined);
    setPaid(null);
    onClose();
  };

  const refresh = () => qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(studentPath(studentId)) });

  const pay = async () => {
    if (!invoice) return;
    setError(null);
    setFieldError(undefined);
    let value: number | undefined;
    if (choice === "part") {
      value = Number(amount);
      if (!amount || !Number.isFinite(value) || value <= 0) return setFieldError("Enter an amount");
      if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return setFieldError("Use at most two decimals");
      if (value > balance) return setFieldError(`At most the balance of ${money(balance)}`);
      if (value < minimum) return setFieldError(`At least ${money(minimum)}`);
    }

    setBusy("order");
    try {
      const order = (await startPayment({ studentId, invoiceId: invoice.id, amount: value })).data;
      if (order.provider !== "razorpay") {
        setError("This school's payment gateway is in test mode, so there is no checkout page to open.");
        return;
      }
      setBusy("checkout");
      const result = await openCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: session?.school.name,
        description: `Invoice ${order.invoiceNumber}`,
        prefill: { name: [me?.account.firstName, me?.account.lastName].filter(Boolean).join(" "), email: me?.account.email, contact: me?.account.phone ?? undefined }
      });
      if (!result) {
        setError(NOT_COMPLETED);
        void refresh();
        return;
      }
      setBusy("confirm");
      const res = await confirmPayment({ orderId: result.razorpay_order_id, paymentId: result.razorpay_payment_id, signature: result.razorpay_signature });
      toast.success(res.message);
      setPaid(res.data);
      void refresh();
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 422 && /not set up/i.test(e.message)) qc.setQueryData(UNAVAILABLE_KEY, true);
        if (e.isValidation && e.details.some(d => d.field === "amount")) setFieldError(e.details.find(d => d.field === "amount")!.message);
        setError(e.message);
      } else if (e instanceof Error && e.message === "checkout") setError("The payment page could not be opened. Check your connection and try again.");
      else setError(NOT_COMPLETED);
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const receipt = async () => {
    if (!paid) return;
    setDownloading(true);
    try {
      await downloadReceipt(paid.id);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={paid ? "Payment received" : `Pay ${invoice?.invoiceNumber ?? ""}`}
      footerStatus={paid ? undefined : error}
      footer={
        paid ? (
          <>
            <Button icon={<Download />} loading={downloading} onClick={() => void receipt()}>
              Download receipt
            </Button>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close} disabled={!!busy}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Lock />} loading={!!busy} onClick={() => void pay()}>
              {choice === "full" ? `Pay ${money(balance)}` : "Pay"}
            </Button>
          </>
        )
      }
    >
      {paid ? (
        <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", padding: "8px 0" }}>
          <CheckCircle2 size={36} className="po-success" />
          <div style={{ fontWeight: 600 }}>
            {money(paid.amount)} paid · receipt {paid.receiptNumber}
          </div>
          {paid.excessAmount > 0 && <div className="small muted">{money(paid.excessAmount)} more than the balance is kept as credit.</div>}
        </div>
      ) : (
        invoice && (
          <div className="stack">
            <div className="small muted">
              Balance {money(balance)} · due {formatDate(invoice.dueDate)}
            </div>
            <RadioGroup
              value={choice}
              onChange={setChoice}
              disabled={!!busy}
              options={[
                { value: "full", label: "Full balance", description: money(balance) },
                { value: "part", label: "Another amount", description: balance > minimum ? `From ${money(minimum)} to ${money(balance)}` : "Only the full balance can be paid" }
              ]}
            />
            <TextInput
              label="Amount"
              type="number"
              inputMode="decimal"
              min={minimum}
              max={balance}
              step="0.01"
              value={choice === "full" ? String(balance) : amount}
              disabled={choice === "full" || !!busy || balance <= minimum}
              onChange={e => setAmount(e.target.value)}
              error={fieldError}
              hint={busy === "checkout" ? "Complete the payment in the window that opened" : busy === "confirm" ? "Confirming the payment…" : "You pay on the gateway's secure page"}
            />
          </div>
        )
      )}
    </Dialog>
  );
}
