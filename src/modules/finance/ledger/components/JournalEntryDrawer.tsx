import { useState } from "react";
import { Link } from "react-router-dom";
import { Undo2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { Button, DataTable, DescriptionList, Drawer, ErrorState, SkeletonBlock, useToast } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared";
import { Amount } from "../../shared/components/FinanceStatus";
import { ReasonDialog } from "../../shared/components/ReasonDialog";
import { actorName, studentLabel } from "../../shared/api/records";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { reverseEntry, sourceLabel, useJournal, useJournalEntry, useLedgerMutation, type JournalEntry } from "../api/ledger";

/* Where an entry came from, as a link when the record has a page */
function sourceLink(e: Pick<JournalEntry, "sourceType" | "sourceId">) {
  switch (e.sourceType) {
    case "INVOICE":
      return OPS_PATHS.invoice(e.sourceId);
    case "PAYMENT":
      return OPS_PATHS.payment(e.sourceId);
    case "REFUND":
      return OPS_PATHS.refund(e.sourceId);
    case "SETTLEMENT":
      return OPS_PATHS.settlements;
    default:
      return null;
  }
}

/* FI-13 journal entry drawer: lines, source, and Reverse for manual entries */
export function JournalEntryDrawer({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const money = useMoney();
  const entry = useJournalEntry(entryId);
  const e = entry.data;
  /* A manual entry and its reversal share the source id: more than one entry means it was reversed */
  const siblings = useJournal({ sourceType: "MANUAL", sourceId: e?.sourceId, limit: 10 }, { enabled: !!e && e.sourceType === "MANUAL" });
  const reversal = siblings.rows?.find(s => s.reversalOfId === e?.id) ?? null;
  const original = e?.reversalOfId ? siblings.rows?.find(s => s.id === e.reversalOfId) : null;
  const [reversing, setReversing] = useState(false);
  const reverse = useLedgerMutation(reverseEntry);
  const canReverse = !!e && can("finance.ledger.post") && e.sourceType === "MANUAL" && !e.reversalOfId && !siblings.isLoading && !reversal;
  const link = e ? sourceLink(e) : null;

  return (
    <Drawer
      open={!!entryId}
      onClose={onClose}
      wide
      title={e ? e.entryNumber : "Journal entry"}
      subtitle={e ? `${formatDate(e.entryDate)} · ${money(e.total)}` : " "}
      footer={
        canReverse ? (
          <Button icon={<Undo2 />} onClick={() => setReversing(true)}>
            Reverse entry
          </Button>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {entry.error ? (
        <ErrorState error={entry.error} onRetry={() => void entry.refetch()} />
      ) : !e ? (
        <SkeletonBlock lines={8} />
      ) : (
        <div className="stack">
          <DescriptionList
            items={[
              { label: "Narration", value: e.narration, wide: true },
              { label: "Date", value: formatDate(e.entryDate) },
              { label: "Total", value: money(e.total) },
              { label: "Source", value: link ? <Link to={link}>{sourceLabel(e.sourceType)}</Link> : sourceLabel(e.sourceType) },
              { label: "Posted by", value: actorName(e.poster) || "Automatically" },
              { label: "Posted at", value: formatDateTime(e.createdAt) },
              {
                label: "Reversal of",
                value: e.reversalOfId && (original ? <Link to={OPS_PATHS.journalEntry(original.id)} className="mono">{original.entryNumber}</Link> : "an earlier entry"),
                hidden: !e.reversalOfId
              },
              {
                label: "Reversed by",
                value: reversal && (
                  <Link to={OPS_PATHS.journalEntry(reversal.id)} className="mono">
                    {reversal.entryNumber}
                  </Link>
                ),
                hidden: !reversal
              }
            ]}
          />
          <div className="table-shell">
            <DataTable
              rows={e.lines}
              rowKey={l => l.id}
              columns={[
                {
                  key: "account",
                  header: "Account",
                  render: l => (
                    <Link to={OPS_PATHS.account(l.accountId)}>
                      <span className="mono">{l.account.code}</span> {l.account.name}
                    </Link>
                  )
                },
                { key: "debit", header: "Debit", align: "right", render: l => <Amount value={l.debit} format={money} dashZero /> },
                { key: "credit", header: "Credit", align: "right", render: l => <Amount value={l.credit} format={money} dashZero /> },
                { key: "student", header: "Student", render: l => (l.student ? <Link to={OPS_PATHS.student(l.student.id)}>{studentLabel(l.student)}</Link> : <span className="muted">—</span>) },
                { key: "memo", header: "Memo", render: l => l.memo ?? <span className="muted">—</span> }
              ]}
            />
          </div>
          {e.sourceType !== "MANUAL" && (
            <p className="small muted">
              Posted automatically. To correct it, change the {sourceLabel(e.sourceType).toLowerCase()} itself (cancel the invoice, refund the payment).
            </p>
          )}
        </div>
      )}
      {e && (
        <ReasonDialog
          open={reversing}
          onClose={() => setReversing(false)}
          title={`Reverse ${e.entryNumber}?`}
          message="A mirror-image entry is posted, so the two cancel out. The original stays in the journal."
          label="Why is it reversed?"
          confirmLabel="Reverse entry"
          withDate
          dateLabel="Reversal date"
          dateHint="Empty: today"
          onSubmit={async ({ reason, date }) => {
            const res = await reverse.mutateAsync({ entryId: e.id, reason, date });
            toast.success(res.message);
          }}
        />
      )}
    </Drawer>
  );
}
