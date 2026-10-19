import { Link } from "react-router-dom";
import type { ListMeta } from "@/common/api";
import { DataTable, type Column } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import type { ReactNode } from "react";
import { useMoney } from "../../shared/hooks/useMoney";
import { personName, qty } from "../../shared/utils/format";
import { counterparty, type Movement } from "../api/stock";
import { Change, MovementTypeBadge } from "./MovementBits";

/* The stock ledger (IN-04 across items, IN-03 for one item: withItem = false) */
export function LedgerTable({
  rows,
  meta,
  loading,
  error,
  onRetry,
  onPageChange,
  onRowClick,
  withItem = true,
  empty
}: {
  rows: Movement[] | undefined;
  meta?: ListMeta;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (m: Movement) => void;
  withItem?: boolean;
  empty?: ReactNode;
}) {
  const money = useMoney();
  const columns: Column<Movement>[] = [
    { key: "number", header: "Number", render: m => <span className="mono small nowrap">{m.movementNumber}</span> },
    { key: "date", header: "Date", render: m => <span className="nowrap">{formatDate(m.movementDate)}</span> },
    { key: "type", header: "Type", render: m => <MovementTypeBadge type={m.type} /> },
    ...(withItem
      ? [
          {
            key: "item",
            header: "Item",
            render: (m: Movement) =>
              m.item ? (
                <Link to={`/inventory/items/${m.item.id}`} onClick={e => e.stopPropagation()}>
                  <span className="in-cut" title={m.item.name}>
                    {m.item.name}
                  </span>
                  <div className="mono small muted">{m.item.sku}</div>
                </Link>
              ) : (
                <span className="muted">—</span>
              )
          }
        ]
      : []),
    { key: "change", header: "Change", align: "right", render: m => <Change value={m.quantityChange} unit={m.item?.unit} /> },
    { key: "balance", header: "Balance after", align: "right", render: m => <span className="in-num">{qty(m.balanceAfter, m.item?.unit)}</span> },
    { key: "cost", header: "Unit cost", align: "right", render: m => <span className="in-num">{money(m.unitCost)}</span> },
    { key: "value", header: "Value", align: "right", render: m => <span className="in-num">{money(m.totalValue)}</span> },
    ...(!withItem ? [{ key: "avg", header: "Avg cost after", align: "right" as const, render: (m: Movement) => <span className="in-num">{money(m.averageCostAfter)}</span> }] : []),
    { key: "who", header: "Vendor / issued to", render: m => <span className="in-cut" title={counterparty(m) ?? undefined}>{counterparty(m) || <span className="muted">—</span>}</span> },
    {
      key: "reason",
      header: "Reason / reference",
      render: m => {
        const text = [m.reason, m.reference].filter(Boolean).join(" · ");
        return text ? (
          <span className="in-cut muted" title={text}>
            {text}
          </span>
        ) : (
          <span className="muted">—</span>
        );
      }
    },
    { key: "by", header: "By", render: m => <span className="nowrap small">{personName(m.creator) || "—"}</span> }
  ];
  return (
    <DataTable
      rows={rows}
      rowKey={m => m.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      meta={meta}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      columns={columns}
      empty={empty}
    />
  );
}
