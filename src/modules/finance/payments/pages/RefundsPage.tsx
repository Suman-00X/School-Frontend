/* FI-10 · Refunds: requests waiting for approval, every refund, credit refunds, gateway refunds to review */
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Check, Undo2, X } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, PageHeader, Select, Tabs, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { useMoney } from "../../shared";
import { Amount, RefundStatus, StudentCell } from "../../shared/components/FinanceStatus";
import { REFUND_STATUSES, actorName, methodLabel } from "../../shared/api/records";
import { refundStatusLabel } from "../../shared/components/FinanceStatus";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { useRefunds, type Refund, type RefundFilters } from "../api/refunds";
import { RefundDrawer, useRefundDecisions } from "../components/RefundDrawer";
import { dateRange } from "../utils/dateRange";

type View = "waiting" | "all" | "credit" | "review";

const VIEW_QUERY: Record<View, RefundFilters> = {
  waiting: { status: "REQUESTED" },
  all: {},
  credit: { creditOnly: "true" },
  review: { needsReview: "true" }
};

const EMPTY: Record<View, { title: string; message: string }> = {
  waiting: { title: "Nothing waiting for approval", message: "Accountants' refunds above the approval limit wait here for an administrator." },
  all: { title: "No refunds yet", message: "Refunds are made from a payment (Payments) or from a student's credit (their account)." },
  credit: { title: "No credit refunds", message: "Credit paid back to families from a student's account appears here." },
  review: { title: "Nothing to review", message: "Refunds made in the gateway's dashboard that the books could not fully cover appear here." }
};

const DEFAULTS = { view: "waiting", status: "", studentId: "", from: "", to: "" };

export default function RefundsPage() {
  const { refundId = null } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const money = useMoney();
  const decisions = useRefundDecisions();
  const { params, setParam, setParams, setPage } = useListParams(DEFAULTS);
  const view = (["waiting", "all", "credit", "review"].includes(params.view) ? params.view : "waiting") as View;
  const query: RefundFilters = {
    ...VIEW_QUERY[view],
    ...(view !== "waiting" && params.status ? { status: params.status } : {}),
    studentId: params.studentId || undefined,
    ...dateRange(params.from, params.to),
    page: params.page,
    limit: params.limit
  };
  const list = useRefunds(query);
  const waiting = useRefunds({ status: "REQUESTED", limit: 1 });
  const canDecide = can("finance.payments.approveRefund");
  const filtered = !!(params.status || params.studentId || params.from || params.to);

  const open = (id: string | null) => navigate({ pathname: id ? OPS_PATHS.refund(id) : OPS_PATHS.refunds, search: location.search });

  const columns: Column<Refund>[] = [
    { key: "refundNumber", header: "Refund no.", render: r => (r.refundNumber ? <span className="mono nowrap">{r.refundNumber}</span> : <span className="muted">Request</span>) },
    { key: "createdAt", header: "Requested on", render: r => <span className="nowrap">{formatDate(r.createdAt)}</span> },
    { key: "student", header: "Student", render: r => <StudentCell student={r.student} /> },
    { key: "from", header: "From", render: r => (r.payment ? <span className="mono nowrap">{r.payment.receiptNumber}</span> : "Credit") },
    { key: "amount", header: "Amount", align: "right", render: r => <Amount value={r.amount} format={money} /> },
    { key: "method", header: "Method", render: r => methodLabel(r.method) },
    { key: "status", header: "Status", render: r => <RefundStatus status={r.status} /> },
    { key: "requester", header: "Requested by", render: r => actorName(r.requester) || <span className="muted">{r.source === "GATEWAY" ? "Gateway" : "—"}</span> },
    { key: "approver", header: "Approved by", render: r => (r.autoApproved ? <span className="muted">Within limit</span> : actorName(r.approver) || <span className="muted">—</span>) },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 84,
      render: r =>
        canDecide && r.status === "REQUESTED" ? (
          <div className="row-actions" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" icon={<X />} title="Reject" aria-label={`Reject refund of ${money(r.amount)}`} onClick={() => decisions.askReject(r)} />
            <Button
              size="sm"
              variant="ghost"
              icon={<Check />}
              title="Approve"
              aria-label={`Approve refund of ${money(r.amount)}`}
              loading={decisions.approving === r.id}
              onClick={() => void decisions.askApprove(r)}
            />
          </div>
        ) : null
    }
  ];

  return (
    <>
      <PageHeader
        title="Refunds"
        subtitle={canDecide ? "Approve or reject accountants' refund requests, and find any refund." : "Refunds paid back to families, and requests waiting for an administrator."}
      />
      <Tabs
        value={view}
        onChange={id => setParams({ view: id, status: "" })}
        tabs={[
          { id: "waiting", label: "Waiting for approval", count: waiting.meta?.total ?? 0 },
          { id: "all", label: "All" },
          { id: "credit", label: "Credit refunds" },
          { id: "review", label: "Needs review" }
        ]}
      />
      <Card flush>
        <div className="filter-bar">
          <StudentSelect label="Student" className="select-sm" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} placeholder="Any student" />
          <Select
            label="Status"
            className="select-sm"
            value={view === "waiting" ? "REQUESTED" : params.status}
            disabled={view === "waiting"}
            onChange={e => setParam("status", e.target.value)}
            placeholder="Any status"
            options={REFUND_STATUSES.map(s => ({ value: s, label: refundStatusLabel(s) }))}
          />
          <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => open(r.id)}
          empty={
            <EmptyState
              icon={<Undo2 />}
              title={filtered ? "No refunds match these filters." : EMPTY[view].title}
              message={filtered ? undefined : EMPTY[view].message}
              actions={filtered && <Button onClick={() => setParams({ status: "", studentId: "", from: "", to: "" })}>Clear filters</Button>}
            />
          }
        />
      </Card>
      <RefundDrawer refundId={refundId} onClose={() => open(null)} />
      {decisions.rejectDialog}
    </>
  );
}
