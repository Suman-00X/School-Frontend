/* HR-05 · Payroll run: totals, recalculate and finalize a draft, and the run's payslips */
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, FileDown, History, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useApiMutation } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import {
  Button,
  ButtonLink,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Page,
  PersonCell,
  SearchInput,
  StatTile,
  StatTiles,
  useConfirm,
  useToast,
  type Column
} from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { matchesSearch } from "@/modules/users/shared";
import { useHrEmployees } from "../../shared/api/employees";
import { useMoney } from "../../shared/hooks/useMoney";
import { monthLabel } from "../../shared/utils/format";
import { downloadPayslip, finalizeRun, recalculateRun, RUNS_PATH, useRunPayslips, type PayrollRun, type Payslip } from "../api/payroll";
import { RunStatusBadge } from "../components/SalaryBits";
import "../../shared/hr.css";

type Missing = { userId: string; name: string };

export default function PayrollRunDetailPage() {
  const { runId = "" } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();
  const navigate = useNavigate();
  const location = useLocation();
  const run = useApiGet<PayrollRun>(`${RUNS_PATH}/${runId}`);
  const slips = useRunPayslips(runId);
  const { employees, complete } = useHrEmployees();
  const [search, setSearch] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  /* Returned by the run and by recalculation only */
  const [fromAction, setFromAction] = useState<Missing[] | null>((location.state as { withoutSalary?: Missing[] } | null)?.withoutSalary ?? null);

  const recalc = useApiMutation(recalculateRun, { invalidate: [RUNS_PATH, "/hr/payslips"] });
  const finalize = useApiMutation(finalizeRun, { invalidate: [RUNS_PATH, "/hr/payslips", "/hr/staff-attendance", "/hr/leave-requests"] });

  const r = run.data;
  const label = r ? (r.monthLabel ?? monthLabel(r.month)) : "";
  const draft = r?.status === "DRAFT";

  /* Who is left out: from the last run / recalculation, else worked out from the employee directory */
  const missing = useMemo<Missing[] | null>(() => {
    if (fromAction) return fromAction;
    if (!complete || !slips.data) return null;
    const paid = new Set(slips.data.map(s => s.userId));
    return employees.filter(e => !paid.has(e.userId)).map(e => ({ userId: e.userId, name: e.name }));
  }, [fromAction, complete, slips.data, employees]);

  const doRecalc = () =>
    recalc.mutate(runId, {
      onSuccess: res => {
        toast.success(res.message);
        setFromAction(res.data.withoutSalary ?? []);
      },
      onError: e => toast.error(e)
    });

  const doFinalize = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Finalize payroll for ${label}?`,
      message: `Payslips get numbers and become visible to staff. Attendance and leave for ${label} will be locked. This cannot be undone.`,
      confirmLabel: "Finalize payroll",
      tone: "primary"
    });
    if (ok) finalize.mutate(runId, { onSuccess: res => toast.success(res.message), onError: e => toast.error(e) });
  };

  const pdf = async (s: Payslip) => {
    setDownloading(s.id);
    try {
      await downloadPayslip(s.id);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(null);
    }
  };

  const header = <DrillHeader back={RUNS_PATH} backLabel="Back to payroll runs" title={label || "Payroll run"} />;

  if (run.error)
    return (
      <Page>
        {header}
        <ErrorState error={run.error} onRetry={() => void run.refetch()} />
      </Page>
    );

  const visible = (slips.data ?? []).filter(s => !search.trim() || matchesSearch(search, s.employeeName, s.employeeCode, s.designation, s.payslipNumber));

  const columns: Column<Payslip>[] = [
    { key: "name", header: "Employee", render: s => <PersonCell name={s.employeeName} sub={s.designation ?? undefined} /> },
    { key: "code", header: "Code", render: s => <span className="mono small">{s.employeeCode ?? "—"}</span> },
    { key: "paid", header: "Paid days", align: "right", render: s => <span className="hr-num">{s.paidDays}</span> },
    {
      key: "lop",
      header: "LOP days",
      align: "right",
      render: s => (s.lopDays ? <strong className="hr-num" style={{ color: "var(--danger-text)" }}>{s.lopDays}</strong> : <span className="hr-num muted">0</span>)
    },
    { key: "gross", header: "Gross", align: "right", render: s => <span className="hr-num nowrap">{money(s.grossPay)}</span> },
    { key: "deductions", header: "Deductions", align: "right", render: s => <span className="hr-num nowrap">{money(s.totalDeductions)}</span> },
    { key: "net", header: "Net", align: "right", render: s => <strong className="hr-num nowrap">{money(s.netPay)}</strong> },
    { key: "number", header: "Payslip no.", render: s => (s.payslipNumber ? <span className="mono small">{s.payslipNumber}</span> : <span className="muted small">On finalizing</span>) },
    {
      key: "pdf",
      header: "",
      align: "right",
      width: 48,
      render: s => (
        <div className="row-actions" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={<FileDown />} loading={downloading === s.id} onClick={() => void pdf(s)} aria-label={`PDF payslip for ${s.employeeName}`} title="Download PDF" />
        </div>
      )
    }
  ];

  /* One fixed line under the totals: the run's state and who is left out */
  const statusLine = !r ? (
    " "
  ) : !draft ? (
    `Finalized ${formatDateTime(r.finalizedAt)}. Payslips are numbered and visible to staff; this run can no longer change.`
  ) : missing === null ? (
    "Check attendance and leave for the month, recalculate, then finalize. Employees without a salary are listed after you recalculate."
  ) : missing.length === 0 ? (
    "Everyone with an active account has a payslip. Check attendance and leave for the month, recalculate, then finalize."
  ) : (
    <>
      <span style={{ color: "var(--warning-text)" }}>
        {missing.length} employee{missing.length === 1 ? " has" : "s have"} no salary and {missing.length === 1 ? "is" : "are"} left out.
      </span>{" "}
      <Button variant="link" size="sm" onClick={() => setShowMissing(true)}>
        See who
      </Button>
    </>
  );

  return (
    <Page>
      {header}
      <Card>
        <div className="stack">
          <div className="row-between" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 10, minHeight: 34 }}>
              <RunStatusBadge status={r?.status} />
              <span className="small muted">{r?.computedAt ? `Computed ${formatDateTime(r.computedAt)}` : " "}</span>
              {r?.notes && <span className="small muted">· {r.notes}</span>}
            </div>
            <div className="row">
              {can("hr.activity.read") && (
                <ButtonLink variant="ghost" icon={<History />} to={`/hr/activity?entityId=${runId}`}>
                  History
                </ButtonLink>
              )}
              {draft && can("hr.payrollRuns.run") && (
                <Button icon={<RefreshCw />} loading={recalc.isPending} disabled={finalize.isPending} onClick={doRecalc}>
                  Recalculate
                </Button>
              )}
              {draft && can("hr.payrollRuns.finalize") && (
                <Button variant="primary" icon={<CheckCircle2 />} loading={finalize.isPending} disabled={recalc.isPending} onClick={() => void doFinalize()}>
                  Finalize
                </Button>
              )}
            </div>
          </div>
          <StatTiles>
            <StatTile label="Employees" value={r?.employeeCount} hint="Payslips in this run" loading={!r} />
            <StatTile label="Total gross" value={r && money(r.totalGross)} hint="After loss of pay" loading={!r} />
            <StatTile label="Total deductions" value={r && money(r.totalDeductions)} hint="PF, tax and other deductions" loading={!r} />
            <StatTile label="Total net" value={r && money(r.totalNet)} hint="To be paid" loading={!r} />
          </StatTiles>
          <div className="small muted hr-status-line">{statusLine}</div>
        </div>
      </Card>

      <Card flush>
        <div className="hr-toolbar">
          <SearchInput placeholder="Search name, code or number" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search payslips" />
          <span className="small muted" style={{ marginLeft: "auto" }}>
            {slips.data ? `${slips.data.length} payslip${slips.data.length === 1 ? "" : "s"}` : " "}
          </span>
        </div>
        <DataTable
          rows={slips.data ? visible : undefined}
          rowKey={s => s.id}
          loading={slips.isLoading}
          error={slips.error}
          onRetry={() => void slips.refetch()}
          onRowClick={s => navigate(`/hr/payslips/${s.id}`)}
          columns={columns}
          empty={
            slips.data?.length ? (
              <EmptyState icon={<Users />} title="Nobody matches" />
            ) : (
              <EmptyState icon={<Users />} title="No payslips in this run" message="Nobody had a salary effective on the 1st of the month. Add salaries, then recalculate." />
            )
          }
        />
      </Card>

      <Dialog open={showMissing} onClose={() => setShowMissing(false)} title="Left out: no salary" footer={<Button onClick={() => setShowMissing(false)}>Close</Button>}>
        <div className="stack-sm">
          <p className="muted">These active employees have no salary effective on the 1st of {label}. Add one, then recalculate.</p>
          <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(missing ?? []).map(m => (
              <li key={m.userId} className="row-between">
                <span>{m.name}</span>
                {can("hr.employeeSalaries.manage") && (
                  <Link className="small" to={`/hr/employee-salaries?new=${m.userId}&name=${encodeURIComponent(m.name)}`}>
                    Add salary
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </Page>
  );
}
