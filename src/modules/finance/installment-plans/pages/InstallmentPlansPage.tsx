/* FI-02 · Installment plans (Plans): how the selected year's fees are spread, one card per plan */
import { useState } from "react";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, SkeletonBlock, useConfirm, useToast } from "@/common/ui";
import { installmentsLabel, PLANS_PATH, removePlan, type InstallmentPlan } from "../api/installmentPlans";
import { PlanDrawer } from "../components/PlanDrawer";
import { PlanTimeline } from "../components/PlanTimeline";
import "../components/installmentPlans.css";

export default function InstallmentPlansPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year, readOnly } = useAcademicYear();
  const { params, setPage } = useListParams({}, { limit: 50 });
  const list = useApiList<InstallmentPlan>(PLANS_PATH, { page: params.page, limit: params.limit });
  const [drawer, setDrawer] = useState<{ plan: InstallmentPlan | null } | null>(null);
  const canManage = can("finance.installmentPlans.manage") && !readOnly;
  const remove = useApiMutation(removePlan, { invalidate: [PLANS_PATH] });

  const askRemove = async (p: InstallmentPlan) => {
    const ok = await confirm({
      title: `Remove the ${p.name} plan?`,
      message: `${p.name} (${installmentsLabel(p.installmentCount)}) will no longer be offered in ${year?.yearName ?? "this year"}. A plan that a fee structure offers, or that students are assigned to, can't be removed.`,
      confirmLabel: "Remove plan"
    });
    if (ok) remove.mutate(p.id, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ plan: null })}>
      New plan
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Installment plans"
        subtitle={`How ${year?.yearName ?? "the year"}'s fees are spread over the year. Fee structures offer one or more plans; students pay by the default unless assigned another.`}
        actions={newButton}
      />
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.rows ? (
        <div className="plan-cards">
          {[0, 1, 2].map(i => (
            <Card key={i} className="plan-skeleton">
              <SkeletonBlock lines={4} />
            </Card>
          ))}
        </div>
      ) : list.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarRange />}
            title={`No installment plans for ${year?.yearName ?? "this year"}`}
            message="Create the ways families can pay, such as Annual (one payment), Quarterly or Monthly. Plans belong to a year because their due dates are real dates."
            actions={newButton}
          />
        </Card>
      ) : (
        <>
          <div className="plan-cards">
            {list.rows.map(p => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className="card plan-card"
                onClick={() => setDrawer({ plan: p })}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDrawer({ plan: p }))}
              >
                <div className="card-header">
                  <div style={{ minWidth: 0 }}>
                    <h2>{p.name}</h2>
                    <div className="card-subtitle">
                      {installmentsLabel(p.installmentCount)}
                      {p.description ? ` · ${p.description}` : ""}
                    </div>
                  </div>
                  {canManage && (
                    <div className="row-actions" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ plan: p })} aria-label={`Edit ${p.name}`} title="Edit" />
                      <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(p)} aria-label={`Remove ${p.name}`} title="Remove" />
                    </div>
                  )}
                </div>
                <div className="card-body">
                  <PlanTimeline plan={p} />
                </div>
              </div>
            ))}
          </div>
          {list.meta && list.meta.totalPages > 1 && <Pagination meta={list.meta} onPageChange={setPage} />}
        </>
      )}
      <PlanDrawer open={!!drawer} plan={drawer?.plan ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </div>
  );
}
