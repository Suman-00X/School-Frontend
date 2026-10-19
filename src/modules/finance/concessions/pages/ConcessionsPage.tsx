/* FI-05 · Concessions (Templates): the discounts the school can grant (list + drawer) */
import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgePercent, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Select, useConfirm, useToast } from "@/common/ui";
import { SETUP_PATHS } from "../../shared";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, CONCESSIONS_PATH, removeConcession, useGrantCounts, valueLabel, type Concession } from "../api/concessions";
import { ConcessionDrawer } from "../components/ConcessionDrawer";

export default function ConcessionsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParam, setPage } = useListParams({ category: "" });
  const list = useApiList<Concession>(CONCESSIONS_PATH, params);
  const counts = useGrantCounts((list.rows ?? []).map(c => c.id));
  const [drawer, setDrawer] = useState<{ concession: Concession | null } | null>(null);
  const canManage = can("finance.concessions.manage");
  const remove = useApiMutation(removeConcession, { invalidate: [CONCESSIONS_PATH] });

  const askRemove = async (c: Concession) => {
    const n = counts.get(c.id) ?? 0;
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      message: n
        ? `${c.name} is granted to ${n} student${n === 1 ? "" : "s"}. Revoke the grants first; the server refuses to remove it until then.`
        : `${c.name} (${valueLabel(c)}) will no longer be offered for new grants.`,
      confirmLabel: "Remove concession"
    });
    if (ok) remove.mutate(c.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ concession: null })}>
      New concession
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Concessions"
        subtitle="Discounts you grant to students per year. Several stack: percentages add up, then fixed amounts. Paid invoices are never changed."
        actions={newButton}
      />
      <Card flush>
        <div className="filter-bar">
          <Select label="Category" placeholder="All categories" options={CATEGORY_OPTIONS} value={params.category} onChange={e => setParam("category", e.target.value)} error={undefined} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={c => c.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={c => setDrawer({ concession: c })}
          empty={
            params.category ? (
              <EmptyState title="Nothing matches" message={`No ${CATEGORY_LABELS[params.category as keyof typeof CATEGORY_LABELS]?.toLowerCase() ?? ""} concessions.`} />
            ) : (
              <EmptyState
                icon={<BadgePercent />}
                title="No concessions yet"
                message="Create the discounts the school gives, such as 10% for a sibling or 50% for a staff member's child, then grant them to students."
                actions={newButton}
              />
            )
          }
          columns={[
            {
              key: "name",
              header: "Name",
              render: c => (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 550 }}>{c.name}</div>
                  {c.description && <div className="small muted">{c.description}</div>}
                </div>
              )
            },
            { key: "category", header: "Category", render: c => <Badge tone="info">{CATEGORY_LABELS[c.category]}</Badge> },
            { key: "value", header: "Takes off", render: c => <span className="amount">{valueLabel(c)}</span> },
            {
              key: "feeHeads",
              header: "Fee heads",
              render: c =>
                c.feeHeads.length ? (
                  <div className="chips">
                    {c.feeHeads.map(h => (
                      <Badge key={h.id}>{h.name}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="muted">All</span>
                )
            },
            {
              key: "grants",
              header: "Grants",
              align: "right",
              width: 80,
              render: c => {
                const n = counts.get(c.id);
                if (n === undefined) return <span className="muted">…</span>;
                return n ? (
                  <Link to={`${SETUP_PATHS.concessionGrants}?concessionId=${c.id}`} onClick={e => e.stopPropagation()}>
                    {n}
                  </Link>
                ) : (
                  <span className="muted">0</span>
                );
              }
            },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: c =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ concession: c })} aria-label={`Edit ${c.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(c)} aria-label={`Remove ${c.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <ConcessionDrawer
        open={!!drawer}
        concession={drawer?.concession ?? null}
        grants={drawer?.concession ? counts.get(drawer.concession.id) : 0}
        canEdit={canManage}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
