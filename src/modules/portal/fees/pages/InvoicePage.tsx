import { useState } from "react";
import { useParams } from "react-router-dom";
import { CreditCard, Download } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Button, Card, DataTable, DescriptionList, EmptyState, ErrorState, Page, SkeletonBlock, useToast } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { studentFullName, useMyStudents } from "../../shared/api/students";
import { NotLinked, PortalError } from "../../shared/components/PortalError";
import "../../shared/portal.css";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  METHOD_LABELS,
  downloadReceipt,
  feesPath,
  invoicePath,
  isPayable,
  type InvoiceDetail
} from "../api/fees";
import { PayDialog, useOnlinePaymentsUnavailable } from "../components/PayDialog";

/* PO-06 · Invoice: its lines, concessions, late fee (and waiver) and the payments made on it */
export default function InvoicePage() {
  const { studentId = "", invoiceId = "" } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const currency = useSchoolCurrency();
  const students = useMyStudents();
  const student = students.data?.find(s => s.id === studentId);
  const inv = useApiGet<InvoiceDetail>(student ? invoicePath(studentId, invoiceId) : null);
  const i = inv.data;
  const unavailable = useOnlinePaymentsUnavailable();
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const money = (n: number | null | undefined) => formatMoney(n ?? 0, currency);

  const header = (
    <DrillHeader
      back={feesPath(studentId)}
      backLabel="Back to fees"
      title={<span style={{ display: "inline-block", width: "min(240px, 40vw)", verticalAlign: "bottom" }}>{i ? `Invoice ${i.invoiceNumber}` : "Invoice"}</span>}
    />
  );

  if (students.error || (students.data && !student) || inv.error)
    return (
      <Page>
        {header}
        {students.error ? <ErrorState error={students.error} onRetry={() => void students.refetch()} /> : !student ? <NotLinked /> : <PortalError error={inv.error} />}
      </Page>
    );

  const receipt = async (paymentId: string) => {
    setBusy(paymentId);
    try {
      await downloadReceipt(paymentId);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      {header}
      {!i || !student ? (
        <Card>
          <SkeletonBlock lines={8} />
        </Card>
      ) : (
        <>
          <Card
            title={
              <span className="row">
                {money(i.total)}
                <Badge tone={INVOICE_STATUS_TONES[i.status]} dot>
                  {INVOICE_STATUS_LABELS[i.status]}
                </Badge>
                {i.isOverdue && <Badge tone="danger">Overdue</Badge>}
              </span>
            }
            subtitle={[studentFullName(student), i.structure?.name, i.installment?.name].filter(Boolean).join(" · ")}
            actions={
              can("portal.fees.pay") &&
              !unavailable &&
              isPayable(i) && (
                <Button variant="primary" icon={<CreditCard />} onClick={() => setPaying(true)}>
                  Pay {money(i.balance)}
                </Button>
              )
            }
          >
            <DescriptionList
              columns={3}
              items={[
                { label: "Issued", value: formatDate(i.issueDate) },
                { label: "Due", value: <span className={i.isOverdue ? "po-danger" : undefined}>{formatDate(i.dueDate)}</span> },
                { label: "Balance", value: <strong>{money(i.balance)}</strong> },
                { label: "Fees", value: money(i.subtotal) },
                { label: "Concessions", value: i.discount ? `− ${money(i.discount)}` : money(0) },
                {
                  label: "Late fee",
                  value: i.lateFeeWaiver ? (
                    <span>
                      {money(i.lateFee)} <span className="small muted">({money(i.lateFeeWaiver.amount)} waived: {i.lateFeeWaiver.reason})</span>
                    </span>
                  ) : (
                    money(i.lateFee)
                  )
                },
                { label: "Paid", value: money(i.amountPaid) },
                { label: "Notes", value: i.notes, hidden: !i.notes, wide: true },
                { label: "Cancelled because", value: i.cancelReason, hidden: i.status !== "CANCELLED", wide: true }
              ]}
            />
          </Card>

          <Card title="What it covers" flush>
            <DataTable
              rows={i.lines}
              rowKey={l => l.id}
              columns={[
                { key: "description", header: "Fee", render: l => l.description },
                { key: "amount", header: "Amount", align: "right", render: l => <span className="po-num">{money(l.amount)}</span> },
                { key: "discount", header: "Concession", align: "right", render: l => <span className="po-num">{l.discount ? `− ${money(l.discount)}` : "—"}</span> },
                { key: "netAmount", header: "Net", align: "right", render: l => <strong className="po-num">{money(l.netAmount)}</strong> }
              ]}
            />
            {!!i.concessions?.length && (
              <div className="card-body small muted">Concessions applied: {i.concessions.map(c => `${c.name} (${money(c.amount)})`).join(", ")}</div>
            )}
          </Card>

          <Card title="Payments on this invoice" flush>
            <DataTable
              rows={i.payments.filter(p => p.status === "SUCCEEDED")}
              rowKey={p => p.id}
              empty={<EmptyState title="No payments yet" />}
              columns={[
                { key: "paidAt", header: "Date", render: p => <span className="nowrap">{formatDate(p.paidAt)}</span> },
                { key: "receiptNumber", header: "Receipt", render: p => <span className="mono">{p.receiptNumber ?? "—"}</span> },
                { key: "method", header: "Method", render: p => METHOD_LABELS[p.method] ?? p.method },
                { key: "amount", header: "Amount", align: "right", render: p => <span className="po-num">{money(p.amount)}</span> },
                {
                  key: "receipt",
                  header: "",
                  align: "right",
                  width: 120,
                  render: p => (
                    <Button size="sm" icon={<Download />} loading={busy === p.id} onClick={() => void receipt(p.id)}>
                      Receipt
                    </Button>
                  )
                }
              ]}
            />
            {i.creditApplications.length > 0 && (
              <div className="card-body small muted">Paid from credit: {i.creditApplications.map(c => `${money(Math.abs(c.amount))} on ${formatDate(c.createdAt)}`).join(", ")}</div>
            )}
          </Card>
        </>
      )}
      <PayDialog open={paying} onClose={() => setPaying(false)} studentId={studentId} invoice={paying ? (i ?? null) : null} currency={currency} />
    </Page>
  );
}
