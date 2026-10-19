/* FI-01 · Fee heads: what the school charges for (list + drawer) */
import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, PageHeader, useConfirm, useToast } from "@/common/ui";
import { FEE_HEADS_PATH, removeFeeHead, type FeeHead } from "../api/feeHeads";
import { FeeHeadDrawer } from "../components/FeeHeadDrawer";

type StructureRow = { name: string; items: { feeHeadId: string }[] };

/* The structures of the header's year that charge this head (the server lets it be removed anyway) */
async function structuresUsing(headId: string) {
  const res = await api.get<StructureRow[]>("/finance/fee-structures", { limit: 100 });
  return res.data.filter(s => s.items.some(i => i.feeHeadId === headId)).map(s => s.name);
}

export default function FeeHeadsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setPage } = useListParams({});
  const list = useApiList<FeeHead>(FEE_HEADS_PATH, { page: params.page, limit: params.limit });
  const [drawer, setDrawer] = useState<{ head: FeeHead | null } | null>(null);
  const canManage = can("finance.feeHeads.manage");
  const remove = useApiMutation(removeFeeHead, { invalidate: [FEE_HEADS_PATH] });

  const askRemove = async (h: FeeHead) => {
    let usedBy: string[] = [];
    if (can("finance.feeStructures.read")) usedBy = await structuresUsing(h.id).catch(() => []);
    const ok = await confirm({
      title: `Remove ${h.name}?`,
      message: usedBy.length ? (
        <div className="stack-sm">
          <p>
            <strong>{h.name}</strong> is still charged by {usedBy.length === 1 ? "a fee structure" : `${usedBy.length} fee structures`} this year: {usedBy.join(", ")}.
          </p>
          <p>Removing it doesn't change those structures or invoices already issued. Take it out of the structures first if they should stop charging it.</p>
        </div>
      ) : (
        `${h.name} (${h.code}) will no longer be offered for new fee structures and concessions. Invoices already issued keep it.`
      ),
      confirmLabel: "Remove fee head"
    });
    if (ok) remove.mutate(h.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ head: null })}>
      New fee head
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader title="Fee heads" subtitle="What the school charges for. Fee structures set the amount of each head per class." actions={newButton} />
      <Card flush>
        <DataTable
          rows={list.rows}
          rowKey={h => h.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={h => setDrawer({ head: h })}
          empty={<EmptyState icon={<Tags />} title="No fee heads yet" message="Add fee heads such as Tuition, Transport, Exam" actions={newButton} />}
          columns={[
            { key: "name", header: "Name", render: h => <strong style={{ fontWeight: 550 }}>{h.name}</strong> },
            { key: "code", header: "Code", width: 120, render: h => <span className="mono">{h.code}</span> },
            { key: "description", header: "Description", render: h => <span className="muted">{h.description || "—"}</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: h =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ head: h })} aria-label={`Edit ${h.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(h)} aria-label={`Remove ${h.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <FeeHeadDrawer open={!!drawer} head={drawer?.head ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </div>
  );
}
