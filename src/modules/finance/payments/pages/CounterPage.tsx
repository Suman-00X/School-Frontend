/* FI-08 · Collect payment at the counter: pick a student, see what is due, take a payment, print the receipt */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, HandCoins, PiggyBank, Printer, UserRoundSearch } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useApiMutation, useForm } from "@/common/hooks";
import { Button, Card, EmptyState, ErrorState, Field, Page, Skeleton, TextInput, Textarea, useToast } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { StudentSelect, studentName, useStudentOptions } from "@/modules/users";
import { MoneyInput, hasTooManyDecimals, parseAmount, useMoney } from "../../shared";
import { PageIntro } from "../../shared/components/PageIntro";
import { InvoiceStatus } from "../../shared/components/FinanceStatus";
import { METHOD_LABELS, OFFLINE_METHODS, needsReference, type OfflineMethod } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { isOpen, useStatement, type Invoice } from "../../invoices/api/invoices";
import { ApplyCreditDialog } from "../../credits/components/ApplyCreditDialog";
import { downloadReceipt, recordPayment, type Payment } from "../api/payments";
import "../../shared/operations.css";

const REFERENCE_HINTS: Record<OfflineMethod, string> = {
  CASH: "Not needed for cash",
  CHEQUE: "Cheque number",
  UPI: "UPI transaction id",
  CARD: "Card slip or POS reference",
  BANK_TRANSFER: "UTR or bank reference"
};

export default function CounterPage() {
  const [search, setSearch] = useSearchParams();
  const studentId = search.get("studentId") ?? "";
  const invoiceId = search.get("invoiceId") ?? "";
  const { selected: year } = useAcademicYear();
  const statement = useStatement(studentId || null, year?.id);
  const { byId } = useStudentOptions();
  const student = byId.get(studentId);
  const [done, setDone] = useState<{ payment: Payment; message: string } | null>(null);

  const setParams = (next: { studentId?: string; invoiceId?: string }) =>
    setSearch(
      prev => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        return p;
      },
      { replace: true }
    );

  /* Oldest due first */
  const open = useMemo(
    () =>
      (statement.data?.studentId === studentId ? statement.data.invoices : [])
        .filter(isOpen)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoiceNumber.localeCompare(b.invoiceNumber)),
    [statement.data, studentId]
  );
  const picked = open.find(i => i.id === invoiceId) ?? null;

  /* Arriving with only a student: pick the oldest open invoice */
  useEffect(() => {
    if (!done && studentId && !invoiceId && open.length && statement.data?.studentId === studentId) setParams({ invoiceId: open[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, invoiceId, open, done]);

  const pickStudent = (id: string) => {
    setDone(null);
    setParams({ studentId: id, invoiceId: "" });
  };

  return (
    <Page>
      <PageIntro>Take a payment against a student's invoice and print the receipt. Fees of {year?.yearName ?? "the selected year"}.</PageIntro>
      <StudentPanel studentId={studentId} name={student ? studentName(student) : ""} admissionNumber={student?.admissionNumber} statement={statement} onPick={pickStudent} />
      {studentId && (
        <div className="split">
          <OpenInvoices
            loading={statement.isLoading || statement.data?.studentId !== studentId}
            error={statement.error}
            onRetry={() => void statement.refetch()}
            invoices={open}
            picked={picked?.id ?? ""}
            onPick={id => {
              setDone(null);
              setParams({ invoiceId: id });
            }}
          />
          {done ? (
            <CollectedCard
              payment={done.payment}
              message={done.message}
              moreOpen={!!done.payment.balanceAfter || open.some(i => i.id !== done.payment.invoiceId)}
              onAnother={() => {
                setDone(null);
                const next = open.find(i => i.balance > 0);
                setParams({ invoiceId: next?.id ?? "" });
              }}
              onNext={() => {
                setDone(null);
                setParams({ studentId: "", invoiceId: "" });
              }}
            />
          ) : (
            <CollectCard key={picked?.id ?? "none"} invoice={picked} onDone={(payment, message) => setDone({ payment, message })} />
          )}
        </div>
      )}
    </Page>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{children}</span>
    </div>
  );
}

function StudentPanel({
  studentId,
  name,
  admissionNumber,
  statement,
  onPick
}: {
  studentId: string;
  name: string;
  admissionNumber?: string;
  statement: ReturnType<typeof useStatement>;
  onPick: (id: string) => void;
}) {
  const { can } = useAuth();
  const money = useMoney();
  const [applying, setApplying] = useState(false);
  const s = statement.data?.studentId === studentId ? statement.data : undefined;
  const credit = s?.credit.balance ?? 0;
  const openInvoices = (s?.invoices ?? []).filter(isOpen);

  return (
    <Card>
      <div className="record-head" style={{ alignItems: "flex-end" }}>
        <div style={{ width: "min(360px, 100%)" }}>
          <StudentSelect label="Student" value={studentId} onChange={e => onPick(e.target.value)} error={undefined} />
        </div>
        {studentId && (
          <div className="record-head-facts" style={{ paddingBottom: 18 }}>
            {s ? (
              <>
                <Fact label="Account">
                  <Link to={OPS_PATHS.student(studentId)}>{name || "Open"}</Link>
                </Fact>
                <Fact label="Admission no.">{admissionNumber ?? "—"}</Fact>
                <Fact label="Plan">{s.installmentPlan?.name ?? "Structure default"}</Fact>
                <Fact label="Billed">{money(s.totals.billed)}</Fact>
                <Fact label="Paid">{money(s.totals.paid)}</Fact>
                <Fact label="Balance">{money(s.totals.balance)}</Fact>
                <Fact label="Overdue">
                  <span className={s.totals.overdue > 0 ? "negative" : undefined}>{money(s.totals.overdue)}</span>
                </Fact>
                <Fact label="Credit">{money(credit)}</Fact>
                {credit > 0 && can("finance.credits.apply") && openInvoices.length > 0 && (
                  <Button size="sm" icon={<PiggyBank />} onClick={() => setApplying(true)}>
                    Apply credit
                  </Button>
                )}
              </>
            ) : (
              <Skeleton width={420} height={34} />
            )}
          </div>
        )}
      </div>
      {!studentId && (
        <EmptyState icon={<UserRoundSearch />} title="Find the student" message="Search by name or admission number. Their open invoices appear here." />
      )}
      <ApplyCreditDialog
        open={applying}
        onClose={() => setApplying(false)}
        credit={credit}
        invoices={openInvoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, balance: i.balance, dueDate: i.dueDate }))}
      />
    </Card>
  );
}

