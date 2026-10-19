import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Badge, Button, DescriptionList, Drawer, RoleBadge, Skeleton, StatusBadge } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { dateSpan, dayCount } from "../../shared/utils/format";
import { LEAVE_BALANCES_PATH, type LeaveBalances, type LeaveRequest } from "../api/leaves";
import { BalanceBar } from "./BalanceBar";

/* HR-04 drawer: the full request, its decision and cancellation trail, the employee's balance
   for that leave type, and the actions the reader may take */
export function LeaveRequestDrawer({
  request,
  onClose,
  onDecide,
  onCancel
}: {
  request: LeaveRequest | null;
  onClose: () => void;
  onDecide: (r: LeaveRequest, decision: "APPROVED" | "REJECTED") => void;
  onCancel: (r: LeaveRequest) => void;
}) {
  const { can, session } = useAuth();
  const r = request;
  const year = r ? Number(r.fromDate.slice(0, 4)) : undefined;
  const balances = useApiGet<LeaveBalances>(r && can("hr.leaveBalances.read") ? LEAVE_BALANCES_PATH : null, { userId: r?.userId, year });
  const balance = balances.data?.balances.find(b => b.leaveTypeId === r?.leaveTypeId);

  const own = r?.userId === session?.user.id;
  const canDecide = !!r && r.status === "PENDING" && can("hr.leaveRequests.decide") && !own;
  const canCancel = !!r && (r.status === "PENDING" || r.status === "APPROVED") && can("hr.leaveRequests.cancelAny");
  const name = r?.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : "Leave request";

  const footer =
    canDecide || canCancel ? (
      <>
        {canCancel && (
          <Button variant={canDecide ? "ghost" : "danger"} onClick={() => r && onCancel(r)}>
            Cancel request
          </Button>
        )}
        {canDecide && (
          <>
            <Button variant="danger" onClick={() => r && onDecide(r, "REJECTED")}>
              Reject
            </Button>
            <Button variant="primary" onClick={() => r && onDecide(r, "APPROVED")}>
              Approve
            </Button>
          </>
        )}
      </>
    ) : undefined;

  return (
    <Drawer
      open={!!r}
      onClose={onClose}
      title={name}
      subtitle={
        r && (
          <span className="row" style={{ gap: 6 }}>
            <RoleBadge role={r.user?.role} />
            <StatusBadge status={r.status} />
          </span>
        )
      }
      footerStatus={own && r?.status === "PENDING" && can("hr.leaveRequests.decide") ? "This is your own request: someone else decides on it." : undefined}
      footer={footer}
    >
      {r && (
        <div className="stack">
          <DescriptionList
            columns={2}
            items={[
              {
                label: "Leave type",
                value: (
                  <span className="row" style={{ gap: 6 }}>
                    {r.leaveType?.name ?? "—"}
                    {r.leaveType && (r.leaveType.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">Unpaid</Badge>)}
                  </span>
                )
              },
              { label: "Days", value: r.halfDay ? "Half day" : dayCount(r.days) },
              { label: "Dates", value: dateSpan(r.fromDate, r.toDate), wide: true },
              { label: "Reason", value: r.reason, wide: true },
              { label: "Applied", value: formatDateTime(r.createdAt) }
            ]}
          />

          {can("hr.leaveBalances.read") && (
            <div className="stack-sm">
              <div className="section-title">
                {r.leaveType?.name ?? "Leave"} balance, {year}
              </div>
              {/* Fixed height: a skeleton while it loads */}
              <div style={{ minHeight: 44 }}>
                {balances.isLoading ? (
                  <Skeleton height={40} />
                ) : balance ? (
                  <BalanceBar balance={balance} />
                ) : (
                  <span className="small muted">No balance for this leave type.</span>
                )}
              </div>
            </div>
          )}

          {(r.decidedAt || r.cancelledAt) && (
            <div className="stack-sm">
              <div className="section-title">Trail</div>
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: r.status === "REJECTED" ? "Rejected" : "Approved",
                    value: r.decidedAt && (
                      <>
                        {formatDateTime(r.decidedAt)}
                        {r.decisionNote && <div className="muted">“{r.decisionNote}”</div>}
                      </>
                    ),
                    hidden: !r.decidedAt
                  },
                  {
                    label: "Cancelled",
                    value: r.cancelledAt && (
                      <>
                        {formatDateTime(r.cancelledAt)}
                        {r.cancelReason && <div className="muted">“{r.cancelReason}”</div>}
                      </>
                    ),
                    hidden: !r.cancelledAt
                  }
                ]}
              />
            </div>
          )}

          {can("hr.activity.read") && (
            <Link className="row small" style={{ gap: 6 }} to={`/hr/activity?entityId=${r.id}`}>
              <History size={14} /> History of this request
            </Link>
          )}
        </div>
      )}
    </Drawer>
  );
}
