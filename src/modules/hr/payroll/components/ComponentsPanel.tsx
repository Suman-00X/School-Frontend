import { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Select, useConfirm, useToast } from "@/common/ui";
import { COMPONENTS_PATH, removeComponent, type SalaryComponent } from "../api/payroll";
import { ComponentDrawer } from "./ComponentDrawer";
import { CalculationText, KindBadge } from "./SalaryBits";

/* HR-02 Components: earnings and deductions that salaries are built from */
export function ComponentsPanel() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { params, setParam, setPage } = useListParams({ kind: "" });
  const list = useApiList<SalaryComponent>(COMPONENTS_PATH, { page: params.page, limit: params.limit, kind: params.kind || undefined });
  const [drawer, setDrawer] = useState<{ component: SalaryComponent | null } | null>(null);
  const canManage = can("hr.salaryComponents.manage");
  const remove = useApiMutation(removeComponent, { invalidate: [COMPONENTS_PATH] });

  const askRemove = async (c: SalaryComponent) => {
    const ok = await confirm({
      title: `Remove ${c.name}?`,
      message: `${c.name} (${c.code}) can no longer be added to salaries. A component already used in a salary revision can't be removed.`,
      confirmLabel: "Remove"
    });
    if (ok) remove.mutate(c.id, { onSuccess: res => toast.success(res.message || `${c.name} removed`), onError: e => toast.error(e) });
  };

  const newButton = canManage && (
    <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setDrawer({ component: null })}>
      New component
    </Button>
  );

  return (
    <>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Kind"
            className="select-sm"
            value={params.kind}
            placeholder="Earnings and deductions"
            onChange={e => setParam("kind", e.target.value)}
            options={[
              { value: "EARNING", label: "Earnings" },
              { value: "DEDUCTION", label: "Deductions" }
            ]}
          />
          {newButton && <div style={{ marginLeft: "auto", alignSelf: "flex-end" }}>{newButton}</div>}
        </div>
        <DataTable
          rows={list.rows}
          rowKey={c => c.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={c => setDrawer({ component: c })}
          empty={
            params.kind ? (
              <EmptyState icon={<Layers />} title={`No ${params.kind === "EARNING" ? "earnings" : "deductions"} yet`} />
            ) : (
              <EmptyState icon={<Layers />} title="No salary components yet" message="Add allowances such as HRA and deductions such as PF; salaries pick from them." actions={newButton} />
            )
          }
          columns={[
            { key: "code", header: "Code", width: 110, render: c => <span className="mono">{c.code}</span> },
            { key: "name", header: "Name", render: c => <strong>{c.name}</strong> },
            { key: "kind", header: "Kind", render: c => <KindBadge kind={c.kind} /> },
            { key: "calculation", header: "Calculation", render: c => (c.calculation === "FIXED" ? "Fixed amount" : "Percent of basic") },
            { key: "default", header: "Default", align: "right", render: c => <CalculationText calculation={c.calculation} value={c.defaultValue} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: c =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ component: c })} aria-label={`Edit ${c.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(c)} aria-label={`Remove ${c.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <ComponentDrawer open={!!drawer} component={drawer?.component ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </>
  );
}
