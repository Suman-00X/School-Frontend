/* FI-11 · Student account: a year's statement (summary, invoices, payments, refunds) and the student's credit */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarClock, HandCoins, PiggyBank, Plus, Trash2, Undo2, UserRound } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { api } from "@/common/api";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Kpi,
  Page,
  Select,
  Skeleton,
  useConfirm,
  useTabParam,
  useToast,
  type TabItem
} from "@/common/ui";
import { enumLabel, formatDate, formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared";
import { Amount, InvoiceStatus, PaymentStatus, RefundStatus } from "../../shared/components/FinanceStatus";
import { methodLabel, type StudentBrief } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { isOpen, useStatement, type Statement } from "../../invoices/api/invoices";
import { PaymentDrawer } from "../../payments/components/PaymentDrawer";
import { RefundDrawer } from "../../payments/components/RefundDrawer";
import { CREDIT_ENTRY_LABELS, useStudentCredit } from "../api/credits";
import { ApplyCreditDialog } from "../components/ApplyCreditDialog";
import { PayBackCreditDialog } from "../components/PayBackCreditDialog";
import { ChangePlanDialog, GrantConcessionDialog } from "../components/AccountSetupDialogs";
import "../../shared/operations.css";

type StudentRecord = StudentBrief & { userId: string };

export default function StudentAccountPage() {
  const { studentId = "" } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const money = useMoney();
  const { years, selected } = useAcademicYear();
  const [yearId, setYearId] = useState(selected?.id ?? "");
  const statement = useStatement(studentId, yearId || selected?.id);
  const student = useApiGet<StudentRecord>(can("users.students.read") ? `/users/students/${studentId}` : null);
  const s = statement.data?.studentId === studentId ? statement.data : undefined;
  const embedded = s?.invoices[0]?.student;
  const who = student.data ?? embedded;
  const name = who ? `${who.user.firstName} ${who.user.lastName}`.trim() : "";
  const year = years.find(y => y.id === (s?.academicYearId ?? yearId)) ?? selected;

  const tabs: TabItem[] = [
    { id: "summary", label: "Summary" },
    { id: "invoices", label: "Invoices", count: s?.invoices.length },
    { id: "payments", label: "Payments", count: s?.payments.length },
    { id: "refunds", label: "Refunds", count: s?.refunds.length },
    { id: "credit", label: "Credit", hidden: !can("finance.credits.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);

  const header = (
    <DrillHeader
      back={OPS_PATHS.invoices}
      backLabel="Back to invoices"
      title={
        <span style={{ display: "inline-block", width: "min(240px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }} title={name}>
          {name || <Skeleton width={140} height={16} />}
        </span>
      }
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (statement.error && !s)
    return (
      <Page>
        {header}
        <ErrorState error={statement.error} onRetry={() => void statement.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      <Card>
        <div className="record-head">
          <div className="record-head-facts">
            <span className="row" style={{ gap: 8 }}>
              <Badge tone="primary">{who ? <span className="mono">{who.admissionNumber}</span> : "…"}</Badge>
              {s && <span className="small muted">Plan: {s.installmentPlan?.name ?? "the structure's default"}</span>}
            </span>
            {years.length > 0 && (
              <Select
                className="select-sm"
                aria-label="Academic year"
                style={{ width: "auto", minWidth: 140 }}
                value={yearId || s?.academicYearId || ""}
                options={years.map(y => ({ value: y.id, label: y.yearName + (y.isCurrent ? " (current)" : "") }))}
                onChange={e => setYearId(e.target.value)}
              />
            )}
          </div>
          <div className="row">
            {can("users.students.read") && (
              <ButtonLink to={`/users/students/${studentId}`} icon={<UserRound />}>
                Profile
              </ButtonLink>
            )}
            {can("finance.payments.collect") && (
              <ButtonLink variant="primary" icon={<HandCoins />} to={OPS_PATHS.collect(studentId)}>
                Collect payment
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>
      <div className="kpis">
        <Kpi label="Billed" value={s ? money(s.totals.billed) : <Skeleton width={90} height={22} />} />
        <Kpi label="Paid" value={s ? money(s.totals.paid) : <Skeleton width={90} height={22} />} />
        <Kpi label="Balance" value={s ? money(s.totals.balance) : <Skeleton width={90} height={22} />} />
        <Kpi label="Overdue" value={s ? <span className={s.totals.overdue > 0 ? "negative" : undefined}>{money(s.totals.overdue)}</span> : <Skeleton width={90} height={22} />} />
        <Kpi label="Refunded" value={s ? money(s.totals.refunded) : <Skeleton width={90} height={22} />} />
        <Kpi label="Credit" value={s ? money(s.credit.balance) : <Skeleton width={90} height={22} />} />
      </div>
      {!s ? (
        <Card>
          <Skeleton height={160} />
        </Card>
      ) : (
        <>
          {tab === "summary" && <SummaryTab statement={s} studentId={studentId} name={name} yearId={s.academicYearId} yearName={year?.yearName ?? "this year"} />}
          {tab === "invoices" && (
            <Card flush>
              <DataTable
                rows={s.invoices}
                rowKey={i => i.id}
                onRowClick={i => navigate(OPS_PATHS.invoice(i.id))}
                columns={[
                  { key: "invoiceNumber", header: "Invoice", render: i => <span className="mono nowrap">{i.invoiceNumber}</span> },
                  { key: "installment", header: "Installment", render: i => i.installment?.name ?? "—" },
                  { key: "dueDate", header: "Due", render: i => <span className="nowrap">{formatDate(i.dueDate)}</span> },
                  { key: "total", header: "Total", align: "right", render: i => <Amount value={i.total} format={money} /> },
                  { key: "amountPaid", header: "Paid", align: "right", render: i => <Amount value={i.amountPaid} format={money} dashZero /> },
                  { key: "balance", header: "Balance", align: "right", render: i => <Amount value={i.status === "CANCELLED" ? null : i.balance} format={money} dashZero /> },
                  { key: "status", header: "Status", render: i => <InvoiceStatus status={i.status} overdue={i.isOverdue} /> }
                ]}
                empty={<EmptyState title={`No invoices in ${year?.yearName ?? "this year"}.`} />}
              />
            </Card>
          )}
          {tab === "payments" && <PaymentsTab statement={s} />}
          {tab === "refunds" && <RefundsTab statement={s} />}
          {tab === "credit" && <CreditTab studentId={studentId} name={name} statement={s} />}
        </>
      )}
    </Page>
  );
}

function SummaryTab({ statement: s, studentId, name, yearId, yearName }: { statement: Statement; studentId: string; name: string; yearId: string; yearName: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const [changingPlan, setChangingPlan] = useState(false);
  const [granting, setGranting] = useState(false);
  const revoke = useApiMutation((grantId: string) => api.delete(`/finance/concession-grants/${grantId}`), { invalidate: ["/finance/"] });
  const canAssign = can("finance.installmentPlans.assign");
  const canConcede = can("finance.concessions.manage");

  const askRevoke = async (c: Statement["concessions"][number]) => {
    const ok = await confirm({
      title: `Revoke ${c.name} for ${name}?`,
      message: `${yearName}'s invoices with nothing paid are recalculated without it. Paid invoices are not changed.`,
      confirmLabel: "Revoke"
    });
    if (ok) revoke.mutate(c.grantId, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  return (
    <div className="split">
      <Card
        flush
        title="Concessions"
        subtitle={`Granted for ${yearName}. The amount is what they took off the invoices so far.`}
        actions={
          canConcede && (
            <Button size="sm" icon={<Plus />} onClick={() => setGranting(true)}>
              Grant concession
            </Button>
          )
        }
      >
        <DataTable
          rows={s.concessions}
          rowKey={c => c.grantId}
          columns={[
            {
              key: "name",
              header: "Concession",
              render: c => (
                <div>
                  <div>{c.name}</div>
                  <div className="small muted">
                    {enumLabel(c.category)} · {c.concessionType === "PERCENT" ? `${c.value}%` : `${money(c.value)} a year`}
                    {c.reason ? ` · ${c.reason}` : ""}
                  </div>
                </div>
              )
            },
            { key: "amount", header: "Taken off", align: "right", render: c => <Amount value={c.amount} format={money} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 48,
              render: c =>
                canConcede ? (
                  <Button size="sm" variant="ghost" icon={<Trash2 />} title="Revoke" aria-label={`Revoke ${c.name}`} onClick={() => void askRevoke(c)} />
                ) : null
            }
          ]}
          empty={<EmptyState title="No concessions" message={`${name || "This student"} pays the full fees in ${yearName}.`} />}
        />
      </Card>
      <div className="stack">
        <Card
          title="Installment plan"
          actions={
            canAssign && (
              <Button size="sm" icon={<CalendarClock />} onClick={() => setChangingPlan(true)}>
                Change plan
              </Button>
            )
          }
        >
          <p>{s.installmentPlan ? `${s.installmentPlan.name} (${s.installmentPlan.installmentCount} installments)` : "The fee structure's default plan"}</p>
        </Card>
        <Card title="Year totals">
          <div className="totals">
            <span>Gross fees</span>
            <span>{money(s.totals.gross)}</span>
            <span>Concessions</span>
            <span>{s.totals.concessions ? money(-s.totals.concessions) : "—"}</span>
            <span>Late fees</span>
            <span>{s.totals.lateFees ? money(s.totals.lateFees) : "—"}</span>
            <span>Late fees waived</span>
            <span>{s.totals.lateFeesWaived ? money(s.totals.lateFeesWaived) : "—"}</span>
            <span className="total-strong">Billed</span>
            <span className="total-strong">{money(s.totals.billed)}</span>
          </div>
        </Card>
      </div>
      <ChangePlanDialog
        open={changingPlan}
        onClose={() => setChangingPlan(false)}
        studentId={studentId}
        studentName={name}
        academicYearId={yearId}
        yearName={yearName}
        currentPlanId={s.installmentPlan?.id ?? null}
      />
      <GrantConcessionDialog
        open={granting}
        onClose={() => setGranting(false)}
        studentId={studentId}
        studentName={name}
        academicYearId={yearId}
        yearName={yearName}
        granted={s.concessions.map(c => c.concessionId)}
      />
    </div>
  );
}

function PaymentsTab({ statement: s }: { statement: Statement }) {
  const money = useMoney();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card flush>
      <DataTable
        rows={s.payments}
        rowKey={p => p.id}
        onRowClick={p => setOpen(p.id)}
        columns={[
          { key: "receiptNumber", header: "Receipt", render: p => <span className="mono nowrap">{p.receiptNumber ?? "—"}</span> },
          { key: "paidAt", header: "Date", render: p => <span className="nowrap">{formatDate(p.paidAt ?? p.createdAt)}</span> },
          { key: "method", header: "Method", render: p => methodLabel(p.method) },
          { key: "amount", header: "Amount", align: "right", render: p => <Amount value={p.amount} format={money} /> },
          { key: "excessAmount", header: "Kept as credit", align: "right", render: p => <Amount value={p.excessAmount} format={money} dashZero /> },
          { key: "status", header: "Status", render: p => <PaymentStatus status={p.status} /> }
        ]}
        empty={<EmptyState title="No payments this year." />}
      />
      <PaymentDrawer paymentId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function RefundsTab({ statement: s }: { statement: Statement }) {
  const money = useMoney();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card flush>
      <DataTable
        rows={s.refunds}
        rowKey={r => r.id}
        onRowClick={r => setOpen(r.id)}
        columns={[
          { key: "refundNumber", header: "Refund", render: r => (r.refundNumber ? <span className="mono nowrap">{r.refundNumber}</span> : <span className="muted">Request</span>) },
          { key: "createdAt", header: "Requested on", render: r => <span className="nowrap">{formatDate(r.createdAt)}</span> },
          { key: "from", header: "From", render: r => (r.paymentId ? "A payment" : "Credit") },
          { key: "method", header: "Method", render: r => methodLabel(r.method) },
          { key: "amount", header: "Amount", align: "right", render: r => <Amount value={r.amount} format={money} /> },
          { key: "status", header: "Status", render: r => <RefundStatus status={r.status} /> }
        ]}
        empty={<EmptyState title="No refunds this year." />}
      />
      <RefundDrawer refundId={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function CreditTab({ studentId, name, statement: s }: { studentId: string; name: string; statement: Statement }) {
  const { can } = useAuth();
  const money = useMoney();
  const credit = useStudentCredit(studentId);
  const [applying, setApplying] = useState(false);
  const [payingBack, setPayingBack] = useState(false);
  const balance = credit.data?.balance ?? s.credit.balance;
  const open = s.invoices.filter(isOpen);

  return (
    <Card
      flush
      title={
        <>
          Credit <span className="amount">{money(balance)}</span>
        </>
      }
      subtitle="Money kept from overpayments. Use it on an open invoice, or pay it back to the family."
      actions={
        <>
          {can("finance.credits.apply") && balance > 0 && open.length > 0 && (
            <Button size="sm" icon={<PiggyBank />} onClick={() => setApplying(true)}>
              Apply to invoice
            </Button>
          )}
          {can("finance.payments.refund") && balance > 0 && (
            <Button size="sm" icon={<Undo2 />} onClick={() => setPayingBack(true)}>
              Pay back
            </Button>
          )}
        </>
      }
    >
      <DataTable
        rows={credit.data?.entries}
        rowKey={e => e.id}
        loading={credit.isLoading}
        error={credit.error}
        onRetry={() => void credit.refetch()}
        columns={[
          { key: "createdAt", header: "When", render: e => <span className="nowrap">{formatDateTime(e.createdAt)}</span> },
          { key: "entryType", header: "What", render: e => CREDIT_ENTRY_LABELS[e.entryType] ?? enumLabel(e.entryType) },
          { key: "invoice", header: "Invoice", render: e => (e.invoice ? <span className="mono">{e.invoice.invoiceNumber}</span> : <span className="muted">—</span>) },
          { key: "notes", header: "Notes", render: e => e.notes ?? <span className="muted">—</span> },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: e => (
              <span className={`amount${e.entryType === "APPLIED" || e.entryType === "REFUNDED" ? " negative" : ""}`}>
                {e.entryType === "APPLIED" || e.entryType === "REFUNDED" ? money(-Math.abs(e.amount)) : money(Math.abs(e.amount))}
              </span>
            )
          }
        ]}
        empty={<EmptyState icon={<PiggyBank />} title="No credit history" message="Credit appears when a payment is more than an invoice's balance." />}
      />
      <ApplyCreditDialog
        open={applying}
        onClose={() => setApplying(false)}
        credit={balance}
        invoices={open.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, balance: i.balance, dueDate: i.dueDate }))}
      />
      <PayBackCreditDialog studentId={studentId} studentName={name} credit={balance} open={payingBack} onClose={() => setPayingBack(false)} />
    </Card>
  );
}
