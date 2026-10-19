/* HR-01 · Leave types: the kinds of leave staff can apply for, with a yearly quota */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";
import { isApiError } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Page, useConfirm, useToast } from "@/common/ui";
import { PageIntro } from "../../shared/components/PageIntro";
import { dayCount } from "../../shared/utils/format";
import { LEAVE_TYPES_PATH, removeLeaveType, type LeaveType } from "../api/leaves";
import { LeaveTypeDrawer } from "../components/LeaveTypeDrawer";

export default function LeaveTypesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { params, setPage } = useListParams({});
  const list = useApiList<LeaveType>(LEAVE_TYPES_PATH, { page: params.page, limit: params.limit });
  const [drawer, setDrawer] = useState<{ type: LeaveType | null } | null>(null);
  const canManage = can("hr.leaveTypes.manage");
  const remove = useApiMutation(removeLeaveType, { invalidate: [LEAVE_TYPES_PATH, "/hr/leave-balances"] });

  const askRemove = async (t: LeaveType) => {
    const ok = await confirm({
      title: `Remove ${t.name}?`,
      message: `Staff can no longer apply for ${t.name}. Past requests keep it.`,
      confirmLabel: "Remove"
    });
    if (!ok) return;
    remove.mutate(t.id, {
      onSuccess: res => toast.success(res.message || `${t.name} removed`),
      onError: async err => {
        /* Pending requests block it: offer to open them */
        if (isApiError(err) && err.status === 409 && can("hr.leaveRequests.read")) {
          const open = await confirm({ title: `${t.name} can't be removed yet`, message: err.message, confirmLabel: "View pending requests", tone: "primary" });
          if (open) navigate(`/hr/leave-requests?status=PENDING&leaveTypeId=${t.id}`);
        } else toast.error(err);
      }
    });
  };

  const newButton = canManage && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDrawer({ type: null })}>
      New leave type
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={newButton}>Kinds of leave staff can apply for, each with a quota of days per calendar year.</PageIntro>
      <Card flush>
        <DataTable
          rows={list.rows}
          rowKey={t => t.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={t => setDrawer({ type: t })}
          empty={<EmptyState icon={<CalendarOff />} title="No leave types yet" message="Add Casual, Sick or Earned leave so staff can apply." actions={newButton} />}
          columns={[
            { key: "name", header: "Name", render: t => <strong>{t.name}</strong> },
            { key: "code", header: "Code", width: 110, render: t => <span className="mono">{t.code}</span> },
            { key: "quota", header: "Quota", align: "right", render: t => <span className="nowrap">{dayCount(t.annualQuotaDays)} / year</span> },
            { key: "paid", header: "Paid", render: t => (t.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">Unpaid</Badge>) },
            { key: "approval", header: "Needs approval", render: t => (t.requiresApproval ? "Yes" : <span className="muted">No, automatic</span>) },
            { key: "description", header: "Description", render: t => <span className="muted">{t.description || "—"}</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: t =>
                canManage && (
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setDrawer({ type: t })} aria-label={`Edit ${t.name}`} title="Edit" />
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void askRemove(t)} aria-label={`Remove ${t.name}`} title="Remove" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <LeaveTypeDrawer open={!!drawer} type={drawer?.type ?? null} canEdit={canManage} onClose={() => setDrawer(null)} />
    </Page>
  );
}
