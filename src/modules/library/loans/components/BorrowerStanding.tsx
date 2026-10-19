import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { BorrowerAccount } from "../../shared/api/types";
import { StatChips } from "../../shared/components/LibraryBits";
import { useMoney } from "../../shared/hooks/useLibraryLookups";

/* KPI chips of a borrower's account (On loan, Overdue, Fines, Credit) */
export function AccountChips({ account }: { account: BorrowerAccount | undefined }) {
  const money = useMoney();
  const a = account;
  return (
    <StatChips
      items={[
        { label: "On loan", value: a ? a.openLoans : "–" },
        { label: "Overdue", value: a ? a.overdueLoans : "–", tone: a?.overdueLoans ? "danger" : undefined },
        { label: "Fines", value: a ? money(a.finesOutstanding) : "–", tone: a?.finesOutstanding ? "warning" : undefined },
        { label: "Credit", value: a ? money(a.credit) : "–", tone: a?.credit ? "success" : undefined }
      ]}
    />
  );
}

/* Whether the borrower may borrow now: the block messages in red, else one quiet line */
export function StandingBox({ account }: { account: BorrowerAccount | undefined }) {
  if (!account) return <div className="lib-standing" />;
  if (account.canBorrow)
    return (
      <div className="lib-standing row" style={{ gap: 8 }}>
        <ShieldCheck size={16} className="text-success" />
        {account.borrower.status === "ACTIVE" ? "Can borrow" : `Account ${account.borrower.status.toLowerCase()}: cannot borrow`}
      </div>
    );
  return (
    <div className="lib-standing is-blocked" role="alert">
      <div className="row" style={{ gap: 8, fontWeight: 600 }}>
        <ShieldAlert size={16} /> Can't borrow right now
      </div>
      <ul>
        {account.blocks.map(b => (
          <li key={b.reason}>{b.message}</li>
        ))}
      </ul>
    </div>
  );
}
