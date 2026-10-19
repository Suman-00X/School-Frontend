/* LB-05 · Loans and fines: a borrower's library account (fines, payments, credit, history, holds) */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { BookmarkPlus, ScanBarcode } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Badge, Button, ButtonLink, Card, DataTable, EmptyState, ErrorState, Page, RoleBadge, useTabParam, type TabItem } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import type { Hold, Loan } from "../../shared/api/types";
import { HoldStatusBadge, LoanStatusBadge } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { FINE_METHOD_LABELS, ordinal } from "../../shared/utils/labels";
import { HOLDS_PATH } from "../../holds/api/holds";
import { PlaceHoldDialog } from "../../holds/components/HoldDialogs";
import { HoldDrawer } from "../../holds/components/HoldDrawer";
import { LOANS_PATH, useAccount } from "../api/loans";
import { AccountChips, StandingBox } from "../components/BorrowerStanding";
import { FineAmount, useLoanActions } from "../components/LoanActions";
import { LoanDrawer } from "../components/LoanDrawer";
import { LoanRowMenu } from "../components/LoanRowMenu";

export default function BorrowerPage() {
  const { userId = "" } = useParams();
  const { can } = useAuth();
  const money = useMoney();
  const account = useAccount(userId);
  const a = account.data;
  const [loanId, setLoanId] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const tabs: TabItem[] = [
    { id: "fines", label: "Fines" },
    { id: "payments", label: "Payments" },
    { id: "credit", label: "Credit" },
    { id: "history", label: "Loan history" },
    { id: "holds", label: "Holds", hidden: !can("library.holds.read") }
  ];
  const [tab, setTab] = useTabParam(tabs);
  const name = a?.borrower.name ?? "";
  const header = (
    <DrillHeader
      back="/library/loans"
      backLabel="Back to loans"
      title={
        <span style={{ display: "inline-block", width: "min(240px, 40vw)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }} title={name}>
          {name || "Borrower"}
        </span>
      }
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );

  if (account.error)
    return (
      <Page>
        {header}
        <ErrorState error={account.error} onRetry={() => void account.refetch()} />
      </Page>
    );

  return (
    <Page>
      {header}
      <Card>
        <div className="lib-header">
          <div className="lib-header-main">
            <div className="row" style={{ gap: 8, minHeight: 24 }}>
              {a && <RoleBadge role={a.borrower.role} />}
              {a && a.borrower.status !== "ACTIVE" && <Badge tone="warning">Account {a.borrower.status.toLowerCase()}</Badge>}
            </div>
            <AccountChips account={a} />
          </div>
          <div className="row">
            {can("library.holds.manage") && (
              <Button icon={<BookmarkPlus />} onClick={() => setPlacing(true)} disabled={!a}>
                Place hold
              </Button>
            )}
            {can("library.loans.circulate") && (
              <ButtonLink variant="primary" icon={<ScanBarcode />} to={`/library/desk?borrower=${userId}`}>
                Open at the desk
              </ButtonLink>
            )}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <StandingBox account={a} />
        </div>
      </Card>

      {tab === "fines" && (
        <Card flush title="Loans with fines" subtitle="Open a loan to collect or waive its fine">
          <DataTable
            rows={a?.loansWithFines}
            loading={!a}
            rowKey={l => l.loanId}
            onRowClick={l => setLoanId(l.loanId)}
            empty={<EmptyState title="No fines owed" />}
            columns={[
              {
                key: "title",
                header: "Title",
                render: l => (
                  <div>
                    <div className="person-name">{l.title}</div>
                    <div className="person-sub mono">{l.accessionNumber}</div>
                  </div>
                )
              },
              { key: "status", header: "Status", render: l => <LoanStatusBadge status={l.status} /> },
              { key: "dueDate", header: "Due", render: l => <span className="nowrap">{formatDate(l.dueDate)}</span> },
              { key: "lateFine", header: "Late fine", align: "right", render: l => <FineAmount loan={{ status: l.status, fineIsFinal: l.status !== "ISSUED" }} value={l.lateFine} /> },
              { key: "lostCharge", header: "Lost", align: "right", render: l => (l.lostCharge ? money(l.lostCharge) : <span className="muted">—</span>) },
              { key: "damageCharge", header: "Damage", align: "right", render: l => (l.damageCharge ? money(l.damageCharge) : <span className="muted">—</span>) },
              { key: "finePaid", header: "Paid", align: "right", render: l => (l.finePaid ? money(l.finePaid) : <span className="muted">—</span>) },
              { key: "fineWaived", header: "Waived", align: "right", render: l => (l.fineWaived ? money(l.fineWaived) : <span className="muted">—</span>) },
              { key: "fineOutstanding", header: "Outstanding", align: "right", render: l => <strong className="num text-danger">{money(l.fineOutstanding)}</strong> }
            ]}
          />
        </Card>
      )}

      {tab === "payments" && (
        <Card flush title="Payments" subtitle="Fines paid at the desk">
          <DataTable
            rows={a?.payments}
            loading={!a}
            rowKey={p => p.id}
            onRowClick={p => p.loanId && setLoanId(p.loanId)}
            empty={<EmptyState title="No payments yet" />}
            columns={[
              { key: "receiptNumber", header: "Receipt", render: p => <span className="mono">{p.receiptNumber}</span> },
              { key: "paidAt", header: "Paid", render: p => <span className="nowrap">{formatDateTime(p.paidAt)}</span> },
              { key: "title", header: "For", render: p => p.title ?? <span className="muted">—</span> },
              { key: "method", header: "Method", render: p => FINE_METHOD_LABELS[p.method] },
              { key: "amount", header: "Amount", align: "right", render: p => <span className="num">{money(p.amount)}</span> }
            ]}
          />
        </Card>
      )}

      {tab === "credit" && (
        <Card flush title="Library credit" subtitle={a ? `${money(a.credit)} available. Credit comes from reversed charges and pays fines at the desk.` : undefined}>
          <DataTable
            rows={a?.credits}
            loading={!a}
            rowKey={c => c.id}
            empty={<EmptyState title="No credit entries" />}
            columns={[
              { key: "createdAt", header: "When", render: c => <span className="nowrap">{formatDateTime(c.createdAt)}</span> },
              { key: "reason", header: "Why" },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                render: c => <span className={`num${c.amount < 0 ? " text-danger" : " text-success"}`}>{c.amount > 0 ? "+" : ""}{money(c.amount)}</span>
              }
            ]}
          />
        </Card>
      )}

      {tab === "history" && <HistoryTab userId={userId} onOpen={setLoanId} />}
      {tab === "holds" && <HoldsTab userId={userId} onOpen={setHoldId} />}

      <LoanDrawer loanId={loanId} onClose={() => setLoanId(null)} />
      <HoldDrawer holdId={holdId} onClose={() => setHoldId(null)} />
      {a && <PlaceHoldDialog open={placing} onClose={() => setPlacing(false)} borrower={{ userId, name: a.borrower.name, role: a.borrower.role }} />}
    </Page>
  );
}

function HistoryTab({ userId, onOpen }: { userId: string; onOpen: (id: string) => void }) {
  const { params, setPage } = useListParams({}, { limit: 20 });
  const list = useApiList<Loan>(LOANS_PATH, { borrowerUserId: userId, page: params.page, limit: params.limit });
  const { actionsFor, dialogs } = useLoanActions();
  return (
    <Card flush title="Loan history">
      <DataTable
        rows={list.rows}
        rowKey={l => l.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={setPage}
        onRowClick={l => onOpen(l.id)}
        empty={<EmptyState title="Nothing borrowed yet" />}
        columns={[
          {
            key: "title",
            header: "Title",
            render: l => (
              <div>
                <div className="person-name">{l.book.title}</div>
                <div className="person-sub mono">{l.copy.accessionNumber}</div>
              </div>
            )
          },
          { key: "issuedOn", header: "Issued", render: l => <span className="nowrap">{formatDate(l.issuedOn)}</span> },
          { key: "dueDate", header: "Due", render: l => <span className={`nowrap${l.isOverdue ? " text-danger" : ""}`}>{formatDate(l.dueDate)}</span> },
          { key: "returnedOn", header: "Returned", render: l => (l.returnedOn ? <span className="nowrap">{formatDate(l.returnedOn)}</span> : <span className="muted">—</span>) },
          { key: "status", header: "Status", render: l => <LoanStatusBadge status={l.status} overdue={l.isOverdue} /> },
          { key: "fineOutstanding", header: "Outstanding", align: "right", render: l => <FineAmount loan={l} value={l.fineOutstanding} /> },
          { key: "actions", header: "", align: "right", width: 150, render: l => <LoanRowMenu actions={actionsFor(l)} label={l.book.title} /> }
        ]}
      />
      {dialogs}
    </Card>
  );
}

function HoldsTab({ userId, onOpen }: { userId: string; onOpen: (id: string) => void }) {
  const list = useApiList<Hold>(HOLDS_PATH, { borrowerUserId: userId, limit: 50 });
  return (
    <Card flush title="Holds">
      <DataTable
        rows={list.rows}
        rowKey={h => h.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        onRowClick={h => onOpen(h.id)}
        empty={<EmptyState title="No holds" />}
        columns={[
          { key: "book", header: "Book", render: h => h.book.title },
          { key: "status", header: "Status", render: h => <HoldStatusBadge status={h.status} /> },
          {
            key: "where",
            header: "",
            render: h =>
              h.status === "READY" && h.copy ? (
                <span>
                  Copy <span className="mono">{h.copy.accessionNumber}</span> kept until {formatDate(h.pickupBy)}
                </span>
              ) : h.status === "WAITING" && h.queuePosition ? (
                `${ordinal(h.queuePosition)} in line`
              ) : (
                <span className="muted">{h.closedReason ?? ""}</span>
              )
          },
          { key: "requestedAt", header: "Requested", render: h => <span className="nowrap">{formatDate(h.requestedAt)}</span> }
        ]}
      />
    </Card>
  );
}
