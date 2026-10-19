import { useState } from "react";
import { ScanBarcode, UserRound } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Tabs } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { BorrowerAccount, Hold, Loan } from "../../shared/api/types";
import { useMoney } from "../../shared/hooks/useLibraryLookups";
import { plural } from "../../shared/utils/labels";
import { HOLDS_PATH } from "../../holds/api/holds";
import { LOANS_PATH } from "../api/loans";
import { FineAmount, useLoanActions } from "./LoanActions";
import type { LogEntry } from "./DeskLog";
import { LoanDrawer } from "./LoanDrawer";
import { LoanRowMenu } from "./LoanRowMenu";

/* Under the issue panel: the borrower's open loans (renew, return, collect, waive), holds ready
   for them at the desk, and loans with fines */
export function DeskLoans({
  borrowerId,
  account,
  onIssueHold,
  onLog
}: {
  borrowerId: string;
  account: BorrowerAccount | undefined;
  onIssueHold: (accessionNumber: string) => void;
  onLog: (e: Omit<LogEntry, "id" | "at">) => void;
}) {
  const { can } = useAuth();
  const money = useMoney();
  const canLoans = can("library.loans.read");
  const canHolds = can("library.holds.read");
  const loans = useApiList<Loan>(LOANS_PATH, { borrowerUserId: borrowerId, status: "ISSUED", limit: 50 }, { enabled: !!borrowerId && canLoans });
  const ready = useApiList<Hold>(HOLDS_PATH, { borrowerUserId: borrowerId, status: "READY", limit: 50 }, { enabled: !!borrowerId && canHolds });
  const [tab, setTab] = useState("loans");
  const [loanId, setLoanId] = useState<string | null>(null);
  const { actionsFor, dialogs } = useLoanActions({
    onDone: (_loan, kind, message) =>
      onLog({ kind: kind === "pay" || kind === "waive" ? "fine" : kind === "renew" ? "issue" : "return", text: message, tone: kind === "waive" ? "warning" : "success" })
  });

  if (!canLoans) return null;
  if (!borrowerId)
    return (
      <Card>
        <EmptyState icon={<UserRound />} title="No borrower picked" message="Their books on loan, holds waiting at the desk and fines show here." />
      </Card>
    );

  const tabs = [
    { id: "loans", label: "On loan", count: loans.meta?.total },
    { id: "ready", label: "Ready to collect", count: ready.meta?.total, hidden: !canHolds },
    { id: "fines", label: "Fines", count: account?.loansWithFines.length }
  ];

  return (
    <Card flush>
      <div style={{ padding: "0 14px" }}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      {tab === "loans" && (
        <DataTable
          rows={loans.rows}
          rowKey={l => l.id}
          loading={loans.isLoading}
          error={loans.error}
          onRetry={() => void loans.refetch()}
          onRowClick={l => setLoanId(l.id)}
          empty={<EmptyState title="Nothing on loan" message="Books issued now appear here." />}
          columns={[
            {
              key: "title",
              header: "Title",
              render: l => (
                <div style={{ minWidth: 0, maxWidth: 300 }}>
                  <div className="person-name" title={l.book.title}>
                    {l.book.title}
                  </div>
                  <div className="person-sub mono">{l.copy.accessionNumber}</div>
                </div>
              )
            },
            { key: "issuedOn", header: "Issued", render: l => <span className="nowrap">{formatDate(l.issuedOn)}</span> },
            {
              key: "dueDate",
              header: "Due",
              render: l => (
                <span className={`nowrap${l.isOverdue ? " text-danger" : ""}`}>
                  {formatDate(l.dueDate)}
                  {l.isOverdue && <div className="small">{plural(l.daysOverdue, "day")} late</div>}
                </span>
              )
            },
            { key: "renewals", header: "Renewed", render: l => `${l.renewalCount} of ${l.maxRenewals}` },
            { key: "fine", header: "Fine", align: "right", render: l => <FineAmount loan={l} value={l.fineOutstanding} /> },
            { key: "actions", header: "", align: "right", width: 150, render: l => <LoanRowMenu actions={actionsFor(l)} label={l.book.title} /> }
          ]}
        />
      )}
      {tab === "ready" && (
        <DataTable
          rows={ready.rows}
          rowKey={h => h.id}
          loading={ready.isLoading}
          error={ready.error}
          onRetry={() => void ready.refetch()}
          empty={<EmptyState title="No holds waiting at the desk" />}
          columns={[
            { key: "title", header: "Title", render: h => h.book.title },
            { key: "copy", header: "Copy", render: h => <span className="mono">{h.copy?.accessionNumber ?? "—"}</span> },
            { key: "pickupBy", header: "Collect by", render: h => <span className="nowrap">{formatDate(h.pickupBy)}</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 110,
              render: h =>
                h.copy &&
                can("library.loans.circulate") && (
                  <Button size="sm" variant="ghost" icon={<ScanBarcode />} onClick={() => onIssueHold(h.copy!.accessionNumber)}>
                    Issue
                  </Button>
                )
            }
          ]}
        />
      )}
      {tab === "fines" && (
        <DataTable
          rows={account?.loansWithFines}
          rowKey={l => l.loanId}
          loading={!account}
          onRowClick={l => setLoanId(l.loanId)}
          empty={<EmptyState title="No fines owed" />}
          columns={[
            { key: "title", header: "Title", render: l => l.title },
            { key: "accessionNumber", header: "Copy", render: l => <span className="mono">{l.accessionNumber}</span> },
            { key: "dueDate", header: "Due", render: l => <span className="nowrap">{formatDate(l.dueDate)}</span> },
            { key: "fineOutstanding", header: "Outstanding", align: "right", render: l => <strong className="num text-danger">{money(l.fineOutstanding)}</strong> }
          ]}
        />
      )}
      <LoanDrawer loanId={loanId} onClose={() => setLoanId(null)} />
      {dialogs}
    </Card>
  );
}
