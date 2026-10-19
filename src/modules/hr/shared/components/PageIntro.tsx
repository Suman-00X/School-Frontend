import type { ReactNode } from "react";

/* The top of a page whose name is already the active header tab: a one-line description and
   the page's actions, no title. Always the height of a button, with or without actions.
   (Same as academics' PageIntro; modules don't import each other's shared code.) */
export function PageIntro({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="row-between" style={{ minHeight: 34, flexWrap: "nowrap" }}>
      <p
        className="muted"
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={typeof children === "string" ? children : undefined}
      >
        {children}
      </p>
      {actions && <div className="row" style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
