/* FI-13 · Trial balance: every account's debit or credit balance on a date, and whether they agree */
import { useNavigate } from "react-router-dom";
import { Scale } from "lucide-react";
import { useListParams } from "@/common/hooks";
import { Badge, Card, DataTable, EmptyState, PageHeader, Skeleton, TextInput } from "@/common/ui";
import { formatDate, todayIso } from "@/common/utils/format";
import { useMoney } from "../../shared";
import { Amount } from "../../shared/components/FinanceStatus";
import { OPS_PATHS } from "../../shared/utils/opsPaths";
import { ACCOUNT_TYPE_LABELS, useTrialBalance } from "../api/ledger";

export default function TrialBalancePage() {
  const money = useMoney();
  const navigate = useNavigate();
  const { params, setParam } = useListParams({ asOf: "" });
  const tb = useTrialBalance(params.asOf);
  const d = tb.data;

  return (
    <>
      <PageHeader title="Trial balance" subtitle="Each account's balance on a date. Total debits must equal total credits." />
      <Card flush>
        <div className="filter-bar" style={{ justifyContent: "space-between" }}>
          <TextInput label="As of" type="date" className="input-sm" max={todayIso()} value={params.asOf} onChange={e => setParam("asOf", e.target.value)} />
          <div style={{ minHeight: 26, display: "flex", alignItems: "center", paddingBottom: 4 }}>
            {d ? (
              d.balanced ? (
                <Badge tone="success" dot>
                  Balanced on {formatDate(d.asOf)}
                </Badge>
              ) : (
                <Badge tone="danger" dot>
                  Not balanced on {formatDate(d.asOf)}
                </Badge>
              )
            ) : (
              <Skeleton width={140} height={22} />
            )}
          </div>
        </div>
        <DataTable
          rows={d?.accounts}
          rowKey={a => a.accountId}
          loading={tb.isLoading}
          error={tb.error}
          onRetry={() => void tb.refetch()}
          onRowClick={a => navigate(OPS_PATHS.account(a.accountId))}
          columns={[
            { key: "code", header: "Code", width: 90, render: a => <span className="mono">{a.code}</span> },
            { key: "name", header: "Account", render: a => a.name },
            { key: "accountType", header: "Type", render: a => <span className="muted">{ACCOUNT_TYPE_LABELS[a.accountType]}</span> },
            { key: "debit", header: "Debit", align: "right", render: a => <Amount value={a.debit} format={money} dashZero /> },
            { key: "credit", header: "Credit", align: "right", render: a => <Amount value={a.credit} format={money} dashZero /> }
          ]}
          empty={<EmptyState icon={<Scale />} title="Nothing posted by this date" message="The books start on the day the school starts using the system." />}
        />
        {d && d.accounts.length > 0 && (
          <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="totals" style={{ gridTemplateColumns: "1fr auto auto", fontWeight: 600 }}>
              <span>Total</span>
              <span>{money(d.totals.debit)}</span>
              <span>{money(d.totals.credit)}</span>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
