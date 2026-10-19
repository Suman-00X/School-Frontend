import { useApiGet } from "@/common/hooks";
import { BarList, Card, DataTable, EmptyState, ErrorState, StatTile, StatTiles } from "@/common/ui";
import { formatDate, formatMoney } from "@/common/utils/format";
import { REPORTS_PATH, type Valuation, type ValuationRow } from "../api/reports";
import { ExportButtons } from "./ExportButtons";

const TOTAL = "__total";

/* IN-05 Valuation: stock value by category, at average cost */
export function ValuationPanel() {
  const report = useApiGet<Valuation>(`${REPORTS_PATH}/valuation`);
  const d = report.data;
  /* The report names its own currency */
  const money = (n: number) => formatMoney(n, d?.currency ?? "INR");
  if (report.error) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  const rows: ValuationRow[] | undefined = d && [
    ...d.categories,
    { categoryId: TOTAL, categoryName: "Total", itemCount: d.itemCount, itemsInStock: d.categories.reduce((a, c) => a + c.itemsInStock, 0), stockValue: d.totalValue }
  ];
  const strong = (r: ValuationRow, v: string | number) => (r.categoryId === TOTAL ? <strong className="in-num">{v}</strong> : <span className="in-num">{v}</span>);

  return (
    <div className="stack">
      <StatTiles>
        <StatTile label="Total stock value" value={d && money(d.totalValue)} hint={d ? `At average cost, as of ${formatDate(d.asOf)}` : undefined} loading={!d} />
        <StatTile label="Items" value={d?.itemCount} hint={d ? `${d.categories.length} categor${d.categories.length === 1 ? "y" : "ies"}` : undefined} loading={!d} />
      </StatTiles>
      <Card title="Stock value by category" actions={<ExportButtons report="valuation" disabled={!d} />}>
        {d ? (
          <BarList
            ariaLabel="Stock value by category"
            formatValue={money}
            items={[...d.categories].sort((a, b) => b.stockValue - a.stockValue).map(c => ({ key: c.categoryId, label: c.categoryName, value: c.stockValue, to: `/inventory/items?categoryId=${c.categoryId}` }))}
            empty="No categories yet"
          />
        ) : (
          <div style={{ height: 120 }} className="skeleton" />
        )}
      </Card>
      <Card flush>
        <DataTable
          rows={rows}
          rowKey={r => r.categoryId}
          loading={report.isLoading}
          empty={<EmptyState title="No categories yet" />}
          columns={[
            { key: "name", header: "Category", render: r => (r.categoryId === TOTAL ? <strong>Total</strong> : r.categoryName) },
            { key: "items", header: "Items", align: "right", render: r => strong(r, r.itemCount) },
            { key: "inStock", header: "Items in stock", align: "right", render: r => strong(r, r.itemsInStock) },
            { key: "value", header: "Stock value", align: "right", render: r => strong(r, money(r.stockValue)) }
          ]}
        />
      </Card>
    </div>
  );
}
