import type { ReactNode } from "react";

export type DLItem = { label: ReactNode; value: ReactNode; hidden?: boolean; wide?: boolean };

const empty = <span className="muted">—</span>;

export function DescriptionList({ items, columns = 2 }: { items: DLItem[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={`dl${columns === 1 ? " dl-1" : columns === 3 ? " dl-3" : ""}`}>
      {items
        .filter(i => !i.hidden)
        .map((i, idx) => (
          <div key={idx} className={i.wide ? "span-2" : undefined}>
            <dt>{i.label}</dt>
            <dd>{i.value === null || i.value === undefined || i.value === "" ? empty : i.value}</dd>
          </div>
        ))}
    </dl>
  );
}
