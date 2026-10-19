import { useMemo, useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { useApiList, useListParams } from "@/common/hooks";
import { Badge, Card, DataTable, EmptyState, PersonCell, RoleBadge, Select, StatusBadge, TextInput, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { EmployeeSelect } from "../../shared/components/EmployeeSelect";
import { dateSpan } from "../../shared/utils/format";
import { LEAVE_REQUESTS_PATH, LEAVE_TYPES_PATH, type LeaveRequest, type LeaveType } from "../api/leaves";
import { CancelLeaveDialog, DecisionDialog } from "./LeaveActionDialogs";
import { LeaveRequestDrawer } from "./LeaveRequestDrawer";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending", description: "Waiting for a decision" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All requests" }
];

const nameOf = (r: LeaveRequest) => (r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : "—");

/* HR-04 Requests tab: opens on pending requests, so it works as the approval queue */
export function RequestsPanel() {
  const { params, setParam, setPage } = useListParams({ status: "PENDING", userId: "", leaveTypeId: "", from: "", to: "" });
  const query = {
    page: params.page,
    limit: params.limit,
    status: params.status === "ALL" ? undefined : params.status,
    userId: params.userId || undefined,
    leaveTypeId: params.leaveTypeId || undefined,
    from: params.from || undefined,
    to: params.to || undefined
  };
  const list = useApiList<LeaveRequest>(LEAVE_REQUESTS_PATH, query);
  const types = useApiList<LeaveType>(LEAVE_TYPES_PATH, { limit: 100 });

  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ request: LeaveRequest; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  /* The drawer shows the row as it is in the latest list (refreshed after an action) */
  const [lastSeen, setLastSeen] = useState<LeaveRequest | null>(null);
  const open = (openId && (list.rows?.find(r => r.id === openId) ?? (lastSeen?.id === openId ? lastSeen : null))) || null;

  const known = useMemo(
    () => (list.rows ?? []).filter(r => r.user).map(r => ({ userId: r.userId, name: nameOf(r), role: r.user!.role })),
    [list.rows]
  );

  const filtered = params.status !== "PENDING" || !!params.userId || !!params.leaveTypeId || !!params.from || !!params.to;

  const columns: Column<LeaveRequest>[] = [
    { key: "employee", header: "Employee", render: r => <PersonCell name={nameOf(r)} extra={<RoleBadge role={r.user?.role} />} /> },
    {
      key: "type",
      header: "Leave type",
      render: r => (
        <span className="row nowrap" style={{ gap: 6 }}>
          {r.leaveType?.name ?? "—"}
          {r.leaveType && !r.leaveType.isPaid && <Badge tone="warning">Unpaid</Badge>}
        </span>
      )
    },
    {
      key: "dates",
      header: "Dates",
      render: r => (
        <span className="row nowrap" style={{ gap: 6 }}>
          {dateSpan(r.fromDate, r.toDate)}
          {r.halfDay && <Badge tone="info">½ day</Badge>}
        </span>
      )
    },
    { key: "days", header: "Days", align: "right", render: r => <span className="hr-num">{r.days}</span> },
    {
      key: "reason",
      header: "Reason",
      render: r => (
        <span className="muted" title={r.reason} style={{ display: "inline-block", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
          {r.reason}
        </span>
      )
    },
    { key: "status", header: "Status", render: r => <StatusBadge status={r.status} /> },
    { key: "applied", header: "Applied", render: r => <span className="nowrap">{formatDate(r.createdAt)}</span> }
  ];

  const statusLabel = STATUS_OPTIONS.find(o => o.value === params.status)?.label.toLowerCase();

  return (
    <>
      <Card flush>
        <div className="filter-bar">
          <Select label="Status" className="select-sm" value={params.status} onChange={e => setParam("status", e.target.value)} options={STATUS_OPTIONS} required />
          <EmployeeSelect label="Employee" className="select-sm" value={params.userId} known={known} onChange={id => setParam("userId", id)} />
          <Select
            label="Leave type"
            className="select-sm"
            value={params.leaveTypeId}
            onChange={e => setParam("leaveTypeId", e.target.value)}
            placeholder="All types"
            options={(types.rows ?? []).map(t => ({ value: t.id, label: t.name }))}
          />
          <TextInput label="From" type="date" className="input-sm" value={params.from} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => {
            setOpenId(r.id);
            setLastSeen(r);
          }}
          columns={columns}
          empty={
            filtered ? (
              <EmptyState icon={<CalendarCheck2 />} title={`No ${statusLabel === "all requests" ? "" : statusLabel + " "}requests match these filters`} />
            ) : (
              <EmptyState icon={<CalendarCheck2 />} title="Nothing waiting" message="No leave request is waiting for a decision." />
            )
          }
        />
      </Card>
      <LeaveRequestDrawer
        request={open}
        onClose={() => setOpenId(null)}
        onDecide={(request, d) => setDecision({ request, decision: d })}
        onCancel={setCancelling}
      />
      <DecisionDialog key={decision ? decision.request.id + decision.decision : "none"} request={decision?.request ?? null} decision={decision?.decision ?? "APPROVED"} onClose={() => setDecision(null)} onDone={setLastSeen} />
      <CancelLeaveDialog key={cancelling?.id ?? "none"} request={cancelling} onClose={() => setCancelling(null)} onDone={setLastSeen} />
    </>
  );
}