function OpenInvoices({
  loading,
  error,
  onRetry,
  invoices,
  picked,
  onPick
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  invoices: Invoice[];
  picked: string;
  onPick: (id: string) => void;
}) {
  const money = useMoney();
  return (
    <Card flush title="Open invoices" subtitle="Oldest due first. Pick the one being paid.">
      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <div className="table-shell">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Installment</th>
                  <th>Due</th>
                  <th className="align-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 3 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }, (_, j) => (
                          <td key={j}>
                            <Skeleton width="70%" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : invoices.map(i => (
                      <tr
                        key={i.id}
                        className={`pick-row clickable${i.id === picked ? " is-picked" : ""}`}
                        onClick={() => onPick(i.id)}
                        tabIndex={0}
                        onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(i.id))}
                        aria-selected={i.id === picked}
                      >
                        <td className="mono nowrap">{i.invoiceNumber}</td>
                        <td>{i.installment?.name ?? "—"}</td>
                        <td className="nowrap">{formatDate(i.dueDate)}</td>
                        <td className="align-right amount">
                          {money(i.balance)}
                          {i.lateFee > 0 && <div className="small muted">incl. late fee {money(i.lateFee)}</div>}
                        </td>
                        <td>
                          <InvoiceStatus status={i.status} overdue={i.isOverdue} />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && invoices.length === 0 && (
            <div className="table-empty">
              <EmptyState icon={<CheckCircle2 />} title="Nothing due" message="This student has no open invoices this year." />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CollectCard({ invoice, onDone }: { invoice: Invoice | null; onDone: (p: Payment, message: string) => void }) {
  const money = useMoney();
  const form = useForm({ amount: invoice ? String(invoice.balance) : "", method: "CASH" as OfflineMethod, reference: "", paidAt: todayIso(), notes: "" });
  const record = useApiMutation(recordPayment, { invalidate: ["/finance/"] });
  const method = form.values.method;

  const submit = () => {
    if (!invoice) return;
    const amount = parseAmount(form.values.amount);
    const errors: Record<string, string> = {};
    if (amount === null || amount <= 0) errors.amount = "Enter the amount received";
    else if (hasTooManyDecimals(form.values.amount)) errors.amount = "At most 2 decimals";
    else if (amount > invoice.balance) errors.amount = `At most the balance, ${money(invoice.balance)}`;
    if (needsReference(method) && !form.values.reference.trim()) errors.reference = `Enter the ${REFERENCE_HINTS[method].toLowerCase()}`;
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      return;
    }
    record.mutate(
      {
        invoiceId: invoice.id,
        amount: amount!,
        method,
        reference: method === "CASH" ? undefined : form.values.reference.trim(),
        paidAt: form.values.paidAt || undefined,
        notes: form.values.notes.trim() || undefined
      },
      { onSuccess: res => onDone(res.data, res.message), onError: err => form.setServerErrors(err) }
    );
  };

  const disabled = !invoice;
  return (
    <Card
      title={invoice ? `Collect for ${invoice.invoiceNumber}` : "Collect"}
      subtitle={invoice ? `Balance ${money(invoice.balance)} · due ${formatDate(invoice.dueDate)}` : "Pick an open invoice first."}
    >
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <MoneyInput
          label="Amount received"
          required
          disabled={disabled}
          value={form.values.amount}
          error={form.errors.amount}
          hint="Less than the balance for a part payment"
          onChange={e => form.set("amount", e.target.value)}
        />
        <Field label="Method" required>
          <div className="segmented" role="group" aria-label="Payment method">
            {OFFLINE_METHODS.map(m => (
              <button key={m} type="button" aria-pressed={m === method} disabled={disabled} onClick={() => form.set("method", m)}>
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>
        <TextInput
          label="Reference"
          required={needsReference(method)}
          disabled={disabled || method === "CASH"}
          value={method === "CASH" ? "" : form.values.reference}
          error={form.errors.reference}
          hint={REFERENCE_HINTS[method]}
          maxLength={100}
          onChange={e => form.set("reference", e.target.value)}
        />
        <TextInput type="date" label="Paid on" disabled={disabled} max={todayIso()} {...form.text("paidAt")} />
        <Textarea label="Notes" disabled={disabled} rows={2} maxLength={500} {...form.text("notes")} />
        <div className="row-between" style={{ flexWrap: "nowrap", gap: 12 }}>
          <div className="footer-status" role={form.formError ? "alert" : undefined} title={form.formError ?? undefined}>
            {form.formError}
          </div>
          <Button type="submit" variant="primary" icon={<HandCoins />} disabled={disabled} loading={record.isPending}>
            Record payment
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CollectedCard({
  payment,
  message,
  moreOpen,
  onAnother,
  onNext
}: {
  payment: Payment;
  message: string;
  moreOpen: boolean;
  onAnother: () => void;
  onNext: () => void;
}) {
  const money = useMoney();
  const toast = useToast();
  const { can } = useAuth();
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    try {
      await downloadReceipt(payment);
    } catch (e) {
      toast.error(e);
    } finally {
      setPrinting(false);
    }
  };
  return (
    <Card>
      <EmptyState
        icon={<CheckCircle2 />}
        title={message || `Payment received. Receipt ${payment.receiptNumber}`}
        message={
          <>
            {money(payment.amount)} by {METHOD_LABELS[payment.method] ?? payment.method}.{" "}
            {payment.balanceAfter ? `Still due on this invoice: ${money(payment.balanceAfter)}.` : "This invoice is now paid."}
            {payment.excessAmount > 0 && ` ${money(payment.excessAmount)} kept as credit.`}
          </>
        }
        actions={
          <>
            {can("finance.payments.read") && (
              <Button variant="primary" icon={<Printer />} loading={printing} onClick={() => void print()}>
                Print receipt
              </Button>
            )}
            {moreOpen && <Button onClick={onAnother}>Collect another invoice</Button>}
            <Button onClick={onNext}>Next student</Button>
          </>
        }
      />
    </Card>
  );
}
