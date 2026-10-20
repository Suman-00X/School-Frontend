import { Card, ErrorState, SkeletonBlock } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useRuns, type RunKind } from "../api/scheduling";
import { AgentBadge, RunStatusBadge } from "./RunBits";

/* The latest runs of the header's year, newest first; one opens on click */
export function RecentDrafts({ kind, current, onOpen }: { kind: RunKind; current?: string; onOpen: (runId: string) => void }) {
  const runs = useRuns({ kind, limit: 10 });
  return (
    <Card flush title="Recent drafts" subtitle="Generated here or by an AI agent">
      {runs.error ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.isLoading ? (
        <div style={{ padding: 14 }}>
          <SkeletonBlock lines={4} />
        </div>
      ) : !runs.data?.length ? (
        <p className="muted small" style={{ padding: "12px 16px" }}>
          No drafts yet. The ones you generate are listed here.
        </p>
      ) : (
        <ul className="sch-runs">
          {runs.data.map(r => (
            <li key={r.id}>
              <button type="button" className={`sch-run${r.id === current ? " is-current" : ""}`} onClick={() => onOpen(r.id)} aria-current={r.id === current || undefined}>
                <span className="row" style={{ gap: 6 }}>
                  <RunStatusBadge run={r} />
                  <AgentBadge run={r} />
                  <span className="small muted" style={{ marginLeft: "auto" }}>
                    {formatDateTime(r.createdAt)}
                  </span>
                </span>
                <span className="sch-run-summary" title={r.summary}>
                  {r.summary}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
