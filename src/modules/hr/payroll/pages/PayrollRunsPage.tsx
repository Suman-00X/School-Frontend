/* HR-05 · Payroll runs: one run per month, computed as a draft, then finalized */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calculator, Play } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, EmptyState, Page, Select } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { PageIntro } from "../../shared/components/PageIntro";
import { useMoney } from "../../shared/hooks/useMoney";
import { monthLabel } from "../../shared/utils/format";
import { RUNS_PATH, type PayrollRun } from "../api/payroll";
import { RunPayrollDialog } from "../components/RunPayrollDialog";
import { RunStatusBadge } from "../components/SalaryBits";

export default function PayrollRunsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const money = useMoney();
  const { params, setParam, setPage } = useListParams({ status: "" });
  const list = useApiList<PayrollRun>(RUNS_PATH, { page: params.page, limit: params.limit, status: params.status || undefined });
  const canRun = can("hr.payrollRuns.run");
  /* ?run=1 (quick action) opens the dialog */
  const [search, setSearch] = useSearchParams();
  const [clicked, setRunning] = useState(false);
  const running = clicked || (canRun && search.get("run") === "1");
  const closeRun = () => {
    setRunning(false);
    if (search.has("run"))
      setSearch(
        prev => {
          const next = new URLSearchParams(prev);
          next.delete("run");
          return next;
        },
        { replace: true }
      );
  };

  const runButton = canRun && (
    <Button variant="primary" icon={<Play />} onClick={() => setRunning(true)}>
      Run payroll
    </Button>
  );

  return (
    <Page>
      <PageIntro actions={runButton}>Monthly payroll from salaries, staff attendance and approved leave. Check the draft, recalculate if needed, then finalize.</PageIntro>
      <Card flush>
        <div className="filter-bar">
          <Select
            label="Status"
            className="select-sm"
            value={params.status}
            placeholder="All runs"
            onChange={e => setParam("status", e.target.value)}
            options={[
              { value: "DRAFT", label: "Draft", description: "Can still be recalculated" },
              { value: "FINALIZED", label: "Finalized", description: "Locked; payslips released to staff" }
            ]}
          />
        </div>
        <DataTable
          rows={list.rows}
          rowKey={r => r.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={r => navigate(`${RUNS_PATH}/${r.id}`)}
          empty={
            params.status ? (
              <EmptyState icon={<Calculator />} title={`No ${params.status === "DRAFT" ? "draft" : "finalized"} runs`} />
            ) : (
              <EmptyState icon={<Calculator />} title="No payroll runs yet" message="Run payroll for a month once salaries are set and attendance is marked." actions={runButton} />
            )
          }
          columns={[
            { key: "month", header: "Month", render: r => <strong className="nowrap">{monthLabel(r.month)}</strong> },
            { key: "status", header: "Status", render: r => <RunStatusBadge status={r.status} /> },
            { key: "employees", header: "Employees", align: "right", render: r => <span className="hr-num">{r.employeeCount}</span> },
            { key: "gross", header: "Gross", align: "right", render: r => <span className="hr-num nowrap">{money(r.totalGross)}</span> },
            { key: "deductions", header: "Deductions", align: "right", render: r => <span className="hr-num nowrap">{money(r.totalDeductions)}</span> },
            { key: "net", header: "Net", align: "right", render: r => <strong className="hr-num nowrap">{money(r.totalNet)}</strong> },
            { key: "computed", header: "Computed", render: r => <span className="nowrap small">{formatDateTime(r.computedAt)}</span> },
            { key: "finalized", header: "Finalized", render: r => (r.finalizedAt ? <span className="nowrap small">{formatDateTime(r.finalizedAt)}</span> : <span className="muted">—</span>) }
          ]}
        />
      </Card>
      <RunPayrollDialog open={running} onClose={closeRun} />
    </Page>
  );
}
