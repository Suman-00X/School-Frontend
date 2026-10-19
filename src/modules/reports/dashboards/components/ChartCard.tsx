import { useState, type ReactNode } from "react";
import { CalendarX, ChartColumn, Table2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "@/common/ui";
import "./dashboards.css";

/* A chart in a card, with a "Table" toggle that swaps the chart for the same numbers as a table
   (in the same place and at least the same height). */
export function ChartCard({
  title,
  subtitle,
  chart,
  table,
  minHeight = 260,
  legend,
  loading
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  chart: ReactNode;
  table?: ReactNode;
  minHeight?: number;
  /* Above the chart, hidden in table view */
  legend?: ReactNode;
  loading?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card
      title={title}
      subtitle={subtitle}
      className="chart-card"
      actions={
        table && (
          <Button size="sm" variant="ghost" icon={asTable ? <ChartColumn /> : <Table2 />} onClick={() => setAsTable(t => !t)} aria-pressed={asTable}>
            {asTable ? "Chart" : "Table"}
          </Button>
        )
      }
    >
      <div className="chart-card-body" style={{ minHeight }}>
        {loading ? (
          <div className="chart-card-loading" style={{ height: minHeight }}>
            <Skeleton height={minHeight - 40} />
          </div>
        ) : asTable && table ? (
          <div className="chart-card-table">{table}</div>
        ) : (
          <div className="stack-sm">
            {legend}
            {chart}
          </div>
        )}
      </div>
    </Card>
  );
}

/* A dashboard's own failure states: no academic year (422) gets a notice that links to setup */
export function DashboardError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error) && error.status === 422)
    return (
      <Card>
        <EmptyState
          icon={<CalendarX />}
          title="No academic year for this report"
          message="Reports cover one academic year. Set up the school year first, or pick another year in the header."
          actions={<ButtonLink to="/academics/academic-years">Academic years</ButtonLink>}
        />
      </Card>
    );
  return (
    <Card>
      <ErrorState error={error} onRetry={onRetry} />
    </Card>
  );
}

/* A small plain table for a chart's "Table" view */
export function MiniTable({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className={i > 0 ? "align-right" : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j > 0 ? "align-right nums" : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
