import type { ReactNode } from "react";
import { CheckCheck, Clock } from "lucide-react";
import type { ListMeta } from "@/common/api";
import { Badge, EmptyState, Kpi, Pagination, SkeletonBlock, roleLabel } from "@/common/ui";
import { formatDate, formatDateTime } from "@/common/utils/format";
import { KIND_OF, REMARK_KINDS, categoryLabel, type BehaviourRemark, type BehaviourSummary, type RemarkPerson } from "../api/behaviour";
import "./behaviour.css";

const personName = (p: RemarkPerson | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "Someone");

/* The log book: one entry per remark, newest first, coloured by kind. Shared by the student
   profile (staff) and the portal (student, parents); `actions` adds per-entry buttons. */
export function BehaviourLog({
  rows,
  loading,
  meta,
  onPageChange,
  empty,
  actions,
  showStudent
}: {
  rows: BehaviourRemark[] | undefined;
  loading?: boolean;
  meta?: ListMeta;
  onPageChange?: (page: number) => void;
  empty: ReactNode;
  actions?: (remark: BehaviourRemark) => ReactNode;
  showStudent?: boolean;
}) {
  if (loading && !rows) return <SkeletonBlock lines={6} />;
  if (!rows?.length) return <>{empty}</>;
  return (
    <div className="stack">
      <ol className="bh-log">
        {rows.map(r => {
          const kind = KIND_OF[r.kind];
          return (
            <li key={r.id} className={`bh-entry bh-${kind.tone}`}>
              <div className="bh-entry-head">
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <Badge tone={kind.tone}>{kind.label}</Badge>
                  <span className="bh-category">{categoryLabel(r.category)}</span>
                  <span className="muted small nowrap">{formatDate(r.occurredOn)}</span>
                  {showStudent && r.student && (
                    <span className="small nowrap">
                      · {r.student.user.firstName} {r.student.user.lastName}
                    </span>
                  )}
                </div>
                {actions && <div className="row" style={{ gap: 4, flexShrink: 0 }}>{actions(r)}</div>}
              </div>
              <p className="bh-remark">{r.remark}</p>
              {r.actionTaken && (
                <p className="bh-action">
                  <span className="muted">Action taken: </span>
                  {r.actionTaken}
                </p>
              )}
              <div className="bh-foot small muted">
                <span>
                  By {personName(r.recorder)}
                  {r.recorder?.role ? ` (${roleLabel(r.recorder.role)})` : ""}
                </span>
                <Acknowledgement remark={r} />
              </div>
            </li>
          );
        })}
      </ol>
      {meta && onPageChange && meta.totalPages > 1 && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}

function Acknowledgement({ remark: r }: { remark: BehaviourRemark }) {
  if (r.acknowledgedAt)
    return (
      <span className="row bh-ack" style={{ gap: 4 }} title={formatDateTime(r.acknowledgedAt)}>
        <CheckCheck size={14} /> Seen by {personName(r.acknowledger)} on {formatDate(r.acknowledgedAt)}
      </span>
    );
  return (
    <span className="row" style={{ gap: 4 }}>
      <Clock size={14} /> Not yet acknowledged by a parent
    </span>
  );
}

/* The year in numbers: one tile per kind, and what waits for a parent */
export function BehaviourKpis({ summary, loading }: { summary: BehaviourSummary | undefined; loading?: boolean }) {
  if (loading && !summary) return <SkeletonBlock lines={2} />;
  if (!summary) return null;
  return (
    <div className="kpis">
      {REMARK_KINDS.map(k => (
        <Kpi key={k.value} label={k.label} value={summary.counts[k.value]} />
      ))}
      <Kpi
        label="Awaiting acknowledgement"
        value={summary.unacknowledged}
        hint={summary.lastOn ? `Last entry ${formatDate(summary.lastOn)}` : "No entries this year"}
      />
    </div>
  );
}

export const NoRemarks = ({ message, actions }: { message: string; actions?: ReactNode }) => (
  <EmptyState title="The log book is empty" message={message} actions={actions} />
);
