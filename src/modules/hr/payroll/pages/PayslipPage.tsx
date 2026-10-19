/* HR-06 · Payslip: one employee's payslip for a month, with its PDF */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { useApiGet } from "@/common/hooks";
import { DrillHeader } from "@/common/layout/ShellHeader";
import { Button, Card, DescriptionList, ErrorState, Page, RoleBadge, SkeletonBlock, useToast } from "@/common/ui";
import { formatDateTime } from "@/common/utils/format";
import { useMoney } from "../../shared/hooks/useMoney";
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES, monthLabel } from "../../shared/utils/format";
import { downloadPayslip, PAYSLIPS_PATH, RUNS_PATH, useRunPayslips, type PayLine, type Payslip } from "../api/payroll";
import { RunStatusBadge } from "../components/SalaryBits";
import "../../shared/hr.css";

export default function PayslipPage() {
  const { payslipId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const money = useMoney();
  const slip = useApiGet<Payslip>(`${PAYSLIPS_PATH}/${payslipId}`);
  const p = slip.data;
  const runId = p?.run?.id ?? p?.runId;
  const siblings = useRunPayslips(runId);
  const [downloading, setDownloading] = useState(false);

  const index = siblings.data?.findIndex(s => s.id === payslipId) ?? -1;
  const prev = index > 0 ? siblings.data![index - 1] : undefined;
  const next = index >= 0 ? siblings.data![index + 1] : undefined;

  const pdf = async () => {
    setDownloading(true);
    try {
      await downloadPayslip(payslipId);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const header = (
    <DrillHeader
      back={runId ? `${RUNS_PATH}/${runId}` : RUNS_PATH}
      backLabel="Back to run"
      title={p ? `${p.employeeName} · ${monthLabel(p.month)}` : "Payslip"}
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<ChevronLeft />} disabled={!prev} onClick={() => prev && navigate(`${PAYSLIPS_PATH}/${prev.id}`, { replace: true })} aria-label="Previous payslip" title={prev ? prev.employeeName : undefined} />
          <Button size="sm" variant="ghost" icon={<ChevronRight />} disabled={!next} onClick={() => next && navigate(`${PAYSLIPS_PATH}/${next.id}`, { replace: true })} aria-label="Next payslip" title={next ? next.employeeName : undefined} />
        </>
      }
    />
  );

  if (slip.error)
    return (
      <Page>
        {header}
        <ErrorState error={slip.error} onRetry={() => void slip.refetch()} />
      </Page>
    );

  const draft = p?.run?.status !== "FINALIZED";

  const lines = (items: PayLine[], negative = false) =>
    items.map(l => (
      <tr key={l.code}>
        <td>
          {l.name}
          {l.calculation === "PERCENT_OF_BASIC" && <span className="small muted"> ({l.value}% of basic)</span>}
        </td>
        <td>
          {negative ? "−" : ""}
          {money(l.amount)}
        </td>
      </tr>
    ));

  return (
    <Page>
      {header}
      <Card>
        {!p ? (
          <SkeletonBlock lines={12} />
        ) : (
          <div className="stack">
            <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="stack-sm" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 18 }}>Payslip for {monthLabel(p.month)}</strong>
                  <RunStatusBadge status={p.run?.status} />
                </div>
                {/* One line, always: the draft warning or the finalization */}
                <div className="small hr-status-line" style={{ color: draft ? "var(--warning-text)" : "var(--text-3)" }}>
                  {draft ? "Draft: figures can still change when payroll is recalculated." : `Finalized ${formatDateTime(p.run?.finalizedAt)}`}
                </div>
              </div>
              <Button icon={<FileDown />} loading={downloading} onClick={() => void pdf()}>
                Download PDF
              </Button>
            </div>

            <DescriptionList
              columns={3}
              items={[
                { label: "Payslip number", value: p.payslipNumber ? <span className="mono">{p.payslipNumber}</span> : <span className="muted">Assigned on finalization</span> },
                { label: "Employee", value: p.employeeName },
                { label: "Employee code", value: p.employeeCode && <span className="mono">{p.employeeCode}</span> },
                { label: "Designation", value: p.designation },
                { label: "Role", value: <RoleBadge role={p.role} /> },
                { label: "Bank account", value: p.bankAccountMasked && <span className="mono">{p.bankAccountMasked}{p.bankIfsc ? ` · ${p.bankIfsc}` : ""}</span> },
                { label: "PAN", value: p.panMasked && <span className="mono">{p.panMasked}</span> },
                { label: "Days in month", value: p.daysInMonth },
                { label: "Paid days · loss of pay", value: `${p.paidDays} · ${p.lopDays}` }
              ]}
            />

            <div className="hr-payslip-cols">
              <div className="stack-sm">
                <div className="section-title">Earnings</div>
                <table className="hr-lines">
                  <tbody>
                    {lines(p.earnings)}
                    <tr className="is-total">
                      <td>Total earnings</td>
                      <td>{money(p.totalEarnings)}</td>
                    </tr>
                    {p.lopAmount > 0 && (
                      <tr className="is-lop">
                        <td>Loss of pay ({p.lopDays} day{p.lopDays === 1 ? "" : "s"})</td>
                        <td>−{money(p.lopAmount)}</td>
                      </tr>
                    )}
                    <tr className="is-total">
                      <td>Gross pay</td>
                      <td>{money(p.grossPay)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="stack-sm">
                <div className="section-title">Deductions</div>
                <table className="hr-lines">
                  <tbody>
                    {p.deductions.length ? (
                      lines(p.deductions, true)
                    ) : (
                      <tr>
                        <td className="muted">No deductions</td>
                        <td />
                      </tr>
                    )}
                    <tr className="is-total">
                      <td>Total deductions</td>
                      <td>−{money(p.totalDeductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="hr-net">
              <span>Net pay</span>
              <strong>{money(p.netPay)}</strong>
            </div>

            <div className="stack-sm">
              <div className="section-title">Attendance in {monthLabel(p.month)}</div>
              <div className="hr-strip">
                {ATTENDANCE_STATUSES.map(s => (
                  <span key={s}>
                    <strong>{p.attendance?.[s] ?? 0}</strong> {ATTENDANCE_LABELS[s].toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}
