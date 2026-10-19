import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ListMeta } from "@/common/api";
import { Button } from "./Button";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./Feedback";
import { Skeleton } from "./Spinner";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  className?: string;
};

export type Selection = {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /* Rows that can't be selected */
  isSelectable?: (id: string) => boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  selection,
  bulkActions,
  meta,
  onPageChange
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selection?: Selection;
  /* Shown in a bar above the table while rows are selected */
  bulkActions?: ReactNode;
  meta?: ListMeta;
  onPageChange?: (page: number) => void;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  const list = rows ?? [];
  const selectable = selection ? list.map(rowKey).filter(id => selection.isSelectable?.(id) ?? true) : [];
  const allChecked = !!selection && selectable.length > 0 && selectable.every(id => selection.selected.has(id));

  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allChecked) selectable.forEach(id => next.delete(id));
    else selectable.forEach(id => next.add(id));
    selection.onChange(next);
  };
  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  return (
    <div className="table-shell">
      {selection && selection.selected.size > 0 && (
        <div className="bulk-bar" role="toolbar" aria-label="Selected rows">
          <span className="row" style={{ gap: 10 }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all rows" />
            {selection.selected.size} selected
          </span>
          <div className="row">
            {bulkActions}
            <Button size="sm" variant="ghost" onClick={() => selection.onChange(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {selection && (
                <th className="cell-check">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all rows" disabled={!selectable.length} />
                </th>
              )}
              {columns.map(c => (
                <th key={c.key} className={c.align ? `align-${c.align}` : undefined} style={{ width: c.width }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {selection && <td className="cell-check" />}
                    {columns.map(c => (
                      <td key={c.key}>
                        <Skeleton width="70%" />
                      </td>
                    ))}
                  </tr>
                ))
              : list.map(row => {
                  const id = rowKey(row);
                  const checked = !!selection?.selected.has(id);
                  return (
                    <tr
                      key={id}
                      className={[onRowClick && "clickable", checked && "selected"].filter(Boolean).join(" ") || undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selection && (
                        <td className="cell-check" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={selection.isSelectable ? !selection.isSelectable(id) : false}
                            onChange={() => toggle(id)}
                            aria-label="Select row"
                          />
                        </td>
                      )}
                      {columns.map(c => (
                        <td key={c.key} className={[c.align && `align-${c.align}`, c.className].filter(Boolean).join(" ") || undefined}>
                          {c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as ReactNode) ?? <span className="muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {!loading && list.length === 0 && <div className="table-empty">{empty ?? <EmptyState title="Nothing here yet" />}</div>}
      {meta && onPageChange && meta.total > 0 && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: ListMeta; onPageChange: (page: number) => void }) {
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="table-footer">
      <span>
        {from}–{to} of {meta.total}
      </span>
      <div className="row">
        <Button size="sm" icon={<ChevronLeft />} disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page" />
        <span>
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </span>
        <Button size="sm" icon={<ChevronRight />} disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page" />
      </div>
    </div>
  );
}
