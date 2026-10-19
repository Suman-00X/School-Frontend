/* FI-02 · Plan assignments (Student plans): students who pay by a plan other than their structure's default */
import { useState } from "react";
import { CalendarClock, Plus, RotateCcw, Shuffle } from "lucide-react";
import { useAcademicYear } from "@/common/academic-year/AcademicYearProvider";
import { useAuth } from "@/common/auth";
import { useApiList, useApiMutation, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, PersonCell, Select, useConfirm, useToast } from "@/common/ui";
import { formatDate } from "@/common/utils/format";
import { StudentSelect } from "@/modules/users";
import { UserName } from "../../shared";
import { ASSIGNMENTS_PATH, assignPlan, usePlanOptions, type PlanAssignment } from "../api/installmentPlans";
import { AssignPlanDialog } from "../components/AssignPlanDialog";

const nameOf = (a: PlanAssignment) => `${a.student.user.firstName} ${a.student.user.lastName}`.trim();

export default function PlanAssignmentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { selected: year, readOnly } = useAcademicYear();
  const { params, setParam, setPage } = useListParams({ installmentPlanId: "", studentId: "" });
  const list = useApiList<PlanAssignment>(ASSIGNMENTS_PATH, params);
  const plans = usePlanOptions();
  const [dialog, setDialog] = useState<{ preset?: { studentId: string; planId: string | null } } | null>(null);
  const canAssign = can("finance.installmentPlans.assign") && !readOnly;
  const reset = useApiMutation(assignPlan, { invalidate: [ASSIGNMENTS_PATH, "/finance/invoices", "/finance/students"] });

  const askReset = async (a: PlanAssignment) => {
    const ok = await confirm({
      title: `Move ${nameOf(a)} back to the default plan?`,
      message: `${nameOf(a)} stops paying by the ${a.plan.name} plan and pays by each fee structure's default plan. Unpaid invoices under the ${a.plan.name} plan are cancelled and re-issued. Refused if anything of this year is already paid.`,
      confirmLabel: "Use default plan",
      tone: "primary"
    });
    if (ok) reset.mutate({ studentId: a.studentId, installmentPlanId: null }, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const filtered = !!params.installmentPlanId || !!params.studentId;
  const assignButton = canAssign && (
    <Button variant="primary" icon={<Plus />} onClick={() => setDialog({})}>
      Assign plan
    </Button>
  );

  return (
    <div className="stack">
      <PageHeader
        title="Student plans"
        subtitle={`Students who pay ${year?.yearName ?? "this year"}'s fees by a plan of their own. Everyone else pays by each fee structure's default plan.`}
        actions={assignButton}
      />
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Plan"
            placeholder="All plans"
            options={plans.options}
            value={params.installmentPlanId}
            onChange={e => setParam("installmentPlanId", e.target.value)}
            error={undefined}
          />
          <StudentSelect label="Student" placeholder="Any student" value={params.studentId} onChange={e => setParam("studentId", e.target.value)} error={undefined} />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={a => a.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          empty={
            filtered ? (
              <EmptyState title="Nothing matches" message="No student has their own plan with these filters. Students not listed pay by each fee structure's default plan." />
            ) : (
              <EmptyState
                icon={<CalendarClock />}
                title="Every student pays by the default plan"
                message={`Nobody has a plan of their own in ${year?.yearName ?? "this year"}. Assign one to a student, a section or a class.`}
                actions={assignButton}
              />
            )
          }
          columns={[
            { key: "student", header: "Student", render: a => <PersonCell name={nameOf(a)} sub={<span className="mono">{a.student.studentCode}</span>} /> },
            { key: "admissionNumber", header: "Admission no.", width: 130, render: a => a.student.admissionNumber },
            { key: "plan", header: "Plan", render: a => <Badge tone="primary">{a.plan.name}</Badge> },
            { key: "assignedBy", header: "Assigned by", render: a => <UserName id={a.assignedBy} /> },
            { key: "updatedAt", header: "Updated", width: 120, render: a => <span className="nowrap">{formatDate(a.updatedAt)}</span> },
            {
              key: "actions",
              header: "",
              align: "right",
              width: 84,
              render: a =>
                canAssign && (
                  <div className="row-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Shuffle />}
                      onClick={() => setDialog({ preset: { studentId: a.studentId, planId: a.installmentPlanId } })}
                      aria-label={`Change ${nameOf(a)}'s plan`}
                      title="Change plan"
                    />
                    <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void askReset(a)} aria-label={`Move ${nameOf(a)} back to the default plan`} title="Back to default" />
                  </div>
                )
            }
          ]}
        />
      </Card>
      <AssignPlanDialog open={!!dialog} preset={dialog?.preset} onClose={() => setDialog(null)} />
    </div>
  );
}
