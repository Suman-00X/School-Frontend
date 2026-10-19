import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Download, X } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiMutation } from "@/common/hooks";
import { Button, DescriptionList, Drawer, ErrorState, SkeletonBlock, useConfirm, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared";
import { RefundStatus } from "../../shared/components/FinanceStatus";
import { ReasonDialog } from "../../shared/components/ReasonDialog";
import { actorName, methodLabel, studentLabel } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { approveRefund, downloadRefundReceipt, hasRefundReceipt, rejectRefund, useRefund, type Refund } from "../api/refunds";

const refundTitle = (r: Refund) => r.refundNumber ?? "Refund request";

/* Approve (pays the money back now) or reject a request; both need finance.payments.approveRefund */
export function useRefundDecisions() {
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const approve = useApiMutation(approveRefund, { invalidate: ["/finance/"] });
  const reject = useApiMutation(rejectRefund, { invalidate: ["/finance/"] });
  const [rejecting, setRejecting] = useState<Refund | null>(null);

  const askApprove = async (r: Refund) => {
    const ok = await confirm({
      title: `Approve the refund of ${money(r.amount)}?`,
      message: `Money will be paid back now to ${studentLabel(r.student)}'s family (${methodLabel(r.method)}), and a refund number is given.`,
      confirmLabel: "Approve and pay back",
      tone: "primary"
    });
    if (ok) approve.mutate(r.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const rejectDialog = (
    <ReasonDialog
      open={!!rejecting}
      onClose={() => setRejecting(null)}
      title={rejecting ? `Reject the refund of ${money(rejecting.amount)}?` : "Reject"}
      message="No money is paid back. The person who asked sees your reason."
      label="Why is it rejected?"
      confirmLabel="Reject request"
      onSubmit={async ({ reason }) => {
        if (!rejecting) return;
        const res = await reject.mutateAsync({ refundId: rejecting.id, reason });
        toast.success(res.message);
      }}
    />
  );

  return { askApprove, askReject: setRejecting, approving: approve.isPending ? approve.variables : null, rejectDialog };
}

/* FI-10 refund drawer: every field, a timeline, and the decision buttons */
export function RefundDrawer({ refundId, onClose }: { refundId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const money = useMoney();
  const refund = useRefund(refundId);
  const decisions = useRefundDecisions();
  const [printing, setPrinting] = useState(false);
  const r = refund.data;
  const canDecide = !!r && r.status === "REQUESTED" && can("finance.payments.approveRefund");

  const print = async () => {
    if (!r) return;
    setPrinting(true);
    try {
      await downloadRefundReceipt(r);
    } catch (e) {
      toast.error(e);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Drawer
      open={!!refundId}
      onClose={onClose}
      title={r ? refundTitle(r) : "Refund"}
      subtitle={r ? `${money(r.amount)} · ${studentLabel(r.student)}` : " "}
      footer={
        <>
          {canDecide && (
            <>
              <Button icon={<X />} onClick={() => decisions.askReject(r!)}>
                Reject
              </Button>
              <Button variant="primary" icon={<Check />} loading={decisions.approving === r!.id} onClick={() => void decisions.askApprove(r!)}>
                Approve
              </Button>
            </>
          )}
          {r && hasRefundReceipt(r) && (
            <Button variant={canDecide ? "default" : "primary"} icon={<Download />} loading={printing} onClick={() => void print()}>
              Receipt PDF
            </Button>
          )}
          {r && !canDecide && !hasRefundReceipt(r) && <Button onClick={onClose}>Close</Button>}
        </>
      }
    >
      {refund.error ? (
        <ErrorState error={refund.error} onRetry={() => void refund.refetch()} />
      ) : !r ? (
        <SkeletonBlock lines={10} />
      ) : (
        <div className="stack">
          <DescriptionList
            items={[
              { label: "Status", value: <RefundStatus status={r.status} /> },
              { label: "Amount", value: money(r.amount) },
              { label: "Student", value: r.student ? <Link to={OPS_PATHS.student(r.studentId)}>{studentLabel(r.student)}</Link> : null },
              { label: "Admission no.", value: r.student?.admissionNumber },
              {
                label: "From",
                value: r.payment ? (
                  <Link to={OPS_PATHS.payment(r.payment.id)} className="mono">
                    {r.payment.receiptNumber}
                  </Link>
                ) : (
                  "Student credit"
                )
              },
              { label: "Invoice", value: r.invoice ? <Link to={OPS_PATHS.invoice(r.invoice.id)} className="mono">{r.invoice.invoiceNumber}</Link> : null },
              { label: "Paid back by", value: methodLabel(r.method) },
              { label: "Reference", value: r.reference },
              { label: "Taken off the invoice", value: money(r.fromInvoice), hidden: !r.fromInvoice },
              { label: "Taken from credit", value: money(r.fromCredit), hidden: !r.fromCredit },
              { label: "Not covered (to review)", value: <span className="negative">{money(r.unallocated)}</span>, hidden: !r.unallocated },
              { label: "Made in", value: r.source === "GATEWAY" ? "The gateway's dashboard" : "This system" },
              { label: "Reason", value: r.reason, wide: true }
            ]}
          />
          <div className="stack-sm">
            <div className="section-title">What happened</div>
            <ol className="timeline">
              <TimelineItem tone="" title={r.source === "GATEWAY" ? "Reported by the gateway" : `Requested by ${actorName(r.requester) || "staff"}`} at={r.createdAt} />
              {r.approvedAt && (
                <TimelineItem
                  tone="success"
                  title={r.autoApproved ? "Within the approval limit: no approval needed" : `Approved by ${actorName(r.approver) || "an administrator"}`}
                  at={r.approvedAt}
                />
              )}
              {r.rejectedAt && <TimelineItem tone="danger" title={`Rejected by ${actorName(r.rejecter) || "an administrator"}`} at={r.rejectedAt} note={r.rejectionReason} />}
              {r.processedAt && <TimelineItem tone="success" title={`Paid back${r.refundNumber ? ` · ${r.refundNumber}` : ""}`} at={r.processedAt} />}
              {r.status === "PENDING" && <TimelineItem tone="warning" title="Being paid out by the gateway" />}
              {r.failedAt && <TimelineItem tone="danger" title="Failed: the money went back on the invoice or credit" at={r.failedAt} />}
              {r.status === "REQUESTED" && <TimelineItem tone="warning" title="Waiting for an administrator" />}
            </ol>
          </div>
        </div>
      )}
      {decisions.rejectDialog}
    </Drawer>
  );
}

function TimelineItem({ tone, title, at, note }: { tone: string; title: string; at?: string | null; note?: string | null }) {
  return (
    <li>
      <span className={`dot ${tone}`} />
      <div>
        <div>{title}</div>
        {at && <div className="small muted">{formatDateTime(at)}</div>}
        {note && <div className="small">{note}</div>}
      </div>
    </li>
  );
}
