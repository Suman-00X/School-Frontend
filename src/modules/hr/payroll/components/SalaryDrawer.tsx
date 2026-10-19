import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge, Button, DescriptionList, Drawer, EmptyState } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared/hooks/useMoney";
import { monthLabel, monthOf } from "../../shared/utils/format";
import { lineAmount, revisionTotals, type SalaryRevision } from "../api/payroll";
import { KindBadge } from "./SalaryBits";
import "../../shared/hr.css";

/* One employee's salary: the revision in force (or the one picked from the history), read-only.
   Revisions are never edited; "Revise" starts a new one prefilled from this one. */
export function SalaryDrawer({
  open,
  onClose,
  name,
  revisions,
  currentId,
  canManage,
  onRevise,
  onAdd
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  /* Newest first */
  revisions: SalaryRevision[];
  currentId: string | null;
  canManage: boolean;
  onRevise: (from: SalaryRevision) => void;
  onAdd: () => void;
}) {
  const money = useMoney();
  /* Give it a key per employee: the picked revision starts at the current one */
  const [picked, setShownId] = useState<string | null>(null);
  const shownId = picked ?? currentId ?? revisions[0]?.id ?? null;
  const shown = revisions.find(r => r.id === shownId) ?? null;
  const totals = shown && revisionTotals(shown.monthlyBasic, shown.lines.map(l => ({ kind: l.component.kind, calculation: l.component.calculation, value: l.value })));

  const footer = canManage ? (
    shown ? (
      <Button variant="primary" icon={<Pencil />} onClick={() => onRevise(shown)}>
        Revise
      </Button>
    ) : (
      <Button variant="primary" onClick={onAdd}>
        Add salary
      </Button>
    )
  ) : undefined;

  return (
    <Drawer open={open} onClose={onClose} wide title={name} subtitle={shown ? `Effective from ${monthLabel(monthOf(shown.effectiveFrom))}` : "No salary yet"} footer={footer}>
      {!shown ? (
        <EmptyState title="No salary yet" message="Payroll leaves this employee out until a salary is added." />
      ) : (
        <div className="stack">
          <table className="hr-lines">
            <tbody>
              <tr>
                <td>Basic</td>
                <td>{money(shown.monthlyBasic)}</td>
              </tr>
              {shown.lines.map(l => (
                <tr key={l.id}>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      {l.component.name}
                      <KindBadge kind={l.component.kind} />
                      {l.component.calculation === "PERCENT_OF_BASIC" && <span className="small muted">{l.value}% of basic</span>}
                    </span>
                  </td>
                  <td style={{ color: l.component.kind === "DEDUCTION" ? "var(--danger-text)" : undefined }}>
                    {l.component.kind === "DEDUCTION" ? "−" : ""}
                    {money(lineAmount(shown.monthlyBasic, l.component.calculation, l.value))}
                  </td>
                </tr>
              ))}
              <tr className="is-total">
                <td>Gross · deductions · net</td>
                <td>
                  {money(totals!.gross)} · {money(totals!.deductions)} · {money(totals!.net)}
                </td>
              </tr>
            </tbody>
          </table>
          <DescriptionList
            columns={3}
            items={[
              { label: "Bank account", value: shown.bankAccountNumber && <span className="mono">{shown.bankAccountNumber}</span> },
              { label: "IFSC", value: shown.bankIfsc && <span className="mono">{shown.bankIfsc}</span> },
              { label: "PAN", value: shown.panNumber && <span className="mono">{shown.panNumber}</span> },
              { label: "Notes", value: shown.notes, wide: true },
              { label: "Added", value: formatDateTime(shown.createdAt) }
            ]}
          />
          {revisions.length > 1 && (
            <div className="stack-sm">
              <div className="section-title">History</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Effective from</th>
                      <th className="align-right">Basic</th>
                      <th className="align-right">Net</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.map(r => {
                      const t = revisionTotals(r.monthlyBasic, r.lines.map(l => ({ kind: l.component.kind, calculation: l.component.calculation, value: l.value })));
                      return (
                        <tr key={r.id} className={`clickable${r.id === shownId ? " selected" : ""}`} onClick={() => setShownId(r.id)}>
                          <td>{formatDate(r.effectiveFrom)}</td>
                          <td className="align-right hr-num">{money(r.monthlyBasic)}</td>
                          <td className="align-right hr-num">{money(t.net)}</td>
                          <td className="align-right">
                            {r.id === currentId ? <Badge tone="success">Current</Badge> : r.effectiveFrom > (revisions.find(x => x.id === currentId)?.effectiveFrom ?? "") ? <Badge tone="info">Upcoming</Badge> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
