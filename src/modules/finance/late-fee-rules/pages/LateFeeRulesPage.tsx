/* FI-04 · Late-fee rules: slabs by delay after a grace period, optionally capped (list + drawer) */
import { useState } from "react";
import { Hourglass, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, useConfirm, useToast } from "@/common/ui";
import { useMoney } from "../../shared";
import { removeRule, RULES_PATH, slabsSummary, updateRule, type LateFeeRule } from "../api/lateFeeRules";
import { RuleDrawer } from "../components/RuleDrawer";

export default function LateFeeRulesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const { params, setPage } = useListParams({});
  const list = useApiList<LateFeeRule>(RULES_PATH, { page: params.page, limit: params.limit });
  const [drawer, setDrawer] = useState<{ rule: LateFeeRule | null } | null>(null);
  const canManage = can("finance.lateFeeRules.manage");
  const invalidate = [RULES_PATH, "/finance/fee-structures"];
  const remove = useApiMutation(removeRule, { invalidate });
  const makeDefault = useApiMutation(updateRule, { invalidate });
  const handlers = { onSuccess: (res: { message: string }) => toast.success(res.message), onError: (e: unknown) => toast.error(e) };
  const current = list.rows?.find(r => r.isDefault);

  const askRemove = async (r: LateFeeRule) => {
    const ok = await confirm({
      title: `Remove ${r.name}?`,
      message: r.isDefault
        ? `${r.name} is the school default. Without a default, structures that have no rule of their own charge no late fee. A rule that fee structures use can't be removed.`
        : `${r.name} will no longer be offered to fee structures. A rule that fee structures use can't be removed.`,
      confirmLabel: "Remove rule"
    });
    if (ok) remove.mutate(r.id, handlers);
  };

  const askDefault = async (r: LateFeeRule) => {
    const ok = await confirm({
      title: `Make ${r.name} the school default?`,
      message: `Fee structures that charge late fees without a rule of their own will use ${r.name}${current ? ` instead of ${current.name}` : ""}, from the next daily run.`,
      confirmLabel: "Make default",
      tone: "primary"
    });
    if (ok) makeDefault.mutate({ id: r.id, isDefault: true }, handlers);
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ rule: null })}>
      New rule
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Late-fee rules"
        subtitle="What an overdue invoice is charged, by how many days late it is. Fee structures use their own rule or the school default."
        actions={newButton}
      />
      <Card flush>
        <DataTable
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => setDrawer({ rule: r })}
          empty={
            <EmptyState
              icon={<Hourglass />}
              title="No late-fee rules yet"
              message="A rule charges overdue invoices by slabs of delay, for example 50 for the first week and 200 after that. Make one the school default."
              actions={newButton}
            />
          }
          columns={[
            {
              key: "name",
              header: "Name",
              render: r => (
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 550 }}>{r.name}</span>
                    {r.isDefault && <Badge tone="primary">Default</Badge>}
                  </div>
                  {r.description && <div className="small muted">{r.description}</div>}
                </div>
              )
            },
            { key: "graceDays", header: "Grace", width: 90, render: r => `${r.graceDays} d` },
            { key: "slabs", header: "Slabs", render: r => <span className="small amount" style={{ whiteSpace: "normal" }}>{slabsSummary(r.slabs)}</span> },
            { key: "maxAmount", header: "Cap", align: "right", render: r => (r.maxAmount === null ? <span className="muted">No cap</span> : <span className="amount">{money(r.maxAmount)}</span>) },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 116,
              render: r =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    {!r.isDefault && <Button size="sm" variant="ghost" icon={<Star />} onClick={() => void askDefault(r)} aria-label={`Make ${r.name} the school default`} title="Make school default" />}
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ rule: r })} aria-label={`Edit ${r.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(r)} aria-label={`Remove ${r.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <RuleDrawer open={!!drawer} rule={drawer?.rule ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </div>
  );
}
