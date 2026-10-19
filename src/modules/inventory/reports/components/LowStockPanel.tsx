import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, PackageCheck } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { Item } from "../../items/api/items";
import { useMoney } from "../../shared/hooks/useMoney";
import { qty, type Unit } from "../../shared/utils/format";
import { MovementDrawer } from "../../stock/components/MovementDrawer";
import { useAllVendors } from "../../vendors/api/vendors";
import { REPORTS_PATH, type LowStock, type LowStockRow } from "../api/reports";
import { ExportButtons } from "./ExportButtons";

/* IN-05 Low stock: items at or below their reorder level, largest shortfall first */
export function LowStockPanel() {
  const { can } = useAuth();
  const money = useMoney();
  const report = useApiGet<LowStock>(`${REPORTS_PATH}/low-stock`);
  const vendors = useAllVendors(can("inventory.vendors.read") && can("inventory.stock.move"));
  const [receiving, setReceiving] = useState<LowStockRow | null>(null);
  const rows = [...(report.data?.items ?? [])].sort((a, b) => b.shortfall - a.shortfall);

  /* The receipt form needs the item's stock facts; the report row has them (discontinued items are never listed) */
  const asItem = (r: LowStockRow) =>
    ({ id: r.id, sku: r.sku, name: r.name, unit: r.unit as Unit, stockOnHand: r.stockOnHand, averageUnitCost: r.averageUnitCost, reorderLevel: r.reorderLevel, discontinued: false }) as Item;

  return (
    <Card flush>
      <div className="filter-bar">
        <span className="small muted" style={{ alignSelf: "center" }}>
          {report.data ? `As of ${formatDate(report.data.asOf)} · ${rows.length} item${rows.length === 1 ? "" : "s"}` : " "}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <ExportButtons report="low-stock" />
        </div>
      </div>
      <DataTable
        rows={report.data ? rows : undefined}
        rowKey={r => r.id}
        loading={report.isLoading}
        error={report.error}
        onRetry={() => void report.refetch()}
        empty={<EmptyState icon={<PackageCheck />} title="All items are above their reorder level" />}
        columns={[
          { key: "sku", header: "SKU", render: r => <span className="mono small nowrap">{r.sku}</span> },
          { key: "name", header: "Item", render: r => (can("inventory.items.read") ? <Link to={`/inventory/items/${r.id}`}>{r.name}</Link> : r.name) },
          { key: "category", header: "Category", render: r => r.categoryName ?? <span className="muted">—</span> },
          { key: "stock", header: "In stock", align: "right", render: r => <strong className="in-num" style={{ color: "var(--danger-text)" }}>{qty(r.stockOnHand, r.unit)}</strong> },
          { key: "reorder", header: "Reorder at", align: "right", render: r => <span className="in-num">{qty(r.reorderLevel, r.unit)}</span> },
          { key: "shortfall", header: "Shortfall", align: "right", render: r => <strong className="in-num">{qty(r.shortfall, r.unit)}</strong> },
          { key: "vendor", header: "Last vendor", render: r => r.lastVendor ?? <span className="muted">—</span> },
          { key: "cost", header: "Last unit cost", align: "right", render: r => (r.lastUnitCost !== null ? <span className="in-num">{money(r.lastUnitCost)}</span> : <span className="muted">—</span>) },
          { key: "received", header: "Last received", render: r => (r.lastReceivedOn ? <span className="nowrap">{formatDate(r.lastReceivedOn)}</span> : <span className="muted">Never</span>) },
          { key: "location", header: "Location", render: r => (r.location ? <span className="in-cut small">{r.location}</span> : <span className="muted">—</span>) },
          {
            key: "receive",
            header: "",
            align: "right",
            render: r =>
              can("inventory.stock.move") && (
                <Button size="sm" icon={<ArrowDownToLine />} onClick={() => setReceiving(r)}>
                  Receive
                </Button>
              )
          }
        ]}
      />
      <MovementDrawer
        open={!!receiving}
        preset={
          receiving
            ? {
                item: asItem(receiving),
                type: "RECEIPT",
                vendorId: vendors.data?.find(v => v.name === receiving.lastVendor)?.id,
                unitCost: receiving.lastUnitCost ?? undefined
              }
            : undefined
        }
        onClose={() => setReceiving(null)}
      />
    </Card>
  );
}
