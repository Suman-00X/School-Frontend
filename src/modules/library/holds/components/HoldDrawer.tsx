import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanBarcode, X } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Button, ButtonLink, DescriptionList, Drawer, ErrorState, RoleBadge, SkeletonBlock } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import type { Hold } from "../../shared/api/types";
import { HoldStatusBadge } from "../../shared/components/LibraryBits";
import { ordinal } from "../../shared/utils/labels";
import { useHold } from "../api/holds";
import { CancelHoldDialog } from "./HoldDialogs";

/* The desk link that issues a ready hold: borrower and copy filled in */
export const issueLink = (h: Pick<Hold, "borrowerUserId" | "copy">) =>
  `/library/desk?borrower=${h.borrowerUserId}${h.copy ? `&copy=${encodeURIComponent(h.copy.accessionNumber)}` : ""}`;

/* LB-06 hold drawer */
export function HoldDrawer({ holdId, onClose }: { holdId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const q = useHold(holdId);
  const [cancelling, setCancelling] = useState<Hold | null>(null);
  const h = q.data;
  const open = h && (h.status === "WAITING" || h.status === "READY");

  return (
    <>
      <Drawer
        open={!!holdId}
        onClose={onClose}
        title={h ? h.book.title : "Hold"}
        subtitle={h && <HoldStatusBadge status={h.status} />}
        footer={
          h && open && (can("library.holds.manage") || (h.status === "READY" && can("library.loans.circulate"))) ? (
            <>
              {can("library.holds.manage") && (
                <Button icon={<X />} onClick={() => setCancelling(h)}>
                  Cancel hold
                </Button>
              )}
              {h.status === "READY" && can("library.loans.circulate") && (
                <ButtonLink variant="primary" icon={<ScanBarcode />} to={issueLink(h)}>
                  Issue
                </ButtonLink>
              )}
            </>
          ) : undefined
        }
      >
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !h ? (
          <SkeletonBlock lines={8} />
        ) : (
          <DescriptionList
            columns={2}
            items={[
              {
                label: "For",
                value: (
                  <span className="row" style={{ gap: 6 }}>
                    {can("library.loans.read") ? (
                      <Link to={`/library/borrowers/${h.borrowerUserId}`} onClick={onClose}>
                        {h.borrower.name}
                      </Link>
                    ) : (
                      h.borrower.name
                    )}
                    <RoleBadge role={h.borrower.role} />
                  </span>
                )
              },
              { label: "Authors", value: h.book.authors.join(", ") },
              { label: "Requested", value: formatDateTime(h.requestedAt) },
              { label: "Not needed after", value: formatDate(h.notNeededAfter) },
              { label: "Place in the queue", value: h.queuePosition ? ordinal(h.queuePosition) : null, hidden: h.status !== "WAITING" },
              { label: "Copy kept", value: h.copy && <span className="mono">{h.copy.accessionNumber}</span>, hidden: !h.copy },
              { label: "Ready since", value: formatDate(h.readyOn), hidden: !h.readyOn },
              { label: "Collect by", value: formatDate(h.pickupBy), hidden: !h.pickupBy },
              { label: "Closed", value: formatDateTime(h.closedAt), hidden: !h.closedAt },
              { label: "Why", value: h.closedReason, hidden: !h.closedReason },
              {
                label: "Loan",
                value: h.fulfilledLoanId && <Link to={`/library/loans/${h.fulfilledLoanId}`}>Open the loan</Link>,
                hidden: !h.fulfilledLoanId || !can("library.loans.read")
              }
            ]}
          />
        )}
      </Drawer>
      <CancelHoldDialog hold={cancelling} onClose={() => setCancelling(null)} />
    </>
  );
}
