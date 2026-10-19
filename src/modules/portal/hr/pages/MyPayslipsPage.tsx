import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { useApiGet, useApiList, useListParams } from "@/common/hooks";
import { Button, Card, DataTable, DescriptionList, Drawer, EmptyState, ErrorState, Page, PageHeader, SkeletonBlock, useToast } from "@/common/ui";
import { formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { monthName } from "../../shared/utils/time";
import { MY_PAYSLIPS_PATH, downloadPayslip, type PayLine, type Payslip } from "../api/hr";
import "../../shared/portal.css";

/* PO-11 · My payslips: finalised payslips, newest month first; a row opens the breakdown */
export default function MyPayslipsPage() {
  const currency = useSchoolCurrency();
  const { params, setPage } = useListParams({});
  const list = useApiList<Payslip>(MY_PAYSLIPS_PATH, { page: params.page, limit: params.limit });
  const [openId, setOpenId] = useState<string | null>(null);
  const money = (n: number) => formatMoney(n, currency);

  return (
    <Page>
      <PageHeader title="My payslips" subtitle="Payslips appear once HR finalises the month's payroll" />
      <Card flush>
        <DataTable
          rows={list.rows}
          rowKey={p => p.id}
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.refetch()}
          meta={list.meta}
          onPageChange={setPage}
          onRowClick={p => setOpenId(p.id)}
          empty={<EmptyState icon={<FileText />} title="No payslips yet" />}
          columns={[
            { key: "month", header: "Month", render: p => <strong style={{ fontWeight: 550 }}>{monthName(p.month)}</strong> },
            { key: "payslipNumber", header: "Payslip", render: p => <span className="mono">{p.payslipNumber}</span> },
            { key: "grossPay", header: "Gross", align: "right", render: p => <span className="po-num">{money(p.grossPay)}</span> },
            { key: "totalDeductions", header: "Deductions", align: "right", render: p => <span className="po-num">{money(p.totalDeductions)}</span> },
            { key: "netPay", header: "Net pay", align: "right", render: p => <strong className="po-num">{money(p.netPay)}</strong> }
          ]}
        />
      </Card>
      <PayslipDrawer id={openId} preview={list.rows?.find(p => p.id === openId)} onClose={() => setOpenId(null)} />
    </Page>
  );
}

function PayslipDrawer({ id, preview, onClose }: { id: string | null; preview?: Payslip; onClose: () => void }) {
  const currency = useSchoolCurrency();
  const toast = useToast();
  const detail = useApiGet<Payslip>(id ? `${MY_PAYSLIPS_PATH}/${id}` : null);
  const p = detail.data ?? preview;
  const [downloading, setDownloading] = useState(false);
  const money = (n: number) => formatMoney(n, currency);

  const download = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      await downloadPayslip(id);
    } catch (e) {
      toast.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const lines = (rows: PayLine[], total: number, label: string) => (
    <div className="stack-sm">
      <div className="section-title">{label}</div>
      <ul className="po-lines">
        {rows.map(l => (
          <li key={l.code}>
            <span>{l.name}</span>
            <span className="po-num">{money(l.amount)}</span>
          </li>
        ))}
        <li>
          <strong>Total</strong>
          <strong className="po-num">{money(total)}</strong>
        </li>
      </ul>
    </div>
  );

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={p ? `Payslip for ${monthName(p.month)}` : "Payslip"}
      subtitle={p?.payslipNumber}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<Download />} loading={downloading} onClick={() => void download()}>
            Download PDF
          </Button>
        </>
      }
    >
      {detail.error && !p ? (
        <ErrorState error={detail.error} />
      ) : !p ? (
        <SkeletonBlock lines={10} />
      ) : (
        <div className="stack">
          <DescriptionList
            columns={2}
            items={[
              { label: "Name", value: p.employeeName },
              { label: "Employee code", value: p.employeeCode },
              { label: "Designation", value: p.designation },
              { label: "Days paid", value: `${p.paidDays} of ${p.daysInMonth}${p.lopDays ? ` · ${p.lopDays} without pay` : ""}` },
              { label: "Bank account", value: p.bankAccountMasked ? <span className="mono">{p.bankAccountMasked}</span> : null },
              { label: "PAN", value: p.panMasked ? <span className="mono">{p.panMasked}</span> : null }
            ]}
          />
          {lines(p.earnings, p.totalEarnings, "Earnings")}
          {p.lopAmount > 0 && (
            <div className="row-between small">
              <span>Loss of pay ({p.lopDays} days)</span>
              <span className="po-num po-danger">− {money(p.lopAmount)}</span>
            </div>
          )}
          {lines(p.deductions, p.totalDeductions, "Deductions")}
          <div className="kpi">
            <div className="kpi-label">Net pay</div>
            <div className="kpi-value">{money(p.netPay)}</div>
            <div className="small muted">Gross {money(p.grossPay)} less deductions {money(p.totalDeductions)}</div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
