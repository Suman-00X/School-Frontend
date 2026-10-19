/* FI-07 · Invoice detail: lines with concessions, totals, late fee and waiver, payments, credit applied */
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, Download, HandCoins, PiggyBank, RotateCcw, ShieldOff } from "lucide-react";
import { useAuth } from "@/common/auth";
import { ActivityLog } from "@/common/components/activity-log";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Button, ButtonLink, Card, DataTable, DescriptionList, EmptyState, ErrorState, Page, SkeletonBlock, useConfirm, useTabParam, useToast, type TabItem } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { UserName, useMoney } from "../../shared";
import { Amount, InvoiceStatus, PaymentStatus } from "../../shared/components/FinanceStatus";
import { ReasonDialog } from "../../shared/components/ReasonDialog";
import { methodLabel, studentLabel } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { useStudentCredit } from "../../credits/api/credits";
import { ApplyCreditDialog } from "../../credits/components/ApplyCreditDialog";
import { downloadReceipt } from "../../payments/api/payments";
import { cancelInvoice, isOpen, reinstateLateFee, useInvoice, useInvoiceMutation, waiveLateFee, type InvoiceDetail, type InvoicePayment } from "../api/invoices";
import "../../shared/operations.css";

export default function InvoiceDetailPage() {
  const { invoiceId = "" } = useParams();
  const { can } = useAuth();
  const invoice = useInvoice(invoiceId);
  const tabs: TabItem[] = [
    { id: "invoice", label: "Invoice" },
    { id: "history", label: "History", hidden: !can("finance.activity.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const inv = invoice.data;

  const header = (
    <DrillHeader
      back={OPS_PATHS.invoices}
      backLabel="Back to invoices"
      title={<span className="mono">{inv?.invoiceNumber ?? "Invoice"}</span>}
      tabs={tabs.some(t => t.hidden) ? undefined : tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (invoice.error)
    return (
      <Page>
        {header}
        <ErrorState error={invoice.error} onRetry={() => void invoice.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      <InvoiceHead invoice={inv} />
      {tab === "history" ? (
        <ActivityLog basePath="/finance/activity" module="finance" fixed={{ entityId: invoiceId }} compact />
      ) : !inv ? (
        <Card>
          <SkeletonBlock lines={8} />
        </Card>
      ) : (
        <InvoiceBody invoice={inv} />
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

function InvoiceHead({ invoice: inv }: { invoice: InvoiceDetail | undefined }) {
  const { can } = useAuth();
  const toast = useToast();
  const money = useMoney();
  const [cancelling, setCancelling] = useState(false);
  const [applying, setApplying] = useState(false);
  const credit = useStudentCredit(inv?.studentId ?? null, can("finance.credits.read") && !!inv && isOpen(inv));
  const cancel = useInvoiceMutation(cancelInvoice);

  const open = !!inv && isOpen(inv);
  const creditBalance = credit.data?.balance ?? 0;
  const canCollect = can("finance.payments.collect") && open;
  const canApply = can("finance.credits.apply") && open && creditBalance > 0;
  const canCancel = can("finance.invoices.cancel") && !!inv && inv.status !== "CANCELLED" && inv.amountPaid === 0;

  return (
    <Card>
      <div className="record-head">
        <div className="record-head-facts">
          {inv ? (
            <>
              <InvoiceStatus status={inv.status} overdue={inv.isOverdue} />
              <Fact label="Student">
                {inv.student ? <Link to={OPS_PATHS.student(inv.studentId)}>{studentLabel(inv.student)}</Link> : "—"}
              </Fact>
              <Fact label="Due">{formatDate(inv.dueDate)}</Fact>
              <Fact label="Total">{money(inv.total)}</Fact>
              <Fact label="Balance">{inv.status === "CANCELLED" ? "—" : money(inv.balance)}</Fact>
            </>
          ) : (
            <SkeletonBlock lines={2} />
          )}
        </div>
        <div className="row">
          {canCancel && (
            <Button variant="danger" icon={<Ban />} onClick={() => setCancelling(true)}>
              Cancel invoice
            </Button>
          )}
          {canApply && (
            <Button icon={<PiggyBank />} onClick={() => setApplying(true)}>
              Apply credit
            </Button>
          )}
          {canCollect && inv && (
            <ButtonLink variant="primary" icon={<HandCoins />} to={OPS_PATHS.collect(inv.studentId, inv.id)}>
              Collect payment
            </ButtonLink>
          )}
        </div>
      </div>
      {inv && (
        <>
          <ReasonDialog
            open={cancelling}
            onClose={() => setCancelling(false)}
            title={`Cancel ${inv.invoiceNumber}?`}
            message={`${studentLabel(inv.student)} will no longer owe ${money(inv.total)} on this invoice. A cancelled invoice can't be reopened; generate invoices again to re-issue it.`}
            label="Why is it cancelled?"
            confirmLabel="Cancel invoice"
            onSubmit={async ({ reason }) => {
              const res = await cancel.mutateAsync({ invoiceId: inv.id, reason });
              toast.success(res.message);
            }}
          />
          <ApplyCreditDialog
            open={applying}
            onClose={() => setApplying(false)}
            credit={creditBalance}
            invoices={[{ id: inv.id, invoiceNumber: inv.invoiceNumber, balance: inv.balance, dueDate: inv.dueDate }]}
            invoiceId={inv.id}
          />
        </>
      )}
    </Card>
  );
}

function InvoiceBody({ invoice: inv }: { invoice: InvoiceDetail }) {
  const money = useMoney();
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const canReceipt = can("finance.payments.read");

  const receipt = async (p: InvoicePayment) => {
    try {
      await downloadReceipt(p);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className="split">
      <div className="stack">
        <Card flush title="Fees">
          <DataTable
            rows={inv.lines}
            rowKey={l => l.id}
            columns={[
              {
                key: "description",
                header: "Fee",
                render: l => (
                  <div>
                    <div>{l.description}</div>
                    {l.concessions.length > 0 && <div className="small muted">{l.concessions.map(c => `${c.name} −${money(c.amount)}`).join(" · ")}</div>}
                  </div>
                )
              },
              { key: "amount", header: "Gross", align: "right", render: l => <Amount value={l.amount} format={money} /> },
              { key: "discount", header: "Concession", align: "right", render: l => <Amount value={l.discount ? -l.discount : 0} format={money} dashZero /> },
              { key: "netAmount", header: "Net", align: "right", render: l => <Amount value={l.netAmount} format={money} /> }
            ]}
            empty={<EmptyState title="No lines on this invoice." />}
          />
          <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="totals" style={{ maxWidth: 360, marginLeft: "auto" }}>
              <span>Gross</span>
              <span>{money(inv.subtotal)}</span>
              <span>Concessions</span>
              <span>{inv.discount ? money(-inv.discount) : "—"}</span>
              <span>Late fee</span>
              <span>{inv.lateFee ? money(inv.lateFee) : "—"}</span>
              <span className="total-strong">Total</span>
              <span className="total-strong">{money(inv.total)}</span>
              <span>Paid</span>
              <span>{money(inv.amountPaid)}</span>
              <span className="total-strong">Balance</span>
              <span className="total-strong">{inv.status === "CANCELLED" ? "—" : money(inv.balance)}</span>
            </div>
          </div>
        </Card>
        <Card title="Details">
          <DescriptionList
            items={[
              { label: "Fee structure", value: inv.structure?.name },
              { label: "Installment", value: inv.installment ? `${inv.installment.name}${inv.plan ? ` (${inv.plan.name})` : ""}` : null },
              { label: "Issued on", value: formatDate(inv.issueDate) },
              { label: "Due on", value: formatDate(inv.dueDate) },
              { label: "Admission no.", value: inv.student?.admissionNumber },
              { label: "Concessions", value: inv.concessions.length ? inv.concessions.map(c => `${c.name} (${money(c.amount)})`).join(", ") : null },
              { label: "Notes", value: inv.notes, wide: true },
              { label: "Cancelled on", value: formatDateTime(inv.cancelledAt), hidden: !inv.cancelledAt },
              { label: "Why cancelled", value: inv.cancelReason, hidden: !inv.cancelledAt, wide: true }
            ]}
          />
        </Card>
      </div>
      <div className="stack">
        <LateFeePanel invoice={inv} />
        <Card flush title="Payments">
          <DataTable
            rows={inv.payments}
            rowKey={p => p.id}
            onRowClick={canReceipt ? p => navigate(OPS_PATHS.payment(p.id)) : undefined}
            columns={[
              {
                key: "receiptNumber",
                header: "Receipt",
                render: p => (
                  <div>
                    <div className="mono nowrap">{p.receiptNumber ?? "—"}</div>
                    <div className="small muted nowrap">
                      {formatDate(p.paidAt ?? p.createdAt)} · {methodLabel(p.method)}
                    </div>
                  </div>
                )
              },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                render: p => (
                  <div>
                    <Amount value={p.amount} format={money} />
                    {p.status !== "SUCCEEDED" && (
                      <div>
                        <PaymentStatus status={p.status} />
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: "pdf",
                header: "",
                align: "right",
                width: 44,
                render: p =>
                  canReceipt && p.status === "SUCCEEDED" ? (
                    <span onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" icon={<Download />} aria-label={`Receipt ${p.receiptNumber}`} title="Receipt PDF" onClick={() => void receipt(p)} />
                    </span>
                  ) : null
              }
            ]}
            empty={<EmptyState title="No payments yet." />}
          />
        </Card>
        {inv.creditApplications.length > 0 && (
          <Card flush title="Credit applied">
            <DataTable
              rows={inv.creditApplications}
              rowKey={c => c.id}
              columns={[
                { key: "createdAt", header: "Date", render: c => formatDate(c.createdAt) },
                { key: "amount", header: "Amount", align: "right", render: c => <Amount value={Math.abs(c.amount)} format={money} /> }
              ]}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function LateFeePanel({ invoice: inv }: { invoice: InvoiceDetail }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const [waiving, setWaiving] = useState(false);
  const waive = useInvoiceMutation(waiveLateFee);
  const reinstate = useInvoiceMutation(reinstateLateFee);
  const canWaive = can("finance.invoices.waiveLateFee") && isOpen(inv);
  const w = inv.lateFeeWaiver;

  const askReinstate = async () => {
    const ok = await confirm({
      title: `Reinstate the late fee on ${inv.invoiceNumber}?`,
      message: "The late fee is charged again from today, by the structure's late-fee rule.",
      confirmLabel: "Reinstate",
      tone: "primary"
    });
    if (ok) reinstate.mutate(inv.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  return (
    <Card
      title="Late fee"
      actions={
        canWaive &&
        (w ? (
          <Button size="sm" icon={<RotateCcw />} loading={reinstate.isPending} onClick={() => void askReinstate()}>
            Reinstate
          </Button>
        ) : inv.lateFee > 0 ? (
          <Button size="sm" icon={<ShieldOff />} onClick={() => setWaiving(true)}>
            Waive
          </Button>
        ) : null)
      }
    >
      {w ? (
        <DescriptionList
          columns={1}
          items={[
            { label: "Waived", value: money(w.amount) },
            { label: "Reason", value: w.reason },
            { label: "Waived on", value: formatDateTime(w.waivedAt) },
            { label: "By", value: <UserName id={w.waivedBy} /> }
          ]}
        />
      ) : inv.lateFee > 0 ? (
        <p>
          <strong className="amount">{money(inv.lateFee)}</strong> <span className="muted">charged so far for paying late.</span>
        </p>
      ) : (
        <p className="muted">{inv.isOverdue ? "No late fee charged yet." : "No late fee."}</p>
      )}
      <ReasonDialog
        open={waiving}
        onClose={() => setWaiving(false)}
        title={`Waive the late fee on ${inv.invoiceNumber}?`}
        message={`${money(inv.lateFee)} comes off the invoice, and no late fee will be charged on it again unless you reinstate it.`}
        label="Why is it waived?"
        confirmLabel="Waive late fee"
        tone="primary"
        onSubmit={async ({ reason }) => {
          const res = await waive.mutateAsync({ invoiceId: inv.id, reason });
          toast.success(res.message);
        }}
      />
    </Card>
  );
}
