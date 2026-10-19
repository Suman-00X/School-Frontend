import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Undo2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Button, DataTable, DescriptionList, Drawer, EmptyState, ErrorState, SkeletonBlock, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { UserName, useMoney } from "../../shared";
import { Amount, InvoiceStatus, PaymentStatus, RefundStatus } from "../../shared/components/FinanceStatus";
import { actorName, methodLabel, studentLabel } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { downloadReceipt, refundable, usePayment } from "../api/payments";
import { useRefunds } from "../api/refunds";
import { RefundPaymentDialog } from "./RefundPaymentDialog";

/* FI-09 payment drawer: the payment, its invoice, its refunds; receipt and refund actions */
export function PaymentDrawer({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const money = useMoney();
  const navigate = useNavigate();
  const payment = usePayment(paymentId);
  const refunds = useRefunds({ paymentId: paymentId ?? undefined, limit: 100 }, { enabled: !!paymentId });
  const [refunding, setRefunding] = useState(false);
  const [printing, setPrinting] = useState(false);
  const p = payment.data;

  const canRefund = !!p && can("finance.payments.refund") && p.status === "SUCCEEDED" && refundable(p) > 0;
  const print = async () => {
    if (!p) return;
    setPrinting(true);
    try {
      await downloadReceipt(p);
    } catch (e) {
      toast.error(e);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Drawer
      open={!!paymentId}
      onClose={onClose}
      title={p?.receiptNumber ? `Receipt ${p.receiptNumber}` : "Payment"}
      subtitle={p ? `${money(p.amount)} · ${methodLabel(p.method)} · ${studentLabel(p.student)}` : " "}
      footer={
        <>
          {canRefund && (
            <Button icon={<Undo2 />} onClick={() => setRefunding(true)}>
              Refund
            </Button>
          )}
          <Button variant="primary" icon={<Download />} loading={printing} disabled={!p || p.status !== "SUCCEEDED"} onClick={() => void print()}>
            Receipt PDF
          </Button>
        </>
      }
      footerStatus={p && p.status !== "SUCCEEDED" ? "Receipts are available only for successful payments" : undefined}
    >
      {payment.error ? (
        <ErrorState error={payment.error} onRetry={() => void payment.refetch()} />
      ) : !p ? (
        <SkeletonBlock lines={10} />
      ) : (
        <div className="stack">
          <DescriptionList
            items={[
              { label: "Status", value: <PaymentStatus status={p.status} /> },
              { label: "Paid on", value: formatDateTime(p.paidAt ?? p.createdAt) },
              { label: "Student", value: p.student ? <Link to={OPS_PATHS.student(p.studentId)}>{studentLabel(p.student)}</Link> : null },
              { label: "Admission no.", value: p.student?.admissionNumber },
              { label: "Amount", value: money(p.amount) },
              { label: "Method", value: methodLabel(p.method) },
              { label: "Reference", value: p.reference },
              { label: "Received by", value: <UserName id={p.receivedBy} /> },
              { label: "Invoice balance after", value: p.balanceAfter === null ? null : money(p.balanceAfter) },
              { label: "Kept as credit", value: p.excessAmount ? money(p.excessAmount) : null, hidden: !p.excessAmount },
              { label: "Refunded", value: p.refundedAmount ? money(p.refundedAmount) : null, hidden: !p.refundedAmount },
              { label: "Notes", value: p.notes, wide: true, hidden: !p.notes },
              { label: "Gateway", value: p.gatewayProvider, hidden: !p.gatewayProvider },
              { label: "Gateway order", value: p.gatewayOrderId && <span className="mono">{p.gatewayOrderId}</span>, hidden: !p.gatewayOrderId },
              { label: "Gateway payment", value: p.gatewayPaymentId && <span className="mono">{p.gatewayPaymentId}</span>, hidden: !p.gatewayPaymentId }
            ]}
          />
          {p.invoice && (
            <div className="stack-sm">
              <div className="section-title">Invoice</div>
              <DescriptionList
                items={[
                  { label: "Invoice", value: <Link to={OPS_PATHS.invoice(p.invoice.id)} className="mono">{p.invoice.invoiceNumber}</Link> },
                  { label: "Status", value: <InvoiceStatus status={p.invoice.status} /> },
                  { label: "Total", value: money(p.invoice.total) },
                  { label: "Paid", value: money(p.invoice.amountPaid) },
                  { label: "Balance", value: money(p.invoice.balance) }
                ]}
              />
            </div>
          )}
          <div className="stack-sm">
            <div className="section-title">Refunds</div>
            <div className="table-shell">
              <DataTable
                rows={refunds.rows}
                rowKey={r => r.id}
                loading={refunds.isLoading}
                error={refunds.error}
                onRowClick={r => navigate(OPS_PATHS.refund(r.id))}
                columns={[
                  { key: "refundNumber", header: "Refund", render: r => <span className="mono nowrap">{r.refundNumber ?? "Request"}</span> },
                  { key: "amount", header: "Amount", align: "right", render: r => <Amount value={r.amount} format={money} /> },
                  { key: "method", header: "Method", render: r => methodLabel(r.method) },
                  { key: "status", header: "Status", render: r => <RefundStatus status={r.status} /> },
                  { key: "who", header: "Requested by", render: r => actorName(r.requester) || <span className="muted">Gateway</span> }
                ]}
                empty={<EmptyState title="No refunds of this payment." />}
              />
            </div>
          </div>
        </div>
      )}
      {p && <RefundPaymentDialog payment={p} open={refunding} onClose={() => setRefunding(false)} />}
    </Drawer>
  );
}
