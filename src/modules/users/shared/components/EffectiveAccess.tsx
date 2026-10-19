import { useState, type ReactNode } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { AccessModule, PermissionSource } from "@/common/api";
import { useAuth } from "@/common/auth";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, SkeletonBlock, StatusBadge, roleLabel } from "@/common/ui";
import { enumLabel, formatDate } from "@/common/utils/format";
import { useUserAccess } from "../api/access";

const until = (s: PermissionSource) => (s.validTo ? ` until ${formatDate(s.validTo)}` : "");

function SourceChip({ source }: { source: PermissionSource }) {
  if (source.type === "ROLE") return <Badge>Role{source.role ? `: ${roleLabel(source.role)}` : ""}</Badge>;
  if (source.type === "OPERATOR")
    return (
      <Badge tone="info">
        Operator: {source.operatorRoleName ?? "role"}
        {until(source)}
      </Badge>
    );
  /* { type: OWNER, role } is what a built-in owner role holds; without a role it is an owner assignment */
  return <Badge tone="primary">Owner{source.role ? ` (${roleLabel(source.role)})` : until(source)}</Badge>;
}

const countOf = (m: AccessModule) => m.resources.reduce((n, r) => n + r.permissions.length, 0);

/* A person's effective access (AD-06 Access tab, PE-06 Access panel): one accordion item per module
   with its Owner badge, each permission with where it comes from, then live and upcoming assignments. */
export function EffectiveAccess({ userId, title = "Effective access", actions }: { userId: string; title?: string; actions?: ReactNode }) {
  const { can } = useAuth();
  const access = useUserAccess(userId);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const data = access.data;
  const modules = data?.modules ?? [];

  const toggle = (module: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  const allOpen = modules.length > 0 && modules.every(m => open.has(m.module));
  const labelOf = (module: string) => modules.find(m => m.module === module)?.label ?? enumLabel(module);

  return (
    <Card
      flush
      title={title}
      subtitle={
        data
          ? `As of ${formatDate(data.asOf)}${can("administration.access.readAll") ? "" : " · only the modules you own are shown"}`
          : undefined
      }
      actions={
        <>
          {modules.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(modules.map(m => m.module)))}>
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          )}
          {actions}
        </>
      }
    >
      {access.isLoading && (
        <div style={{ padding: 18 }}>
          <SkeletonBlock lines={5} />
        </div>
      )}
      {access.error && <ErrorState error={access.error} onRetry={() => void access.refetch()} />}
      {data && modules.length === 0 && <EmptyState icon={<ShieldCheck />} title="No module access" message="This account holds no permissions in the modules you can see." />}
      {modules.map(m => {
        const expanded = open.has(m.module);
        return (
          <div className="accordion-item" key={m.module}>
            <button type="button" className="accordion-trigger" aria-expanded={expanded} onClick={() => toggle(m.module)}>
              <ChevronRight className="chevron" />
              <span>{m.label}</span>
              {m.owner && <Badge tone="primary">Owner</Badge>}
              <span className="small muted" style={{ marginLeft: "auto", fontWeight: 400 }}>
                {countOf(m)} permission{countOf(m) === 1 ? "" : "s"}
              </span>
            </button>
            {expanded && (
              <div className="accordion-panel stack">
                {m.resources.map(r => (
                  <div key={r.resource} className="stack-sm">
                    <div className="section-title">{r.label}</div>
                    {r.permissions.map(p => (
                      <div key={p.key} className="row-between">
                        <span title={p.key}>{p.label}</span>
                        <span className="row">
                          {p.sources.map((s, i) => (
                            <SourceChip key={i} source={s} />
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {data && data.assignments.length > 0 && (
        <>
          <div className="section-title" style={{ padding: "16px 16px 8px", borderTop: "1px solid var(--border)" }}>
            Assignments (live and upcoming)
          </div>
          <DataTable
            rows={data.assignments}
            rowKey={a => a.id}
            columns={[
              { key: "role", header: "Role", render: a => (a.kind === "OWNER" ? <Badge tone="primary">Owner</Badge> : a.operatorRole?.name) },
              { key: "module", header: "Module", render: a => a.moduleLabel ?? labelOf(a.module) },
              { key: "validFrom", header: "From", render: a => (a.validFrom ? formatDate(a.validFrom) : <span className="muted">Start</span>) },
              { key: "validTo", header: "To", render: a => (a.validTo ? formatDate(a.validTo) : <span className="muted">No end</span>) },
              { key: "status", header: "Status", render: a => <StatusBadge status={a.status} /> }
            ]}
          />
        </>
      )}
    </Card>
  );
}
