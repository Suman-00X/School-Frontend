import type { ReactNode } from "react";
import { Avatar, Card } from "@/common/ui";

/* The header card of a person's page (the name is in the drill-in header above it):
   avatar, key facts (codes, role, status), contact line and the record's actions.
   It has one height whether loading or loaded: the avatar sets it, and the lines are single. */
export function RecordHeader({
  name,
  photo,
  facts,
  contact,
  actions,
  loading
}: {
  name: string;
  photo?: string | null;
  facts?: ReactNode;
  contact?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card>
      <div className="row-between" style={{ alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 16, flexWrap: "nowrap", minWidth: 0, flex: 1 }}>
          <Avatar name={loading ? "" : name} src={photo} size="lg" />
          <div className="stack-sm" style={{ minWidth: 0, gap: 6 }}>
            <div className="row" style={{ gap: 8, minHeight: 22, flexWrap: "nowrap", overflow: "hidden" }}>
              {loading ? <InlineSkeleton width={180} /> : facts}
            </div>
            <div className="row small muted" style={{ gap: 14, minHeight: 20, flexWrap: "nowrap", overflow: "hidden", whiteSpace: "nowrap" }}>
              {loading ? <InlineSkeleton width={240} /> : contact}
            </div>
          </div>
        </div>
        {/* Actions depend on permissions only, so they are present while the record loads */}
        {actions && <div className="row">{actions}</div>}
      </div>
    </Card>
  );
}

/* A grey bar that sits in a line of text */
export function InlineSkeleton({ width, height = 14 }: { width: number | string; height?: number }) {
  return <span className="skeleton" style={{ display: "inline-block", width, height, verticalAlign: "middle" }} />;
}

/* The drill-in header title for a record: a fixed width, so the header's tabs don't move when
   the name arrives (or between people); long names are cut with an ellipsis. */
export function DrillName({ name }: { name?: string }) {
  return (
    <span
      title={name}
      style={{
        display: "inline-block",
        width: "min(240px, 40vw)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        verticalAlign: "bottom"
      }}
    >
      {name || <InlineSkeleton width={140} height={16} />}
    </span>
  );
}
