import { Link } from "react-router-dom";
import { Button, DataTable, DescriptionList, Drawer, ErrorState, RoleBadge, SkeletonBlock } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { LoanStatusBadge } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { FINE_METHOD_LABELS, plural } from "../../shared/utils/labels";
import { useLoan } from "../api/loans";
import { useLoanActions } from "./LoanActions";

/* LB-05 loan drawer: the terms copied at issue, dates, money, notes, payments and waivers,
   and the actions its status allows */
export function LoanDrawer({ loanId, onClose }: { loanId: string | null; onClose: () => void }) {
  const money = useMoney();
  const q = useLoan(loanId);
  const { actionsFor, dialogs, renewing } = useLoanActions();
  const loan = q.data;
  const actions = loan ? actionsFor(loan) : [];

  const m = (n: number | null | undefined, hideZero = true) => (hideZero && !n ? null : money(n));

  return (
    <>
      <Drawer
        open={!!loanId}
        onClose={onClose}
        wide
        title={loan ? loan.book.title : "Loan"}
        subtitle={
          loan && (
            <span className="row" style={{ gap: 8 }}>
              <span className="mono">{loan.copy.accessionNumber}</span>
              <LoanStatusBadge status={loan.status} overdue={loan.isOverdue} />
            </span>
          )
        }
        footer={
          actions.length ? (
            <>
              {actions.map(a => (
                <Button key={a.id} icon={a.icon} onClick={a.run} loading={a.id === "renew" && renewing} variant={a.id === "return" ? "primary" : "default"}>
                  {a.label}
                </Button>
              ))}
            </>
          ) : undefined
        }
      >
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !loan ? (
          <SkeletonBlock lines={10} />
        ) : (
          <div className="stack">
            <DescriptionList
              columns={2}
              items={[
                {
                  label: "Borrower",
                  value: (
                    <span className="row" style={{ gap: 6 }}>
                      <Link to={`/library/borrowers/${loan.borrowerUserId}`} onClick={onClose}>
                        {loan.borrower.name}
                      </Link>
                      <RoleBadge role={loan.borrowerRole} />
                    </span>
                  )
                },
                { label: "Book", value: <Link to={`/library/books/${loan.bookId}`}>{loan.book.title}</Link> }
              ]}
            />
            <div className="section-title">Dates</div>
            <DescriptionList
              columns={3}
              items={[
                { label: "Issued", value: formatDate(loan.issuedOn) },
                {
                  label: "Due",
                  value: (
                    <span className={loan.isOverdue ? "text-danger" : undefined}>
                      {formatDate(loan.dueDate)}
                      {loan.isOverdue && ` · ${plural(loan.daysOverdue, "day")} late`}
                    </span>
                  )
                },
                { label: "Renewals", value: `${loan.renewalCount} of ${loan.maxRenewals}` },
                { label: "Returned", value: formatDate(loan.returnedOn), hidden: !loan.returnedOn },
                { label: "Lost", value: formatDate(loan.lostOn), hidden: !loan.lostOn },
                { label: "Found", value: formatDate(loan.foundOn), hidden: !loan.foundOn },
                { label: "Condition on return", value: loan.returnCondition === "OK" ? "Fine" : loan.returnCondition?.toLowerCase(), hidden: !loan.returnCondition }
              ]}
            />
            <div className="section-title">Terms at issue</div>
            <DescriptionList
              columns={3}
              items={[
                { label: "Loan period", value: plural(loan.loanDays, "day") },
                { label: "Fine per day", value: money(loan.finePerDay) },
                { label: "Grace days", value: loan.fineGraceDays },
                { label: "Most the late fine can be", value: loan.fineCap === null ? "No cap" : money(loan.fineCap) }
              ]}
            />
            <div className="section-title">Money{!loan.fineIsFinal && <span className="muted"> · the late fine still grows while the book is out</span>}</div>
            <DescriptionList
              columns={3}
              items={[
                { label: "Late fine", value: money(loan.lateFine) },
                { label: "Lost charge", value: m(loan.lostCharge), hidden: !loan.lostCharge && loan.status !== "LOST" },
                { label: "Damage charge", value: m(loan.damageCharge), hidden: !loan.damageCharge },
                { label: "Lost charge reversed", value: m(loan.lostChargeReversed), hidden: !loan.lostChargeReversed },
                { label: "Paid", value: m(loan.finePaid) },
                { label: "Waived", value: m(loan.fineWaived) },
                { label: "Credited", value: m(loan.fineCredited), hidden: !loan.fineCredited },
                {
                  label: "Outstanding",
                  value: <strong className={loan.fineOutstanding ? "text-danger" : undefined}>{money(loan.fineOutstanding)}</strong>
                }
              ]}
            />
            {(loan.backdateReason || loan.blockOverrideReason || loan.returnNotes) && (
              <>
                <div className="section-title">Notes</div>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: "Back-dated because", value: loan.backdateReason, hidden: !loan.backdateReason },
                    { label: "Block overridden because", value: loan.blockOverrideReason, hidden: !loan.blockOverrideReason },
                    { label: "Return notes", value: loan.returnNotes, hidden: !loan.returnNotes }
                  ]}
                />
              </>
            )}
            {!!loan.payments?.length && (
              <>
                <div className="section-title">Payments</div>
                <DataTable
                  rows={loan.payments}
                  rowKey={p => p.id}
                  columns={[
                    { key: "receiptNumber", header: "Receipt", render: p => <span className="mono">{p.receiptNumber}</span> },
                    { key: "paidAt", header: "Paid", render: p => formatDateTime(p.paidAt) },
                    { key: "method", header: "Method", render: p => FINE_METHOD_LABELS[p.method] + (p.reference ? ` · ${p.reference}` : "") },
                    { key: "amount", header: "Amount", align: "right", render: p => <span className="num">{money(p.amount)}</span> }
                  ]}
                />
              </>
            )}
            {!!loan.waivers?.length && (
              <>
                <div className="section-title">Waivers</div>
                <DataTable
                  rows={loan.waivers}
                  rowKey={w => w.id}
                  columns={[
                    { key: "waivedAt", header: "When", render: w => formatDateTime(w.waivedAt) },
                    { key: "reason", header: "Reason" },
                    { key: "amount", header: "Amount", align: "right", render: w => <span className="num">{money(w.amount)}</span> }
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Drawer>
      {dialogs}
    </>
  );
}
