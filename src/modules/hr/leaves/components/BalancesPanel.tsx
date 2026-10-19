import { useSearchParams } from "react-router-dom";
import { Scale } from "lucide-react";
import { useAuth } from "@/common/auth";
import { useApiGet, useListParams } from "@/common/hooks";
import { Badge, Button, Card, DataTable, EmptyState, Select } from "@/common/ui";
import { EmployeeSelect } from "../../shared/components/EmployeeSelect";
import { LEAVE_BALANCES_PATH, type LeaveBalance, type LeaveBalances } from "../api/leaves";
import { BalanceBar } from "./BalanceBar";

const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2, THIS_YEAR - 3].map(String);

/* HR-04 Balances tab: one employee's balances for a calendar year */
export function BalancesPanel() {
  const { can } = useAuth();
  const [, setSearch] = useSearchParams();
  const { params, setParam } = useListParams({ userId: "", year: String(THIS_YEAR) });
  const balances = useApiGet<LeaveBalances>(params.userId ? LEAVE_BALANCES_PATH : null, { userId: params.userId, year: params.year });

  const viewRequests = () => setSearch({ userId: params.userId, status: "ALL", from: `${params.year}-01-01`, to: `${params.year}-12-31` }, { replace: true });

  return (
    <Card flush>
      <div className="filter-bar">
        <EmployeeSelect label="Employee" className="select-sm" placeholder="Pick an employee" value={params.userId} onChange={id => setParam("userId", id)} />
        <Select label="Year" className="select-sm" value={params.year} required onChange={e => setParam("year", e.target.value)} options={YEARS.map(y => ({ value: y, label: y }))} />
        <div className="row" style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
          {can("hr.leaveRequests.read") && (
            <Button size="sm" disabled={!params.userId} onClick={viewRequests}>
              View requests
            </Button>
          )}
        </div>
      </div>
      {!params.userId ? (
        <div className="table-empty">
          <EmptyState icon={<Scale />} title="Pick an employee" message="Balances are shown for one employee at a time: quota, used, pending and what's left." />
        </div>
      ) : (
        <DataTable<LeaveBalance>
          rows={balances.data?.balances}
          rowKey={b => b.leaveTypeId}
          loading={balances.isLoading}
          error={balances.error}
          onRetry={() => void balances.refetch()}
          empty={<EmptyState icon={<Scale />} title="No leave types yet" message="Add leave types first; balances come from their quotas." />}
          columns={[
            {
              key: "name",
              header: "Leave type",
              render: b => (
                <span className="row nowrap" style={{ gap: 6 }}>
                  <strong>{b.name}</strong> <span className="mono small muted">{b.code}</span>
                </span>
              )
            },
            { key: "paid", header: "Paid", render: b => (b.isPaid ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">Unpaid</Badge>) },
            { key: "quota", header: "Quota", align: "right", render: b => <span className="hr-num">{b.quota}</span> },
            { key: "used", header: "Used", align: "right", render: b => <span className="hr-num">{b.used}</span> },
            { key: "pending", header: "Pending", align: "right", render: b => <span className="hr-num">{b.pending}</span> },
            { key: "remaining", header: "Left", align: "right", render: b => <strong className="hr-num">{b.remaining}</strong> },
            { key: "bar", header: "", width: 200, render: b => <BalanceBar balance={b} legend={false} /> }
          ]}
        />
      )}
    </Card>
  );
}
