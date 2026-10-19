import { useState } from "react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { Card, DataTable, EmptyState, ErrorState, Kpi, Select, SkeletonBlock, StatusBadge } from "@/common/ui";
import { enumLabel, formatDate, formatDateTime, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { useStatement } from "../api/records";
import { useHideOnForbidden } from "./useHideOnForbidden";

/* Read-only fee statement for one year (FI-11 has the full account) */
export function FeesTab({ studentId, onForbidden }: { studentId: string; onForbidden?: () => void }) {
  const { years, selected } = useAcademicYear();
  const [yearId, setYearId] = useState(selected?.id ?? "");
  const statement = useStatement(studentId, yearId);
  const currency = useSchoolCurrency();
  const money = (n: number) => formatMoney(n, currency);
  useHideOnForbidden(statement.error, onForbidden);

  const s = statement.data;
  return (
    <div className="stack">
      <div className="row-between">
        {years.length > 0 ? (
          <Select
            className="select-sm"
            aria-label="Academic year"
            style={{ width: "auto" }}
            value={yearId || s?.academicYearId || ""}
            options={years.map(y => ({ value: y.id, label: y.yearName + (y.isCurrent ? " (current)" : "") }))}
            onChange={e => setYearId(e.target.value)}
          />
        ) : (
          <span />
        )}
      </div>
      {statement.isLoading && <SkeletonBlock lines={6} />}
      {statement.error && <ErrorState error={statement.error} onRetry={() => void statement.refetch()} />}
      {s && (
        <>
          <div className="kpis">
            <Kpi label="Billed" value={money(s.totals.billed)} hint={s.totals.concessions ? `${money(s.totals.concessions)} concessions` : undefined} />
            <Kpi label="Paid" value={money(s.totals.paid)} hint={s.totals.refunded ? `${money(s.totals.refunded)} refunded` : undefined} />
            <Kpi label="Balance" value={money(s.totals.balance)} />
            <Kpi label="Overdue" value={money(s.totals.overdue)} />
            <Kpi label="Credit" value={money(s.credit.balance)} />
          </div>
          {(s.installmentPlan || s.concessions.length > 0) && (
            <div className="small muted">
              {s.installmentPlan && `Installment plan: ${s.installmentPlan.name}. `}
              {s.concessions.length > 0 && `Concessions: ${s.concessions.map(c => c.name).join(", ")}.`}
            </div>
          )}
          <Card flush title="Invoices">
            <DataTable
              rows={s.invoices}
              rowKey={i => i.id}
              columns={[
                { key: "invoiceNumber", header: "Invoice", render: i => <span className="mono">{i.invoiceNumber}</span> },
                { key: "dueDate", header: "Due", render: i => formatDate(i.dueDate) },
                { key: "total", header: "Total", align: "right", render: i => money(i.total) },
                { key: "amountPaid", header: "Paid", align: "right", render: i => money(i.amountPaid) },
                { key: "balance", header: "Balance", align: "right", render: i => money(i.balance) },
                { key: "status", header: "Status", render: i => <StatusBadge status={i.status === "PARTIALLY_PAID" ? "PARTIAL" : i.status} label={enumLabel(i.status)} /> }
              ]}
              empty={<EmptyState title="No invoices this year." />}
            />
          </Card>
          <div className="grid-2">
            <Card flush title="Payments">
              <DataTable
                rows={s.payments}
                rowKey={p => p.id}
                columns={[
                  { key: "receiptNumber", header: "Receipt", render: p => (p.receiptNumber ? <span className="mono">{p.receiptNumber}</span> : <span className="muted">—</span>) },
                  { key: "paidAt", header: "Date", render: p => formatDateTime(p.paidAt ?? p.createdAt) },
                  { key: "method", header: "Method", render: p => enumLabel(p.method) },
                  { key: "amount", header: "Amount", align: "right", render: p => money(p.amount) },
                  { key: "status", header: "", render: p => (p.status === "SUCCEEDED" ? null : <StatusBadge status={p.status} />) }
                ]}
                empty={<EmptyState title="No payments." />}
              />
            </Card>
            <Card flush title="Refunds">
              <DataTable
                rows={s.refunds}
                rowKey={r => r.id}
                columns={[
                  { key: "refundNumber", header: "Refund", render: r => (r.refundNumber ? <span className="mono">{r.refundNumber}</span> : <span className="muted">—</span>) },
                  { key: "createdAt", header: "Date", render: r => formatDate(r.createdAt) },
                  { key: "amount", header: "Amount", align: "right", render: r => money(r.amount) },
                  { key: "status", header: "Status", render: r => <StatusBadge status={r.status} /> }
                ]}
                empty={<EmptyState title="No refunds." />}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
