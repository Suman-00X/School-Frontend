import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Download, ReceiptText } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Kpi, Page, PageHeader, Skeleton, useToast } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { usePortalStudent } from "../../shared/components/PortalLayout";
import { PortalError } from "../../shared/components/PortalError";
import { studentFullName } from "../../shared/api/students";
import {
  CREDIT_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  METHOD_LABELS,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_TONES,
  downloadReceipt,
  downloadRefundReceipt,
  feesPath,
  invoicePagePath,
  isPayable,
  type Invoice,
  type Statement
} from "../api/fees";
import { PayDialog, useOnlinePaymentsUnavailable } from "../components/PayDialog";

/* PO-06 · Fees: this year's statement (totals, invoices, payments, refunds, credit) with
   online payment per invoice. Receipts are PDFs fetched with the token. */
export default function FeesPage() {
  const { student } = usePortalStudent();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = useSchoolCurrency();
  const statement = useApiGet<Statement>(feesPath(student.id));
  const s = statement.data;
  const unavailable = useOnlinePaymentsUnavailable();
  const canPay = can("portal.fees.pay") && !unavailable;
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const money = (n: number | null | undefined) => formatMoney(n ?? 0, currency);

  const fetchFile = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const figure = (n: number | undefined, cls?: string) => (s ? <span className={cls}>{money(n)}</span> : <Skeleton width={90} height={24} />);
  const nothingBilled = s && s.invoices.length === 0;

  return (
    <Page>
      <PageHeader title="Fees" subtitle={s?.installmentPlan ? `${studentFullName(student)} · ${s.installmentPlan.name} plan` : studentFullName(student)} />
      {statement.error ? (
        <PortalError error={statement.error} onRetry={() => void statement.refetch()} />
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Balance due" value={figure(s?.totals.balance)} hint={s ? `of ${money(s.totals.billed)} billed this year` : " "} />
            <Kpi label="Overdue" value={figure(s?.totals.overdue, s && s.totals.overdue > 0 ? "po-danger" : undefined)} hint={s && s.totals.overdue > 0 ? "Past the due date" : "Nothing overdue"} />
            <Kpi label="Paid this year" value={figure(s?.totals.paid)} hint={s && s.totals.refunded > 0 ? `${money(s.totals.refunded)} refunded` : " "} />
            {s && s.credit.balance > 0 && <Kpi label="Credit held" value={money(s.credit.balance)} hint="Used on the next invoice" />}
          </div>

          <Card title="Invoices" flush>
            <DataTable
              rows={s?.invoices}
              rowKey={i => i.id}
              loading={!s}
              onRowClick={i => navigate(invoicePagePath(student.id, i.id))}
              empty={<EmptyState icon={<ReceiptText />} title="No fees billed yet this year" />}
              columns={[
                { key: "invoiceNumber", header: "Invoice", render: i => <span className="mono">{i.invoiceNumber}</span> },
                {
                  key: "for",
                  header: "For",
                  render: i => <span className="muted">{[i.installment?.name, i.structure?.name].filter(Boolean).join(" · ") || "—"}</span>
                },
                { key: "dueDate", header: "Due", render: i => <span className={`nowrap${i.isOverdue ? " po-danger" : ""}`}>{formatDate(i.dueDate)}</span> },
                { key: "total", header: "Total", align: "right", render: i => <span className="po-num">{money(i.total)}</span> },
                { key: "paid", header: "Paid", align: "right", render: i => <span className="po-num">{money(i.amountPaid)}</span> },
                { key: "balance", header: "Balance", align: "right", render: i => <strong className="po-num">{money(i.balance)}</strong> },
                {
                  key: "status",
                  header: "Status",
                  render: i => (
                    <span className="row" style={{ flexWrap: "nowrap" }}>
                      <Badge tone={INVOICE_STATUS_TONES[i.status]} dot>
                        {INVOICE_STATUS_LABELS[i.status]}
                      </Badge>
                      {i.isOverdue && <Badge tone="danger">Overdue</Badge>}
                    </span>
                  )
                },
                {
                  key: "pay",
                  header: "",
                  align: "right",
                  width: 90,
                  render: i =>
                    canPay && isPayable(i) ? (
                      <span onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="primary" icon={<CreditCard />} onClick={() => setPaying(i)}>
                          Pay
                        </Button>
                      </span>
                    ) : null
                }
              ]}
            />
          </Card>

          {!nothingBilled && (
            <Card title="Payments" flush>
              <DataTable
                rows={s?.payments}
                rowKey={p => p.id}
                loading={!s}
                empty={<EmptyState title="No payments yet" />}
                columns={[
                  { key: "paidAt", header: "Date", render: p => <span className="nowrap">{formatDate(p.paidAt)}</span> },
                  { key: "receiptNumber", header: "Receipt", render: p => <span className="mono">{p.receiptNumber ?? "—"}</span> },
                  { key: "method", header: "Method", render: p => METHOD_LABELS[p.method] ?? p.method },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    render: p => (
                      <span className="po-num">
                        {money(p.amount)}
                        {p.refundedAmount > 0 && <span className="small muted"> ({money(p.refundedAmount)} refunded)</span>}
                      </span>
                    )
                  },
                  {
                    key: "receipt",
                    header: "",
                    align: "right",
                    width: 120,
                    render: p => (
                      <Button size="sm" icon={<Download />} loading={busy === p.id} onClick={() => void fetchFile(p.id, () => downloadReceipt(p.id))}>
                        Receipt
                      </Button>
                    )
                  }
                ]}
              />
            </Card>
          )}

          {s && s.refunds.length > 0 && (
            <Card title="Refunds" flush>
              <DataTable
                rows={s.refunds}
                rowKey={r => r.id}
                columns={[
                  { key: "refundNumber", header: "Refund", render: r => <span className="mono">{r.refundNumber ?? "—"}</span> },
                  { key: "amount", header: "Amount", align: "right", render: r => <span className="po-num">{money(r.amount)}</span> },
                  {
                    key: "status",
                    header: "Status",
                    render: r => (
                      <Badge tone={REFUND_STATUS_TONES[r.status] ?? "neutral"} dot>
                        {REFUND_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    )
                  },
                  { key: "processedAt", header: "Date", render: r => <span className="nowrap">{formatDate(r.processedAt ?? r.createdAt)}</span> },
                  {
                    key: "receipt",
                    header: "",
                    align: "right",
                    width: 150,
                    render: r =>
                      r.status === "PROCESSED" || r.status === "PENDING" ? (
                        <Button size="sm" icon={<Download />} loading={busy === r.id} onClick={() => void fetchFile(r.id, () => downloadRefundReceipt(r.id))}>
                          Refund receipt
                        </Button>
                      ) : null
                  }
                ]}
              />
            </Card>
          )}

          {s && (s.concessions.length > 0 || s.creditEntries.length > 0) && (
            <div className="grid-2" style={{ alignItems: "start" }}>
              {s.concessions.length > 0 && (
                <Card title="Concessions" flush>
                  <DataTable
                    rows={s.concessions}
                    rowKey={c => c.grantId}
                    columns={[
                      { key: "name", header: "Concession", render: c => <div><div>{c.name}</div>{c.reason && <div className="small muted">{c.reason}</div>}</div> },
                      { key: "value", header: "Rate", render: c => (c.concessionType === "PERCENT" ? `${c.value}%` : money(c.value)) },
                      { key: "amount", header: "Taken off so far", align: "right", render: c => <span className="po-num">{money(c.amount)}</span> }
                    ]}
                  />
                </Card>
              )}
              {s.creditEntries.length > 0 && (
                <Card title="Credit history" flush>
                  <DataTable
                    rows={s.creditEntries}
                    rowKey={c => c.id}
                    columns={[
                      { key: "createdAt", header: "Date", render: c => <span className="nowrap">{formatDate(c.createdAt)}</span> },
                      { key: "entryType", header: "What", render: c => `${CREDIT_LABELS[c.entryType] ?? c.entryType}${c.invoice ? ` · ${c.invoice.invoiceNumber}` : ""}` },
                      { key: "amount", header: "Amount", align: "right", render: c => <span className="po-num">{money(c.amount)}</span> }
                    ]}
                  />
                </Card>
              )}
            </div>
          )}
        </>
      )}
      <PayDialog open={!!paying} onClose={() => setPaying(null)} studentId={student.id} invoice={paying} currency={currency} />
    </Page>
  );
}
