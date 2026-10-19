import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, PartyPopper } from "lucide-react";
import { api } from "@/common/api";
import { useAuth } from "@/common/auth";
import { useApiGet, useDebounce, useListParams } from "@/common/hooks";
import { BarList, Button, Card, ColumnChart, DataTable, EmptyState, Legend, seriesColor, TextInput, useToast } from "@/common/ui";
import { enumLabel, formatDate, formatMoney } from "@/common/utils/format";
import { useSchoolCurrency } from "@/modules/users/shared";
import { DASHBOARDS_PATH, monthLabel, type FeesReport } from "../api/dashboards";
import { ChartCard, DashboardError, MiniTable } from "./ChartCard";

const CLASS_SERIES = [
  { key: "billed", label: "Billed" },
  { key: "collected", label: "Collected" },
  { key: "outstanding", label: "Outstanding" }
];

/* RP-01 Fees: collections by month and method, the position per class, concessions, defaulters */
export function FeesTab() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const currency = useSchoolCurrency();
  const money = (n: number) => formatMoney(n, currency);
  const compactMoney = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(n);
    } catch {
      return String(n);
    }
  };
  const { params, setParam } = useListParams({ from: "", to: "" });
  const query = useDebounce({ from: params.from || undefined, to: params.to || undefined, defaulterLimit: 100 }, 400);
  const q = useApiGet<FeesReport>(`${DASHBOARDS_PATH}/fees`, query);
  const d = q.data;
  const loading = !d && !q.error;
  const [exporting, setExporting] = useState(false);

  const exportDefaulters = async () => {
    setExporting(true);
    try {
      await api.download("/reports/exports/fee-defaulters", { format: "xlsx" }, "fee-defaulters.xlsx");
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(false);
    }
  };

  const filters = (
    <Card flush>
      <div className="filter-bar">
        <TextInput label="Collections from" type="date" className="input-sm" value={params.from} max={params.to || undefined} onChange={e => setParam("from", e.target.value)} />
        <TextInput label="To" type="date" className="input-sm" value={params.to} min={params.from || undefined} onChange={e => setParam("to", e.target.value)} />
        <span className="small muted" style={{ paddingBottom: 8 }}>
          {d ? `${formatDate(d.from)} – ${formatDate(d.to)} · the class position and defaulters cover the whole year` : " "}
        </span>
      </div>
    </Card>
  );

  if (q.error)
    return (
      <div className="stack">
        {filters}
        <DashboardError error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );

  const methods = [...(d?.collections.byMethod ?? [])].sort((a, b) => b.amount - a.amount);

  return (
    <div className="stack" style={{ opacity: q.isFetching && d ? 0.7 : 1, transition: "opacity .15s" }}>
      {filters}
      <div className="dash-grid">
        <ChartCard
          title="Collected by month"
          loading={loading}
          chart={
            <ColumnChart
              ariaLabel="Fees collected by month"
              height={240}
              series={[{ key: "amount", label: "collected" }]}
              formatValue={money}
              formatTick={compactMoney}
              data={(d?.collections.byMonth ?? []).map(m => ({ label: monthLabel(m.month), values: { amount: m.amount }, note: `${m.payments} payment${m.payments === 1 ? "" : "s"}` }))}
              empty="No payments in this range"
            />
          }
          table={<MiniTable head={["Month", "Collected", "Payments"]} rows={(d?.collections.byMonth ?? []).map(m => [monthLabel(m.month), money(m.amount), m.payments])} />}
        />
        <ChartCard
          title="By payment method"
          loading={loading}
          chart={
            <BarList
              ariaLabel="Fees collected by payment method"
              items={methods.map(m => ({ key: m.method, label: enumLabel(m.method), value: m.amount, display: money(m.amount), note: `${m.payments} payment${m.payments === 1 ? "" : "s"}` }))}
              empty="No payments in this range"
            />
          }
          table={<MiniTable head={["Method", "Collected", "Payments"]} rows={methods.map(m => [enumLabel(m.method), money(m.amount), m.payments])} />}
        />
        <div className="span-2">
          <ChartCard
            title="By class"
            subtitle="This academic year, after concessions"
            loading={loading}
            legend={<Legend items={CLASS_SERIES.map((s, i) => ({ label: s.label, color: seriesColor(i) }))} />}
            chart={
              <ColumnChart
                ariaLabel="Billed, collected and outstanding by class"
                height={240}
                series={CLASS_SERIES}
                formatValue={money}
                formatTick={compactMoney}
                data={(d?.byClass ?? []).map(c => ({
                  label: c.className,
                  values: { billed: c.billed, collected: c.collected, outstanding: c.outstanding },
                  note: c.concessions ? `${money(c.concessions)} in concessions` : undefined
                }))}
                empty="Nothing billed yet"
              />
            }
            table={
              <MiniTable
                head={["Class", "Billed", "Concessions", "Collected", "Outstanding"]}
                rows={(d?.byClass ?? []).map(c => [c.className, money(c.billed), money(c.concessions), money(c.collected), money(c.outstanding)])}
              />
            }
          />
        </div>
        <div className="span-2">
        <Card flush title="Concessions by category" subtitle="This academic year">
          <DataTable
            rows={d?.concessions.byCategory}
            loading={loading}
            rowKey={c => c.category}
            columns={[
              { key: "category", header: "Category", render: c => enumLabel(c.category) },
              { key: "students", header: "Students", align: "right" },
              { key: "amount", header: "Amount", align: "right", render: c => money(c.amount) }
            ]}
            empty={<EmptyState title="No concessions given" />}
          />
        </Card>
        </div>
        <div className="span-2">
        <Card
          flush
          title="Defaulters"
          subtitle="Overdue balances as of today, largest first"
          actions={
            can("reports.exports.fees") && (
              <Button size="sm" icon={<Download />} loading={exporting} onClick={() => void exportDefaulters()}>
                Export
              </Button>
            )
          }
        >
          <DataTable
            rows={d?.defaulters}
            loading={loading}
            rowKey={s => s.studentId}
            onRowClick={can("users.students.read") ? s => navigate(`/users/students/${s.studentId}?tab=fees`) : undefined}
            columns={[
              { key: "admissionNumber", header: "Adm. no.", render: s => <span className="mono">{s.admissionNumber}</span> },
              { key: "name", header: "Student", render: s => `${s.firstName} ${s.lastName}` },
              { key: "section", header: "Section" },
              { key: "invoices", header: "Invoices", align: "right" },
              { key: "oldestDueDate", header: "Oldest due", render: s => <span className="nowrap">{formatDate(s.oldestDueDate)}</span> },
              { key: "overdue", header: "Overdue", align: "right", render: s => <strong className="nowrap">{money(s.overdue)}</strong> }
            ]}
            empty={<EmptyState icon={<PartyPopper />} title="No overdue fees" />}
          />
        </Card>
        </div>
      </div>
    </div>
  );
}
