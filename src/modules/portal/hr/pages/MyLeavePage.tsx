import { useState } from "react";
import { CalendarPlus, Plane } from "lucide-react";
import { errorMessage } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, Dialog, EmptyState, ErrorState, Page, PageHeader, Select, SkeletonBlock, Textarea, useToast, type Column } from "@/common/ui";
import { enumLabel, formatDate } from "@/common/utils/format";
import { LEAVE_STATUS_TONES, MY_BALANCES_PATH, MY_LEAVE_PATH, cancelLeave, type LeaveRequest, type MyLeaveBalances } from "../api/hr";
import { ApplyLeaveDrawer } from "../components/ApplyLeaveDrawer";
import "../../shared/portal.css";

const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(s => ({ value: s, label: enumLabel(s) }));
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/* PO-11 · My leave: balances per type for a year, the requests made, applying and cancelling */
export default function MyLeavePage() {
  const { can } = useAuth();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const { params, setParams, setPage } = useListParams({ year: String(thisYear), status: "" });
  const balances = useApiGet<MyLeaveBalances>(can("hr.leaveBalances.readOwn") ? MY_BALANCES_PATH : null, { year: params.year });
  const list = useApiList<LeaveRequest>(MY_LEAVE_PATH, { status: params.status, page: params.page, limit: params.limit }, { enabled: can("hr.leaveRequests.readOwn") });
  const [applying, setApplying] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancel = useApiMutation(cancelLeave, { invalidate: [MY_LEAVE_PATH, MY_BALANCES_PATH] });

  const years = [thisYear - 1, thisYear, thisYear + 1].map(y => ({ value: String(y), label: String(y) }));

  const confirmCancel = () => {
    if (!cancelling) return;
    setCancelError(null);
    cancel.mutate(
      { id: cancelling.id, reason: reason.trim() || undefined },
      {
        onSuccess: res => {
          toast.success(res.message);
          setCancelling(null);
          setReason("");
        },
        onError: e => setCancelError(errorMessage(e))
      }
    );
  };

  const columns: Column<LeaveRequest>[] = [
    { key: "type", header: "Type", render: r => r.leaveType?.name ?? "—" },
    {
      key: "dates",
      header: "Dates",
      render: r => (
        <span className="nowrap">
          {r.fromDate === r.toDate ? formatDate(r.fromDate) : `${formatDate(r.fromDate)} – ${formatDate(r.toDate)}`}
          {r.halfDay && <span className="muted"> · ½ day</span>}
        </span>
      )
    },
    { key: "days", header: "Days", align: "right", render: r => r.days },
    {
      key: "status",
      header: "Status",
      render: r => (
        <Badge tone={LEAVE_STATUS_TONES[r.status]} dot>
          {enumLabel(r.status)}
        </Badge>
      )
    },
    {
      key: "note",
      header: "Note",
      render: r => <span className="muted" title={r.decisionNote ?? r.cancelReason ?? r.reason}>{r.decisionNote ?? r.cancelReason ?? r.reason}</span>
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: 90,
      render: r =>
        r.status === "PENDING" && can("hr.leaveRequests.cancel") ? (
          <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
            Cancel
          </Button>
        ) : null
    }
  ];

  const b = balances.data;

  return (
    <Page>
      <PageHeader
        title="My leave"
        subtitle="Your leave balances and requests"
        actions={
          can("hr.leaveRequests.apply") && (
            <Button variant="primary" icon={<CalendarPlus />} onClick={() => setApplying(true)} disabled={!b}>
              Apply for leave
            </Button>
          )
        }
      />

      {can("hr.leaveBalances.readOwn") && (
        <Card title="Balances" actions={<Select aria-label="Year" className="select-sm" required value={params.year} options={years} onChange={e => setParams({ year: e.target.value })} />}>
          {balances.error ? (
            <ErrorState error={balances.error} onRetry={() => void balances.refetch()} />
          ) : !b ? (
            <SkeletonBlock lines={3} />
          ) : b.balances.length === 0 ? (
            <EmptyState icon={<Plane />} title="No leave types set up yet" message="HR adds the types of leave and their yearly quota." />
          ) : (
            <div className="kpis">
              {b.balances.map(x => (
                <div key={x.leaveTypeId} className="kpi">
                  <div className="kpi-label">{x.name}</div>
                  <div className="kpi-value">
                    {x.remaining}
                    <span className="small muted" style={{ fontWeight: 400 }}>
                      {" "}
                      of {x.quota}
                    </span>
                  </div>
                  <div className="small muted">
                    {x.used} used{x.pending ? ` · ${x.pending} pending` : ""}
                    {!x.isPaid && " · unpaid"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {can("hr.leaveRequests.readOwn") && (
        <Card title="Requests" flush>
          <div className="filter-bar">
            <Select label="Status" className="select-sm" value={params.status} placeholder="Any status" options={STATUS_OPTIONS} onChange={e => setParams({ status: e.target.value })} />
          </div>
          <DataTable
            rows={list.rows}
            rowKey={r => r.id}
            loading={list.isLoading}
            error={list.error}
            onRetry={() => void list.refetch()}
            columns={columns}
            meta={list.meta}
            onPageChange={setPage}
            empty={<EmptyState icon={<Plane />} title={params.status ? "No requests with this status" : "No leave requests"} />}
          />
        </Card>
      )}

      <ApplyLeaveDrawer open={applying} onClose={() => setApplying(false)} balances={b?.balances ?? []} />

      <Dialog
        open={!!cancelling}
        onClose={() => {
          setCancelling(null);
          setCancelError(null);
          setReason("");
        }}
        title={cancelling ? `Cancel ${cancelling.leaveType?.name ?? "leave"} from ${formatDate(cancelling.fromDate)}?` : ""}
        footerStatus={cancelError}
        footer={
          <>
            <Button
              onClick={() => {
                setCancelling(null);
                setCancelError(null);
                setReason("");
              }}
            >
              Keep it
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={confirmCancel}>
              Cancel request
            </Button>
          </>
        }
      >
        <div className="stack-sm">
          <p>{cancelling ? `The request for ${days(cancelling.days)} is withdrawn and the days go back to your balance.` : ""}</p>
          <Textarea label="Reason" rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} hint="Optional" />
        </div>
      </Dialog>
    </Page>
  );
}
