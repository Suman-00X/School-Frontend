/* FI-09 · Payments and receipts: every payment, newest first; a row opens its drawer (/finance/payments/:paymentId) */
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Banknote } from "lucide-react";
import { useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, PageHeader, Select, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { useMoney } from "../../shared";
import { Amount, PaymentStatus, StudentCell } from "../../shared/components/FinanceStatus";
import { METHOD_LABELS, PAYMENT_METHODS, methodLabel } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { usePayments, type Payment } from "../api/payments";
import { PaymentDrawer } from "../components/PaymentDrawer";
import { dateRange } from "../utils/dateRange";

const STATUS_OPTIONS = [
  { value: "SUCCEEDED", label: "Received" },
  { value: "PENDING", label: "Waiting", description: "Online payments not confirmed yet" },
  { value: "FAILED", label: "Failed" }
];

const DEFAULTS = { studentId: "", method: "", status: "", from: "", to: "" };

export default function PaymentsPage() {
  const { paymentId = null } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const money = useMoney();
  const { params, setParam, setParams, setPage } = useListParams(DEFAULTS);
  const { from, to, studentId, method, status, page, limit } = params;
  const list = usePayments({ studentId, method, status, ...dateRange(from, to), page, limit });
  const filtered = Object.keys(DEFAULTS).some(k => params[k as keyof typeof DEFAULTS]);

  /* The drawer keeps the list's filters in the URL */
  const open = (id: string | null) => navigate({ pathname: id ? OPS_PATHS.payment(id) : OPS_PATHS.payments, search: location.search });

  const columns: Column<Payment>[] = [
    { key: "receiptNumber", header: "Receipt no.", render: p => <span className="mono nowrap">{p.receiptNumber ?? "—"}</span> },
    { key: "paidAt", header: "Date", render: p => <span className="nowrap">{formatDate(p.paidAt ?? p.createdAt)}</span> },
    { key: "student", header: "Student", render: p => <StudentCell student={p.student} /> },
    { key: "invoice", header: "Invoice", render: p => <span className="mono nowrap">{p.invoice?.invoiceNumber ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", render: p => <Amount value={p.amount} format={money} /> },
    { key: "method", header: "Method", render: p => methodLabel(p.method) },
    { key: "status", header: "Status", render: p => <PaymentStatus status={p.status} /> },
    { key: "excessAmount", header: "Credit kept", align: "right", render: p => <Amount value={p.excessAmount} format={money} dashZero /> },
    { key: "refundedAmount", header: "Refunded", align: "right", render: p => <Amount value={p.refundedAmount} format={money} dashZero /> }
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="Money received at the counter and online. Open one for its receipt and refunds." />
      <Card flush>
        <div className="filter-bar">
          <StudentSelect label="Student" className="select-sm" value={studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="Any student" />
          <Select
            label="Method"
            className="select-sm"
            value={method}
            onChange={e => setParam("method", e.target.value)}
            placeholder="Any method"
            options={PAYMENT_METHODS.map(m => ({ value: m, label: METHOD_LABELS[m] }))}
          />
          <Select label="Status" className="select-sm" value={status} onChange={e => setParam("status", e.target.value)} placeholder="Any status" options={STATUS_OPTIONS} />
          <TextInput label="From" type="date" className="input-sm" value={from} max={to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={to} min={from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={p => p.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={p => open(p.id)}
          empty={
            <EmptyState
              icon={<Banknote />}
              title={filtered ? "No payments match these filters." : "No payments yet"}
              message={filtered ? undefined : "Payments taken at the counter and online appear here."}
              actions={filtered && <Button onClick={() => setParams(DEFAULTS)}>Clear filters</Button>}
            />
          }
        />
      </Card>
      <PaymentDrawer paymentId={paymentId} onClose={() => open(null)} />
    </>
  );
}
