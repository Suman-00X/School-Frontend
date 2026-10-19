/* FI-13 · Income summary: fee income by fee head, late fees, concessions, other income, expenses and the surplus for a period */
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useListParams } from "@/common/hooks";
import { Card, ErrorState, PageHeader, SkeletonBlock, TextInput } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { useMoney } from "../../shared";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { useIncomeSummary } from "../api/ledger";

export default function IncomeSummaryPage() {
  const money = useMoney();
  const { selected } = useAcademicYear();
  const today = todayIso();
  /* Default period: the selected academic year, up to today */
  const defaultFrom = selected?.startDate ?? `${today.slice(0, 4)}-01-01`;
  const defaultTo = selected && selected.endDate < today ? selected.endDate : today;
  const { params, setParam } = useListParams({ from: defaultFrom, to: defaultTo });
  const from = params.from || defaultFrom;
  const to = params.to || defaultTo;
  const summary = useIncomeSummary(from, to);
  const s = summary.data;

  const amount = (n: number) => <span className={n < 0 ? "negative" : undefined}>{money(n)}</span>;

  return (
    <>
      <PageHeader title="Income summary" subtitle="What the school earned and spent in a period, from the books." />
      <Card flush>
        <div className="filter-bar">
          <TextInput label="From" type="date" className="input-sm" value={from} max={to} onChange={e => setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={to} min={from} onChange={e => setParam("to", e.target.value)} />
        </div>
        <div className="card-body">
          {from > to ? (
            <p className="muted">The start date must be on or before the end date.</p>
          ) : summary.error ? (
            <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
          ) : !s ? (
            <SkeletonBlock lines={10} />
          ) : (
            <div className="statement" style={{ maxWidth: 640 }}>
              <span className="section-head">
                Income · {formatDate(s.from)} to {formatDate(s.to)}
              </span>
              {s.feeIncome.byFeeHead.map(a => (
                <Fragment key={a.accountId}>
                  <span className="indent">
                    <Link to={OPS_PATHS.account(a.accountId)}>{a.name.replace(/^Fee income – /, "")}</Link>
                  </span>
                  <span>{amount(a.amount)}</span>
                </Fragment>
              ))}
              <span className="subtotal">Fee income</span>
              <span className="subtotal">{amount(s.feeIncome.total)}</span>
              <span>Late fees</span>
              <span>{amount(s.lateFees)}</span>
              <span>Concessions</span>
              <span>{amount(s.concessions)}</span>
              {s.otherIncome.accounts.map(a => (
                <Fragment key={a.accountId}>
                  <span className="indent">
                    <Link to={OPS_PATHS.account(a.accountId)}>{a.name}</Link>
                  </span>
                  <span>{amount(a.amount)}</span>
                </Fragment>
              ))}
              <span>Other income</span>
              <span>{amount(s.otherIncome.total)}</span>
              <span className="grand">Net income</span>
              <span className="grand">{amount(s.netIncome)}</span>

              <span className="section-head">Expenses</span>
              {s.expenses.accounts.map(a => (
                <Fragment key={a.accountId}>
                  <span className="indent">
                    <Link to={OPS_PATHS.account(a.accountId)}>{a.name}</Link>
                  </span>
                  <span>{amount(a.amount)}</span>
                </Fragment>
              ))}
              {s.expenses.accounts.length === 0 && (
                <>
                  <span className="indent muted">No expenses posted</span>
                  <span />
                </>
              )}
              <span className="subtotal">Expenses</span>
              <span className="subtotal">{amount(s.expenses.total)}</span>

              <span className="grand">{s.surplus >= 0 ? "Surplus" : "Deficit"}</span>
              <span className="grand">{amount(s.surplus)}</span>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
