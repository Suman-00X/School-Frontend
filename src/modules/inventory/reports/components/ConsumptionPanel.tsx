import { Link } from "react-router-dom";
import { useAuth } from "@/common/auth";
import { useApiGet, useListParams } from "@/common/hooks";
import { BarList, Card, DataTable, EmptyState, StatTile, StatTiles, TextInput } from "@/common/ui";
import { todayIso } from "@/common/utils/format";
import { useMoney } from "../../shared/hooks/useMoney";
import { qty } from "../../shared/utils/format";
import { REPORTS_PATH, type Consumption } from "../api/reports";
import { ExportButtons } from "./ExportButtons";

/* IN-05 Consumption: what was issued and returned between two dates (default: this month) */
export function ConsumptionPanel() {
  const { can } = useAuth();
  const money = useMoney();
  const today = todayIso();
  const { params, setParam } = useListParams({ from: `${today.slice(0, 7)}-01`, to: today });
  const bad = params.to < params.from;
  const report = useApiGet<Consumption>(bad ? null : `${REPORTS_PATH}/consumption`, { from: params.from, to: params.to });
  const d = report.data;
  const top = [...(d?.items ?? [])].sort((a, b) => b.netValue - a.netValue).slice(0, 10);
  const pair = (q: number, v: number, unit: string) => (
    <span className="in-num">
      {qty(q, unit)} <span className="muted">· {money(v)}</span>
    </span>
  );

  return (
    <div className="stack">
      <Card flush>
        <div className="filter-bar">
          <TextInput label="From" type="date" className="input-sm" value={params.from} max={params.to} onChange={e => e.target.value && setParam("from", e.target.value)} />
          <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from} onChange={e => e.target.value && setParam("to", e.target.value)} />
          <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
            <ExportButtons report="consumption" query={{ from: params.from, to: params.to }} disabled={bad} />
          </div>
        </div>
      </Card>
      <StatTiles>
        <StatTile label="Issued" value={d && money(d.totals.issuedValue)} hint="At average cost when issued" loading={!d && !bad} />
        <StatTile label="Returned" value={d && money(d.totals.returnedValue)} hint="Taken back into the store" loading={!d && !bad} />
        <StatTile label="Net used" value={d && money(d.totals.netValue)} hint="Issued minus returned" loading={!d && !bad} />
      </StatTiles>
      <Card title="Top 10 by net value used">
        {d ? (
          <BarList
            ariaLabel="Top items by net value used"
            formatValue={money}
            items={top.map(r => ({ key: r.id, label: r.name, value: r.netValue, to: can("inventory.items.read") ? `/inventory/items/${r.id}` : undefined }))}
            empty="Nothing was issued in this range"
          />
        ) : (
          <div style={{ height: 120 }} className={bad ? undefined : "skeleton"}>
            {bad && <span className="small muted">The end date is before the start.</span>}
          </div>
        )}
      </Card>
      <Card flush>
        <DataTable
          rows={bad ? [] : d?.items}
          rowKey={r => r.id}
          loading={report.isLoading}
          error={report.error}
          onRetry={() => void report.refetch()}
          empty={<EmptyState title={bad ? "Pick a valid range" : "Nothing was issued or returned in this range"} />}
          columns={[
            { key: "sku", header: "SKU", render: r => <span className="mono small nowrap">{r.sku}</span> },
            { key: "name", header: "Item", render: r => (can("inventory.items.read") ? <Link to={`/inventory/items/${r.id}`}>{r.name}</Link> : r.name) },
            { key: "category", header: "Category", render: r => r.categoryName ?? <span className="muted">—</span> },
            { key: "unit", header: "Unit", render: r => <span className="mono small">{r.unit}</span> },
            { key: "issued", header: "Issued", align: "right", render: r => pair(r.issuedQuantity, r.issuedValue, "") },
            { key: "returned", header: "Returned", align: "right", render: r => pair(r.returnedQuantity, r.returnedValue, "") },
            { key: "net", header: "Net", align: "right", render: r => <strong>{pair(r.netQuantity, r.netValue, "")}</strong> }
          ]}
        />
      </Card>
    </div>
  );
}
